import { getServiceSupabase } from '../lib/supabase.js';
import {
  getHaloConfig,
  haloGet,
  extractRecords,
  mapHaloClientToCustomer,
  mapHaloUserToContact,
} from '../lib/halopsa.js';

export async function scheduledHaloPSASync(_body, _user) {
  const supabase = getServiceSupabase();

  let config;
  try {
    config = await getHaloConfig();
  } catch {
    return { success: false, error: 'HaloPSA settings not configured' };
  }

  // Create sync log
  const { data: syncLog, error: syncLogError } = await supabase
    .from('sync_logs')
    .insert({ source: 'halopsa', status: 'in_progress', sync_type: 'full', started_at: new Date().toISOString() })
    .select()
    .single();
  if (syncLogError) throw new Error(syncLogError.message);

  let customersSynced = 0;
  let contactsSynced = 0;
  const errors = [];

  try {
    // ========== SYNC CUSTOMERS ==========
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
      if (clients.length < pageSize) break;
      if (totalCount > 0 && allClients.length >= totalCount) break;
      if (pageNumber > 20) break;
      pageNumber++;
    }

    // Get existing customers
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
      customersSynced += toCreate.length;
    }

    for (const item of toUpdate) {
      await supabase.from('customers').update(item.data).eq('id', item.id);
      customersSynced++;
    }

    // ========== SYNC CONTACTS FOR EACH CUSTOMER ==========
    const { data: allCustomers } = await supabase
      .from('customers')
      .select('*')
      .eq('source', 'halopsa');

    for (const customer of (allCustomers || [])) {
      try {
        const data = await haloGet(`Users?client_id=${customer.external_id}&page_size=500`, config);
        const users = extractRecords(data, 'users');

        const { data: existingContacts } = await supabase
          .from('contacts')
          .select('*')
          .eq('customer_id', customer.id);

        const existingByHaloId = Object.fromEntries(
          (existingContacts || []).filter(c => c.halopsa_id).map(c => [c.halopsa_id, c]),
        );

        for (const haloUser of users) {
          const contactPayload = mapHaloUserToContact(haloUser, customer.id);
          const existing = existingByHaloId[String(haloUser.id)];

          if (existing) {
            await supabase.from('contacts').update(contactPayload).eq('id', existing.id);
          } else {
            const { error } = await supabase.from('contacts').insert(contactPayload);
            if (error) throw new Error(error.message);
          }
          contactsSynced++;
        }

        await supabase
          .from('customers')
          .update({ total_users: users.length })
          .eq('id', customer.id);
      } catch (e) {
        errors.push({ customer: customer.name, error: e.message });
      }
    }

    // Update sync log
    await supabase
      .from('sync_logs')
      .update({
        status: errors.length > 0 ? 'partial' : 'success',
        records_synced: customersSynced + contactsSynced,
        records_failed: errors.length,
        error_message: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog.id);

    return {
      success: true,
      customersSynced,
      contactsSynced,
      errors: errors.length,
      totalCustomers: allClients.length,
    };
  } catch (syncError) {
    await supabase
      .from('sync_logs')
      .update({ status: 'failed', error_message: syncError.message, completed_at: new Date().toISOString() })
      .eq('id', syncLog.id);
    return { success: false, error: syncError.message };
  }
}
