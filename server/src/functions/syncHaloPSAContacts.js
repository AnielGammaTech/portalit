import { getServiceSupabase } from '../lib/supabase.js';

// Helper: Authenticate with HaloPSA
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
  await new Promise(resolve => setTimeout(resolve, 300));
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
    is_primary: haloUser.isprimarycontact || false
  };
}

// Supports actions: sync_customer, delete_customer_contacts
export async function syncHaloPSAContacts(body, user) {
  const supabase = getServiceSupabase();

  const { action, customer_id } = body;

  const { data: settingsList } = await supabase.from('settings').select('*');
  const settings = (settingsList || [])[0];
  if (!settings) {
    const err = new Error('HaloPSA settings not configured');
    err.statusCode = 400;
    throw err;
  }

  const accessToken = await authenticateWithHaloPSA(
    settings.halopsa_auth_url,
    settings.halopsa_client_id,
    settings.halopsa_client_secret
  );

  const apiUrl = settings.halopsa_api_url;
  const haloClientId = settings.halopsa_client_id;

  if (action === 'sync_customer') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    // Find customer in database
    let customerQuery = supabase.from('customers').select('*');
    customerQuery = customerQuery.eq('external_id', String(customer_id));
    customerQuery = customerQuery.eq('source', 'halopsa');
    const { data: customers } = await customerQuery;
    const dbCustomer = (customers || [])[0];
    if (!dbCustomer) {
      const err = new Error('Customer not found in database');
      err.statusCode = 404;
      throw err;
    }

    // Step 1: Get all existing contacts for this customer BEFORE sync
    const { data: existingContacts } = await supabase.from('contacts').select('*').eq('customer_id', dbCustomer.id);
    const existingContactMap = new Map((existingContacts || []).map(c => [c.halopsa_id, c]));
    console.log(`Found ${(existingContacts || []).length} existing contacts in database`);

    // Step 2: Fetch users/contacts from HaloPSA for this client
    const url = buildUrl(apiUrl, `Users?client_id=${customer_id}&page_size=500`);
    const data = await fetchHalo(url, accessToken, haloClientId);
    console.log(`Users response sample: ${JSON.stringify(data).substring(0, 1500)}`);

    let users = [];
    if (Array.isArray(data)) {
      users = data;
    } else if (data.users) {
      users = data.users;
    } else if (data.records) {
      users = data.records;
    }

    console.log(`Found ${users.length} users in HaloPSA for client ${customer_id}`);

    // Track which HaloPSA IDs we've seen
    const syncedHaloPSAIds = new Set();

    let recordsSynced = 0;
    let recordsFailed = 0;

    // Step 3: Sync contacts from HaloPSA (create/update)
    for (const haloUser of users) {
      try {
        const haloPSAId = String(haloUser.id);
        syncedHaloPSAIds.add(haloPSAId);

        const contactPayload = transformContact(haloUser, dbCustomer.id);

        const existing = existingContactMap.get(haloPSAId);

        if (existing) {
          await supabase.from('contacts').update(contactPayload).eq('id', existing.id).select().single();
        } else {
          const { error } = await supabase.from('contacts').insert(contactPayload).select().single();
          if (error) throw new Error(error.message);
        }

        recordsSynced++;
      } catch (err) {
        console.log(`Error syncing user ${haloUser.id}: ${err.message}`);
        recordsFailed++;
      }
    }

    // Step 4: Identify contacts that exist in app but NOT in HaloPSA (removed from HaloPSA)
    const missingContacts = (existingContacts || []).filter(c => c.halopsa_id && !syncedHaloPSAIds.has(c.halopsa_id));
    console.log(`Found ${missingContacts.length} contacts in app that are no longer in HaloPSA`);

    let recordsDeleted = 0;
    let recordsFlagged = 0;

    // Step 5: For each missing contact, check for license assignments
    for (const contact of missingContacts) {
      try {
        let licenseQuery = supabase.from('license_assignments').select('*');
        licenseQuery = licenseQuery.eq('contact_id', contact.id);
        licenseQuery = licenseQuery.eq('status', 'active');
        const { data: licenseAssignments } = await licenseQuery;

        if ((licenseAssignments || []).length > 0) {
          // Contact has active licenses - create notification/activity, don't delete
          const { error } = await supabase.from('activities').insert({
            type: 'license_revoked', // Using existing type that fits
            title: 'User Removed from HaloPSA with Active Licenses',
            description: `${contact.full_name} (${contact.email || 'no email'}) has been removed from HaloPSA but still has ${licenseAssignments.length} active license(s) assigned.`,
            entity_type: 'customer',
            entity_id: dbCustomer.id,
            entity_name: dbCustomer.name,
            metadata: JSON.stringify({
              contact_id: contact.id,
              contact_name: contact.full_name,
              contact_email: contact.email,
              license_count: licenseAssignments.length,
              action_needed: 'Review and revoke licenses if appropriate'
            })
          }).select().single();
          if (error) throw new Error(error.message);
          console.log(`Flagged contact ${contact.full_name} - has ${licenseAssignments.length} active licenses`);
          recordsFlagged++;
        } else {
          // No active licenses - safe to delete
          await supabase.from('contacts').delete().eq('id', contact.id);
          console.log(`Deleted contact ${contact.full_name} - no active licenses`);
          recordsDeleted++;
        }
      } catch (err) {
        console.log(`Error processing missing contact ${contact.id}: ${err.message}`);
      }
    }

    // Step 6: Update customer total_users count to reflect HaloPSA count
    await supabase.from('customers').update({
      total_users: users.length
    }).eq('id', dbCustomer.id).select().single();

    return {
      success: true,
      recordsSynced,
      recordsFailed,
      recordsDeleted,
      recordsFlagged,
      haloUserCount: users.length,
      message: `Synced ${recordsSynced} users, deleted ${recordsDeleted}, flagged ${recordsFlagged} with active licenses`
    };
  }

  if (action === 'delete_customer_contacts') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    // Delete all contacts for this customer
    const { data: contacts } = await supabase.from('contacts').select('*').eq('customer_id', customer_id);
    let deleted = 0;
    for (const contact of (contacts || [])) {
      await supabase.from('contacts').delete().eq('id', contact.id);
      deleted++;
    }

    return {
      success: true,
      deleted,
      message: `Deleted ${deleted} contacts`
    };
  }

  const err = new Error('Invalid action. Use: sync_customer or delete_customer_contacts');
  err.statusCode = 400;
  throw err;
}
