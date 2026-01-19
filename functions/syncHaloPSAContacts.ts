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

      // Fetch users/contacts from HaloPSA for this client
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

      console.log(`Found ${users.length} users for client ${customer_id}`);

      let recordsSynced = 0;
      let recordsFailed = 0;

      for (const haloUser of users) {
        try {
          const contactPayload = transformContact(haloUser, dbCustomer.id);

          const existing = await base44.asServiceRole.entities.Contact.filter({ 
            halopsa_id: String(haloUser.id),
            customer_id: dbCustomer.id
          });

          if (existing.length > 0) {
            await base44.asServiceRole.entities.Contact.update(existing[0].id, contactPayload);
          } else {
            await base44.asServiceRole.entities.Contact.create(contactPayload);
          }

          recordsSynced++;
        } catch (err) {
          console.log(`Error syncing user ${haloUser.id}: ${err.message}`);
          recordsFailed++;
        }
      }

      // Update customer total_users count
      await base44.asServiceRole.entities.Customer.update(dbCustomer.id, {
        total_users: users.length
      });

      return Response.json({
        success: true,
        recordsSynced,
        recordsFailed,
        message: `Synced ${recordsSynced} users`
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