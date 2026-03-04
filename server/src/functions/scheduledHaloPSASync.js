import { getServiceSupabase } from '../lib/supabase.js';

async function authenticateWithHaloPSA(authUrl, clientId, clientSecret) {
  const tokenResponse = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'all'
    })
  });

  if (!tokenResponse.ok) {
    throw new Error(`HaloPSA auth failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function buildUrl(baseUrl, endpoint) {
  return `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}${endpoint}`;
}

async function fetchHalo(url, accessToken, clientId) {
  await new Promise(resolve => setTimeout(resolve, 500));
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-ID': clientId
    }
  });
  if (!response.ok) {
    throw new Error(`HaloPSA API error: ${response.status}`);
  }
  return await response.json();
}

function transformContact(haloUser, customerId) {
  return {
    customer_id: customerId,
    halopsa_id: String(haloUser.id),
    full_name: haloUser.name || `${haloUser.firstname || ''} ${haloUser.surname || ''}`.trim() || 'Unknown',
    email: haloUser.emailaddress || haloUser.email || '',
    phone: haloUser.phonenumber || haloUser.phone || '',
    title: haloUser.jobtitle || '',
    is_primary: haloUser.isprimarycontact || false,
    source: 'halopsa'
  };
}

export async function scheduledHaloPSASync(body, user) {
  const supabase = getServiceSupabase();

  // Get settings
  const { data: settingsList } = await supabase.from('settings').select('*');
  const settings = (settingsList || [])[0];
  if (!settings || !settings.halopsa_client_id) {
    return { success: false, error: 'HaloPSA settings not configured' };
  }

  const accessToken = await authenticateWithHaloPSA(
    settings.halopsa_auth_url,
    settings.halopsa_client_id,
    settings.halopsa_client_secret
  );

  const apiUrl = settings.halopsa_api_url;
  const haloClientId = settings.halopsa_client_id;
  const excludedIds = settings.halopsa_excluded_ids ? settings.halopsa_excluded_ids.split(',').map(id => id.trim()) : [];

  // Create sync log
  const { data: syncLog, error: syncLogError } = await supabase.from('sync_logs').insert({
    source: 'halopsa',
    status: 'in_progress',
    sync_type: 'full',
    started_at: new Date().toISOString()
  }).select().single();
  if (syncLogError) throw new Error(syncLogError.message);

  let customersSynced = 0;
  let contactsSynced = 0;
  let errors = [];

  try {
    // ========== SYNC CUSTOMERS ==========
    let allClients = [];
    let pageNumber = 1;
    const pageSize = 1000;

    while (true) {
      const url = buildUrl(apiUrl, `Client?pageinate=true&page_size=${pageSize}&page_no=${pageNumber}&isactive=true`);
      const clientsData = await fetchHalo(url, accessToken, haloClientId);

      const clients = Array.isArray(clientsData) ? clientsData :
                      clientsData.clients || clientsData.records || clientsData.Clients || [];

      if (!clients || clients.length === 0) break;
      allClients = allClients.concat(clients);

      const totalCount = clientsData.record_count || clientsData.recordCount || 0;
      if (clients.length < pageSize) break;
      if (totalCount > 0 && allClients.length >= totalCount) break;
      pageNumber++;
      if (pageNumber > 20) break;
    }

    // Get existing customers
    let existingQuery = supabase.from('customers').select('*');
    existingQuery = existingQuery.eq('source', 'halopsa');
    const { data: existingCustomers } = await existingQuery;
    const existingByExternalId = {};
    (existingCustomers || []).forEach(c => { existingByExternalId[c.external_id] = c; });

    const toCreate = [];
    const toUpdate = [];

    for (const client of allClients) {
      if (excludedIds.includes(String(client.id))) continue;
      if (client.inactive === true) continue;

      const addressParts = [
        client.address1 || '', client.address2 || '', client.city || '',
        client.state || '', client.postcode || '', client.country || ''
      ].filter(Boolean);

      const customerData = {
        name: client.name || client.Name || `Customer ${client.id}`,
        external_id: String(client.id),
        source: 'halopsa',
        status: !client.inactive ? 'active' : 'inactive',
        primary_contact: client.main_contact_name || client.primary_contact_name || '',
        email: client.main_email_address || client.primary_contact_email || client.email || '',
        phone: client.main_contact_phone || client.primary_contact_phone || client.phonenumber || '',
        address: addressParts.join(', '),
        notes: client.notes || ''
      };

      const existing = existingByExternalId[String(client.id)];
      if (existing) {
        toUpdate.push({ id: existing.id, data: customerData });
      } else {
        toCreate.push(customerData);
      }
    }

    // Bulk create new customers
    if (toCreate.length > 0) {
      const { error } = await supabase.from('customers').insert(toCreate).select();
      if (error) throw new Error(error.message);
      customersSynced += toCreate.length;
    }

    // Update existing customers
    for (const item of toUpdate) {
      await supabase.from('customers').update(item.data).eq('id', item.id).select().single();
      customersSynced++;
    }

    // ========== SYNC CONTACTS FOR EACH CUSTOMER ==========
    // Refresh customer list after creates
    const { data: allCustomers } = await supabase.from('customers').select('*').eq('source', 'halopsa');

    for (const customer of (allCustomers || [])) {
      try {
        const url = buildUrl(apiUrl, `Users?client_id=${customer.external_id}&page_size=500`);
        const data = await fetchHalo(url, accessToken, haloClientId);

        let users = [];
        if (Array.isArray(data)) {
          users = data;
        } else if (data.users) {
          users = data.users;
        } else if (data.records) {
          users = data.records;
        }

        // Get existing contacts for this customer
        const { data: existingContacts } = await supabase.from('contacts').select('*').eq('customer_id', customer.id);
        const existingByHaloId = {};
        (existingContacts || []).forEach(c => { if (c.halopsa_id) existingByHaloId[c.halopsa_id] = c; });

        for (const haloUser of users) {
          const contactPayload = transformContact(haloUser, customer.id);
          const existing = existingByHaloId[String(haloUser.id)];

          if (existing) {
            await supabase.from('contacts').update(contactPayload).eq('id', existing.id).select().single();
          } else {
            const { error } = await supabase.from('contacts').insert(contactPayload).select().single();
            if (error) throw new Error(error.message);
          }
          contactsSynced++;
        }

        // Update customer total_users
        await supabase.from('customers').update({
          total_users: users.length
        }).eq('id', customer.id).select().single();
      } catch (e) {
        errors.push({ customer: customer.name, error: e.message });
      }
    }

    // Update sync log
    await supabase.from('sync_logs').update({
      status: errors.length > 0 ? 'partial' : 'success',
      records_synced: customersSynced + contactsSynced,
      records_failed: errors.length,
      error_message: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
      completed_at: new Date().toISOString(),
      details: `Customers: ${customersSynced}, Contacts: ${contactsSynced}`
    }).eq('id', syncLog.id).select().single();

    return {
      success: true,
      customersSynced,
      contactsSynced,
      errors: errors.length,
      totalCustomers: allClients.length
    };

  } catch (syncError) {
    await supabase.from('sync_logs').update({
      status: 'failed',
      error_message: syncError.message,
      completed_at: new Date().toISOString()
    }).eq('id', syncLog.id).select().single();
    return { success: false, error: syncError.message };
  }
}
