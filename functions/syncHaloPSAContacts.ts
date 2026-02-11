import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Supports actions: sync_customer, delete_customer_contacts
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, customer_id } = body;

    const settings = (await base44.asServiceRole.entities.Settings.list())[0];
    if (!settings) {
      return Response.json({ error: 'HaloPSA settings not configured' }, { status: 400 });
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
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      // Find customer in database
      const customers = await base44.asServiceRole.entities.Customer.filter({ 
        external_id: String(customer_id),
        source: 'halopsa'
      });
      const dbCustomer = customers[0];
      if (!dbCustomer) {
        return Response.json({ error: 'Customer not found in database' }, { status: 404 });
      }

      // Step 1: Get all existing contacts for this customer BEFORE sync
      const existingContacts = await base44.asServiceRole.entities.Contact.filter({ 
        customer_id: dbCustomer.id 
      });
      const existingContactMap = new Map(existingContacts.map(c => [c.halopsa_id, c]));
      console.log(`Found ${existingContacts.length} existing contacts in database`);

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
            await base44.asServiceRole.entities.Contact.update(existing.id, contactPayload);
          } else {
            await base44.asServiceRole.entities.Contact.create(contactPayload);
          }

          recordsSynced++;
        } catch (err) {
          console.log(`Error syncing user ${haloUser.id}: ${err.message}`);
          recordsFailed++;
        }
      }

      // Step 4: Identify contacts that exist in app but NOT in HaloPSA (removed from HaloPSA)
      const missingContacts = existingContacts.filter(c => c.halopsa_id && !syncedHaloPSAIds.has(c.halopsa_id));
      console.log(`Found ${missingContacts.length} contacts in app that are no longer in HaloPSA`);

      let recordsDeleted = 0;
      let recordsFlagged = 0;

      // Step 5: For each missing contact, check for license assignments
      for (const contact of missingContacts) {
        try {
          const licenseAssignments = await base44.asServiceRole.entities.LicenseAssignment.filter({
            contact_id: contact.id,
            status: 'active'
          });

          if (licenseAssignments.length > 0) {
            // Contact has active licenses - create notification/activity, don't delete
            await base44.asServiceRole.entities.Activity.create({
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
            });
            console.log(`Flagged contact ${contact.full_name} - has ${licenseAssignments.length} active licenses`);
            recordsFlagged++;
          } else {
            // No active licenses - safe to delete
            await base44.asServiceRole.entities.Contact.delete(contact.id);
            console.log(`Deleted contact ${contact.full_name} - no active licenses`);
            recordsDeleted++;
          }
        } catch (err) {
          console.log(`Error processing missing contact ${contact.id}: ${err.message}`);
        }
      }

      // Step 6: Update customer total_users count to reflect HaloPSA count
      await base44.asServiceRole.entities.Customer.update(dbCustomer.id, {
        total_users: users.length
      });

      return Response.json({
        success: true,
        recordsSynced,
        recordsFailed,
        recordsDeleted,
        recordsFlagged,
        haloUserCount: users.length,
        message: `Synced ${recordsSynced} users, deleted ${recordsDeleted}, flagged ${recordsFlagged} with active licenses`
      });
    }

    if (action === 'delete_customer_contacts') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      // Delete all contacts for this customer
      const contacts = await base44.asServiceRole.entities.Contact.filter({ customer_id });
      let deleted = 0;
      for (const contact of contacts) {
        await base44.asServiceRole.entities.Contact.delete(contact.id);
        deleted++;
      }

      return Response.json({
        success: true,
        deleted,
        message: `Deleted ${deleted} contacts`
      });
    }

    return Response.json({ error: 'Invalid action. Use: sync_customer or delete_customer_contacts' }, { status: 400 });
  } catch (error) {
    console.log(`Error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});