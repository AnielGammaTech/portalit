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

    // Parallel update customers (batches of 20)
    const CUST_BATCH = 20;
    for (let i = 0; i < toUpdate.length; i += CUST_BATCH) {
      const batch = toUpdate.slice(i, i + CUST_BATCH);
      await Promise.allSettled(
        batch.map(item => supabase.from('customers').update(item.data).eq('id', item.id))
      );
      customersSynced += batch.length;
    }

    // ========== SYNC CONTACTS FOR EACH CUSTOMER ==========
    const { data: allCustomers } = await supabase
      .from('customers')
      .select('*')
      .eq('source', 'halopsa');

    // Process customers in parallel batches of 5 (API-call-heavy, so limit concurrency)
    const CUSTOMER_CONCURRENCY = 5;
    for (let i = 0; i < (allCustomers || []).length; i += CUSTOMER_CONCURRENCY) {
      const customerBatch = allCustomers.slice(i, i + CUSTOMER_CONCURRENCY);
      const results = await Promise.allSettled(
        customerBatch.map(async (customer) => {
          const data = await haloGet(`Users?client_id=${customer.external_id}&page_size=500`, config);
          const users = extractRecords(data, 'users');

          const { data: existingContacts } = await supabase
            .from('contacts')
            .select('*')
            .eq('customer_id', customer.id);

          const existingByHaloId = Object.fromEntries(
            (existingContacts || []).filter(c => c.halopsa_id).map(c => [c.halopsa_id, c]),
          );

          const toCreateContacts = [];
          const toUpdateContacts = [];

          for (const haloUser of users) {
            const contactPayload = mapHaloUserToContact(haloUser, customer.id);
            const existing = existingByHaloId[String(haloUser.id)];
            if (existing) {
              toUpdateContacts.push({ id: existing.id, data: contactPayload });
            } else {
              toCreateContacts.push(contactPayload);
            }
          }

          // Bulk insert new contacts
          if (toCreateContacts.length > 0) {
            await supabase.from('contacts').insert(toCreateContacts);
          }

          // Parallel update existing contacts (batches of 20)
          const CONTACT_BATCH = 20;
          for (let j = 0; j < toUpdateContacts.length; j += CONTACT_BATCH) {
            const batch = toUpdateContacts.slice(j, j + CONTACT_BATCH);
            await Promise.allSettled(
              batch.map(item => supabase.from('contacts').update(item.data).eq('id', item.id))
            );
          }

          await supabase
            .from('customers')
            .update({ total_users: users.length })
            .eq('id', customer.id);

          return users.length;
        })
      );

      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          contactsSynced += r.value;
        } else {
          errors.push({ customer: customerBatch[idx].name, error: r.reason?.message });
        }
      });
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
