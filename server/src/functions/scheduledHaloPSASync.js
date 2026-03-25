import { getServiceSupabase } from '../lib/supabase.js';
import {
  getHaloConfig,
  haloGet,
  extractRecords,
  mapHaloClientToCustomer,
  mapHaloUserToContact,
  fetchSitesByClientId,
} from '../lib/halopsa.js';

// ── helpers ──────────────────────────────────────────────────────────

function buildTicketPayload(haloTicket, customerId) {
  const statusMap = {
    '1': 'new', '2': 'open', '3': 'in_progress',
    '4': 'waiting', '5': 'resolved', '6': 'closed',
    '26': 'resolved', '27': 'closed',
  };
  const priorityMap = { '1': 'critical', '2': 'high', '3': 'medium', '4': 'low' };

  let status = 'open';
  if (haloTicket.dateclosed) {
    status = 'resolved';
  } else if (haloTicket.status_id) {
    status = statusMap[String(haloTicket.status_id)] || 'open';
  }
  if (haloTicket.status && typeof haloTicket.status === 'string') {
    const s = haloTicket.status.toLowerCase();
    if (s.includes('resolved')) status = 'resolved';
    else if (s.includes('closed')) status = 'closed';
    else if (s.includes('waiting')) status = 'waiting';
    else if (s.includes('progress')) status = 'in_progress';
    else if (s.includes('new')) status = 'new';
  }
  if (haloTicket.dateclosed) status = 'resolved';

  return {
    customer_id: customerId,
    external_id: String(haloTicket.id),
    source: 'halopsa',
    subject: haloTicket.summary || haloTicket.Summary || '',
    description: haloTicket.details || haloTicket.Details || '',
    status,
    priority: priorityMap[String(haloTicket.priority_id)] || haloTicket.priority?.toLowerCase?.() || 'medium',
    ticket_type: haloTicket.tickettype_name || haloTicket.tickettype || '',
    assigned_to: haloTicket.agent_name || haloTicket.agent || '',
    contact_name: haloTicket.user_name || haloTicket.username || '',
    contact_email: haloTicket.user_email || '',
    created_date: haloTicket.dateoccurred || haloTicket.datecreated || null,
    closed_at: haloTicket.dateclosed || null,
  };
}

function buildContractPayload(haloContract, dbCustomer) {
  const typeMap = {
    'managed': 'managed_services', 'managed services': 'managed_services',
    'break fix': 'break_fix', 'breakfix': 'break_fix',
    'project': 'project', 'subscription': 'subscription',
  };
  const statusMap = {
    'active': 'active', 'pending': 'pending', 'expired': 'expired',
    'cancelled': 'cancelled', 'canceled': 'cancelled', 'inactive': 'expired',
  };
  const billingMap = {
    'monthly': 'monthly', 'quarterly': 'quarterly', 'annually': 'annually',
    'annual': 'annually', 'yearly': 'annually',
    'one time': 'one_time', 'one-time': 'one_time', 'onetime': 'one_time',
  };
  const parseDate = (d) => {
    if (!d) return null;
    if (d.includes('2099')) return null;
    return d.split('T')[0];
  };

  const rawTypeName = haloContract.type_name || haloContract.typename || haloContract.type || '';
  const rawType = rawTypeName.toLowerCase();
  let contractStatus = 'active';
  const rawStatus = haloContract.contract_status || haloContract.status_name || haloContract.statusname || '';
  if (typeof rawStatus === 'string' && rawStatus) {
    contractStatus = statusMap[rawStatus.toLowerCase()] || 'active';
  } else if (haloContract.expired === true) {
    contractStatus = 'expired';
  }
  const rawBilling = (haloContract.billing_cycle || haloContract.billingcycle || haloContract.billingfrequency || 'monthly').toLowerCase();

  return {
    customer_id: dbCustomer.id,
    name: haloContract.contractname || haloContract.ref || haloContract.client_name || haloContract.name || `Contract ${haloContract.id}`,
    external_id: String(haloContract.id),
    source: 'halopsa',
    contract_type: typeMap[rawType]
      || (rawType.includes('managed') ? 'managed_services' : null)
      || (rawType.includes('break') && rawType.includes('fix') ? 'break_fix' : null)
      || (rawType.includes('project') ? 'project' : null)
      || (rawType.includes('subscription') ? 'subscription' : null)
      || 'other',
    contract_type_raw: rawTypeName || null,
    status: contractStatus,
    start_date: parseDate(haloContract.start_date || haloContract.startdate),
    end_date: parseDate(haloContract.end_date || haloContract.enddate),
    billing_cycle: billingMap[rawBilling] || 'monthly',
    value: parseFloat(haloContract.periodchargeamount || haloContract.contractvalue || haloContract.value || haloContract.monthlyvalue || 0) || 0,
    notes: haloContract.notes || haloContract.description || '',
  };
}

// ── main scheduled sync ──────────────────────────────────────────────

export async function scheduledHaloPSASync(_body, _user) {
  const supabase = getServiceSupabase();

  let config;
  try {
    config = await getHaloConfig();
  } catch {
    return { success: false, error: 'HaloPSA settings not configured' };
  }

  const { data: syncLog, error: syncLogError } = await supabase
    .from('sync_logs')
    .insert({ source: 'halopsa', status: 'in_progress', sync_type: 'full', started_at: new Date().toISOString() })
    .select()
    .single();
  if (syncLogError) throw new Error(syncLogError.message);

  let customersSynced = 0;
  let contactsSynced = 0;
  let contractsSynced = 0;
  let ticketsSynced = 0;
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

    // Fetch site details (with addresses) for all clients
    let siteMap = {};
    try {
      siteMap = await fetchSitesByClientId(config, allClients);
    } catch (siteErr) {
      console.error('[HaloPSA] Failed to fetch site details for addresses:', siteErr.message);
    }

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
      const site = siteMap[String(client.id)];
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
      customersSynced += toCreate.length;
    }

    const CUST_BATCH = 20;
    for (let i = 0; i < toUpdate.length; i += CUST_BATCH) {
      const batch = toUpdate.slice(i, i + CUST_BATCH);
      await Promise.allSettled(
        batch.map(item => supabase.from('customers').update(item.data).eq('id', item.id)),
      );
      customersSynced += batch.length;
    }

    // ========== SYNC CONTACTS, CONTRACTS, TICKETS PER CUSTOMER ==========
    const { data: allCustomers } = await supabase
      .from('customers')
      .select('*')
      .eq('source', 'halopsa');

    const CUSTOMER_CONCURRENCY = 5;
    for (let i = 0; i < (allCustomers || []).length; i += CUSTOMER_CONCURRENCY) {
      const customerBatch = allCustomers.slice(i, i + CUSTOMER_CONCURRENCY);
      const results = await Promise.allSettled(
        customerBatch.map(async (customer) => {
          let contactCount = 0;
          let contractCount = 0;
          let ticketCount = 0;

          // ─── contacts ───
          try {
            const userData = await haloGet(`Users?client_id=${customer.external_id}&page_size=500`, config);
            const users = extractRecords(userData, 'users');

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

            if (toCreateContacts.length > 0) {
              const { error: insertErr } = await supabase.from('contacts').insert(toCreateContacts);
              if (insertErr) {
                console.error(`[HaloPSA] contacts insert failed for ${customer.name}: ${insertErr.message}`);
              } else {
                contactCount += toCreateContacts.length;
              }
            }

            const CONTACT_BATCH = 20;
            for (let j = 0; j < toUpdateContacts.length; j += CONTACT_BATCH) {
              const batch = toUpdateContacts.slice(j, j + CONTACT_BATCH);
              await Promise.allSettled(
                batch.map(item => supabase.from('contacts').update(item.data).eq('id', item.id)),
              );
              contactCount += batch.length;
            }

            await supabase.from('customers').update({ total_users: users.length }).eq('id', customer.id);
          } catch (contactErr) {
            console.error(`[HaloPSA] contacts sync error for ${customer.name}: ${contactErr.message}`);
          }

          // ─── contracts ───
          try {
            const contractData = await haloGet(`ClientContract?client_id=${customer.external_id}&pageinate=false`, config);
            const haloContracts = extractRecords(contractData, 'contracts');

            const { data: existingContracts } = await supabase
              .from('contracts')
              .select('*')
              .eq('customer_id', customer.id)
              .eq('source', 'halopsa');

            const existingByExtId = Object.fromEntries(
              (existingContracts || []).map(c => [c.external_id, c]),
            );

            const toCreateContracts = [];
            const toUpdateContracts = [];

            for (const hc of haloContracts) {
              const payload = buildContractPayload(hc, customer);
              const existing = existingByExtId[String(hc.id)];
              if (existing) {
                toUpdateContracts.push({ id: existing.id, data: payload });
              } else {
                toCreateContracts.push(payload);
              }
            }

            if (toCreateContracts.length > 0) {
              const { error: insertErr } = await supabase.from('contracts').insert(toCreateContracts);
              if (insertErr) {
                console.error(`[HaloPSA] contracts insert failed for ${customer.name}: ${insertErr.message}`);
              } else {
                contractCount += toCreateContracts.length;
              }
            }

            const CONTRACT_BATCH = 20;
            for (let j = 0; j < toUpdateContracts.length; j += CONTRACT_BATCH) {
              const batch = toUpdateContracts.slice(j, j + CONTRACT_BATCH);
              await Promise.allSettled(
                batch.map(item => supabase.from('contracts').update(item.data).eq('id', item.id)),
              );
              contractCount += batch.length;
            }
          } catch (contractErr) {
            console.error(`[HaloPSA] contracts sync error for ${customer.name}: ${contractErr.message}`);
          }

          // ─── tickets ───
          try {
            const ticketData = await haloGet(
              `Tickets?client_id=${customer.external_id}&pageinate=true&page_size=50&page_no=1&order=dateoccurred&orderdesc=true`,
              config,
            );
            const haloTickets = extractRecords(ticketData, 'tickets');
            const totalTicketCount = ticketData.record_count || ticketData.recordCount || ticketData.total_count || haloTickets.length;
            await supabase.from('customers').update({ total_tickets: totalTicketCount }).eq('id', customer.id);

            const { data: existingTickets } = await supabase
              .from('tickets')
              .select('*')
              .eq('customer_id', customer.id);

            const existingByExtId = Object.fromEntries(
              (existingTickets || []).filter(t => t.external_id).map(t => [t.external_id, t]),
            );

            const toCreateTickets = [];
            const toUpdateTickets = [];

            for (const ht of haloTickets) {
              const payload = buildTicketPayload(ht, customer.id);
              const existing = existingByExtId[String(ht.id)];
              if (existing) {
                toUpdateTickets.push({ id: existing.id, data: payload });
              } else {
                toCreateTickets.push(payload);
              }
            }

            if (toCreateTickets.length > 0) {
              const { error: insertErr } = await supabase.from('tickets').insert(toCreateTickets);
              if (insertErr) {
                console.error(`[HaloPSA] tickets insert failed for ${customer.name}: ${insertErr.message}`);
              } else {
                ticketCount += toCreateTickets.length;
              }
            }

            const TICKET_BATCH = 20;
            for (let j = 0; j < toUpdateTickets.length; j += TICKET_BATCH) {
              const batch = toUpdateTickets.slice(j, j + TICKET_BATCH);
              await Promise.allSettled(
                batch.map(item => supabase.from('tickets').update(item.data).eq('id', item.id)),
              );
              ticketCount += batch.length;
            }
          } catch (ticketErr) {
            console.error(`[HaloPSA] tickets sync error for ${customer.name}: ${ticketErr.message}`);
          }

          return { contactCount, contractCount, ticketCount };
        }),
      );

      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          contactsSynced += r.value.contactCount;
          contractsSynced += r.value.contractCount;
          ticketsSynced += r.value.ticketCount;
        } else {
          errors.push({ customer: customerBatch[idx].name, error: r.reason?.message });
        }
      });
    }

    // Update sync log
    const totalSynced = customersSynced + contactsSynced + contractsSynced + ticketsSynced;
    await supabase
      .from('sync_logs')
      .update({
        status: errors.length > 0 ? 'partial' : 'success',
        records_synced: totalSynced,
        records_failed: errors.length,
        error_message: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog.id);

    return {
      success: true,
      customersSynced,
      contactsSynced,
      contractsSynced,
      ticketsSynced,
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
