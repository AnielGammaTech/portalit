import { getServiceSupabase } from '../lib/supabase.js';
import {
  getHaloConfig,
  haloGet,
  extractRecords,
  mapHaloClientToCustomer,
} from '../lib/halopsa.js';

export async function syncHaloPSACustomers(body, _user) {
  const supabase = getServiceSupabase();
  const { action } = body;
  const config = await getHaloConfig();

  // ── test_connection ────────────────────────────────────────────────
  if (action === 'test_connection') {
    const data = await haloGet('Client?count=1', config);
    const records = extractRecords(data, 'clients');
    return {
      success: true,
      message: `HaloPSA connection successful — ${data.record_count || records.length} customers found`,
    };
  }

  // ── sync_customer (single) ─────────────────────────────────────────
  if (action === 'sync_customer') {
    const { customer_id } = body;

    const { data: syncLog, error: syncLogError } = await supabase
      .from('sync_logs')
      .insert({ source: 'halopsa', status: 'in_progress', sync_type: 'customers', started_at: new Date().toISOString() })
      .select()
      .single();
    if (syncLogError) throw new Error(syncLogError.message);

    try {
      const clientData = await haloGet(`Client/${customer_id}`, config);
      const customerData = mapHaloClientToCustomer(clientData);

      const { data: existingArr } = await supabase
        .from('customers')
        .select('*')
        .eq('external_id', String(clientData.id))
        .eq('source', 'halopsa');

      const existing = (existingArr || [])[0];
      if (existing) {
        await supabase.from('customers').update(customerData).eq('id', existing.id);
      } else {
        const { error } = await supabase.from('customers').insert(customerData);
        if (error) throw new Error(error.message);
      }

      await supabase.from('sync_logs').update({
        status: 'success', records_synced: 1, completed_at: new Date().toISOString(),
      }).eq('id', syncLog.id);

      return { success: true, message: 'Customer synced successfully', recordsSynced: 1 };
    } catch (syncError) {
      await supabase.from('sync_logs').update({
        status: 'failed', error_message: syncError.message, completed_at: new Date().toISOString(),
      }).eq('id', syncLog.id);
      throw Object.assign(new Error('Customer sync failed'), { statusCode: 500 });
    }
  }

  // ── sync_now (full bulk) ───────────────────────────────────────────
  if (action === 'sync_now') {
    const { data: syncLog, error: syncLogError } = await supabase
      .from('sync_logs')
      .insert({ source: 'halopsa', status: 'in_progress', sync_type: 'full', started_at: new Date().toISOString() })
      .select()
      .single();
    if (syncLogError) throw new Error(syncLogError.message);

    let recordsSynced = 0;
    let recordsFailed = 0;
    const errors = [];

    try {
      // Paginated fetch
      let allClients = [];
      let pageNumber = 1;
      const pageSize = 1000;

      while (true) {
        const data = await haloGet(
          `Client?pageinate=true&page_size=${pageSize}&page_no=${pageNumber}&isactive=true`,
          config,
        );
        const clients = extractRecords(data, 'clients');
        if (!clients.length) break;
        allClients = [...allClients, ...clients];

        const totalCount = data.record_count || data.recordCount || 0;
        console.log(`[HaloPSA] Page ${pageNumber}: ${clients.length} clients (total: ${allClients.length}/${totalCount})`);

        if (clients.length < pageSize) break;
        if (totalCount > 0 && allClients.length >= totalCount) break;
        if (pageNumber > 20) break;
        pageNumber++;
      }

      // Lookup existing
      const { data: existingCustomers } = await supabase
        .from('customers')
        .select('*')
        .eq('source', 'halopsa');

      const existingByExternalId = Object.fromEntries(
        (existingCustomers || []).map(c => [c.external_id, c]),
      );

      const toCreate = [];
      const toUpdate = [];

      for (const client of allClients) {
        if (config.excludedIds.includes(String(client.id))) continue;
        if (client.inactive === true) continue;
        const customerData = mapHaloClientToCustomer(client);
        const existing = existingByExternalId[String(client.id)];
        if (existing) {
          toUpdate.push({ id: existing.id, data: customerData });
        } else {
          toCreate.push(customerData);
        }
      }

      if (toCreate.length > 0) {
        const { error } = await supabase.from('customers').insert(toCreate).select();
        if (error) throw new Error(error.message);
        recordsSynced += toCreate.length;
      }

      for (const item of toUpdate) {
        try {
          await supabase.from('customers').update(item.data).eq('id', item.id);
          recordsSynced++;
        } catch (err) {
          errors.push(err.message);
          recordsFailed++;
        }
      }

      await supabase.from('sync_logs').update({
        status: errors.length > 0 ? 'partial' : 'success',
        records_synced: recordsSynced,
        records_failed: recordsFailed,
        error_message: errors.length > 0 ? JSON.stringify(errors) : null,
        completed_at: new Date().toISOString(),
      }).eq('id', syncLog.id);

      return { success: true, message: 'HaloPSA sync completed', recordsSynced, recordsFailed };
    } catch (syncError) {
      errors.push(syncError.message);
      await supabase.from('sync_logs').update({
        status: 'failed', records_synced: recordsSynced, records_failed: recordsFailed,
        error_message: JSON.stringify(errors), completed_at: new Date().toISOString(),
      }).eq('id', syncLog.id);
      throw Object.assign(new Error('HaloPSA sync failed'), { statusCode: 500 });
    }
  }

  throw Object.assign(new Error('Invalid action'), { statusCode: 400 });
}
