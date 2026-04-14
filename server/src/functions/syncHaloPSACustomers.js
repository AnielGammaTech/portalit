import { getServiceSupabase } from '../lib/supabase.js';
import {
  getHaloConfig,
  haloGet,
  extractRecords,
  mapHaloClientToCustomer,
  fetchSitesByClientId,
} from '../lib/halopsa.js';

export async function syncHaloPSACustomers(body, _user) {
  const supabase = getServiceSupabase();
  const { action } = body;
  const config = await getHaloConfig();

  // ── debug_sites — inspect raw site data for address field discovery ─
  if (action === 'debug_sites') {
    const siteData = await haloGet('Site?page_size=3&page_no=1', config);
    const sites = extractRecords(siteData, 'sites');
    const clientData = await haloGet('Client?page_size=3&page_no=1', config);
    const clients = extractRecords(clientData, 'clients');
    return {
      success: true,
      sampleSites: sites.slice(0, 3),
      sampleClients: clients.slice(0, 3).map(c => {
        const addrKeys = Object.keys(c).filter(k =>
          /addr|line|street|city|town|state|county|zip|post|country/i.test(k)
        );
        return { id: c.id, name: c.name, addressFields: Object.fromEntries(addrKeys.map(k => [k, c[k]])) };
      }),
      siteKeys: sites.length > 0 ? Object.keys(sites[0]) : [],
      clientKeys: clients.length > 0 ? Object.keys(clients[0]) : [],
    };
  }

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
      const safeId = String(customer_id).replace(/[^a-zA-Z0-9_-]/g, '');
      const clientData = await haloGet(`Client/${safeId}`, config);

      // Fetch site detail for address resolution (delivery_address is on individual site endpoint)
      let site = null;
      const siteId = clientData.main_site_id || clientData.toplevel_id;
      if (siteId && siteId > 0) {
        try {
          site = await haloGet(`Site/${siteId}`, config);
        } catch {
          // Site fetch is best-effort; address will be empty if it fails
        }
      }

      const customerData = mapHaloClientToCustomer(clientData, site);

      const { data: existingArr } = await supabase
        .from('customers')
        .select('*')
        .eq('external_id', String(clientData.id))
        .eq('source', 'halopsa');

      const existing = (existingArr || [])[0];
      if (existing) {
        // Never overwrite good data with empty values from a failed site fetch
        if (!customerData.address && existing.address) delete customerData.address;
        if (!customerData.phone && existing.phone) delete customerData.phone;
        if (!customerData.email && existing.email) delete customerData.email;
        if (!customerData.primary_contact && existing.primary_contact) delete customerData.primary_contact;
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
      // Paginated fetch of clients (must happen first so we can get main_site_id)
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

      // Fetch site details for address resolution (passes clients for main_site_id lookup)
      console.log('[HaloPSA] Fetching site details for address data...');
      const siteMap = await fetchSitesByClientId(config, allClients);
      console.log(`[HaloPSA] Loaded ${Object.keys(siteMap).length} site addresses`);

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

        // Resolve site for this client (keyed by client.id from fetchSitesByClientId)
        const site = siteMap[String(client.id)] || null;
        const customerData = mapHaloClientToCustomer(client, site);

        const existing = existingByExternalId[String(client.id)];
        if (existing) {
          // Never overwrite good data with empty values from a failed site fetch
          if (!customerData.address && existing.address) delete customerData.address;
          if (!customerData.phone && existing.phone) delete customerData.phone;
          if (!customerData.email && existing.email) delete customerData.email;
          if (!customerData.primary_contact && existing.primary_contact) delete customerData.primary_contact;
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
