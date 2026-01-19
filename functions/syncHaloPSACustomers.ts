import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { action } = await req.json();

    const settingsList = await base44.asServiceRole.entities.Settings.list();
    const settings = settingsList[0];
    
    if (!settings) {
      return Response.json({ error: 'HaloPSA settings are not configured.' }, { status: 400 });
    }

    const { halopsa_client_id, halopsa_client_secret, halopsa_auth_url, halopsa_api_url, halopsa_excluded_ids } = settings;
    const excludedIds = halopsa_excluded_ids ? halopsa_excluded_ids.split(',').map(id => id.trim()) : [];

    // Get Access Token
    const tokenResponse = await fetch(halopsa_auth_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: halopsa_client_id,
        client_secret: halopsa_client_secret,
        scope: 'all'
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to get HaloPSA access token: ${tokenResponse.status} - ${errorText}`);
    }
    const { access_token } = await tokenResponse.json();

    const haloPsaApi = (endpoint) => `${halopsa_api_url.endsWith('/') ? halopsa_api_url : halopsa_api_url + '/'}${endpoint}`;

    const fetchHaloPSA = async (url) => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Add rate limit delay
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Client-ID': halopsa_client_id
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HaloPSA API Error (${url}): ${response.status} - ${errorText}`);
      }
      return response.json();
    };

    if (action === 'test_connection') {
      await fetchHaloPSA(haloPsaApi('Client'));
      return Response.json({ success: true, message: 'HaloPSA connection successful!' });
    }

    if (action === 'sync_customer') {
      const { customer_id } = body;

      const syncLog = await base44.asServiceRole.entities.SyncLog.create({
        source: 'halopsa',
        status: 'in_progress',
        sync_type: 'customers',
        started_at: new Date().toISOString()
      });

      let recordsSynced = 0;
      const errors = [];

      try {
        const clientData = await fetchHaloPSA(haloPsaApi(`Client/${customer_id}`));
        const client = clientData;

        const existingCustomer = (await base44.asServiceRole.entities.Customer.filter({ external_id: String(client.id), source: 'halopsa' }))[0];
        // Build full address
        const addressParts = [
          client.address1 || client.Address1 || '',
          client.address2 || client.Address2 || '',
          client.city || client.City || '',
          client.state || client.State || '',
          client.postcode || client.Postcode || '',
          client.country || client.Country || ''
        ].filter(Boolean);
        const fullAddress = addressParts.join(', ');

        const customerData = {
          name: client.name || client.Name || `Customer ${client.id}`,
          external_id: String(client.id),
          source: 'halopsa',
          status: !client.inactive ? 'active' : 'inactive',
          primary_contact: client.main_contact_name || client.primary_contact_name || client.PrimaryContactName || '',
          email: client.main_email_address || client.primary_contact_email || client.PrimaryContactEmail || client.email || '',
          phone: client.main_contact_phone || client.primary_contact_phone || client.PrimaryContactPhone || client.phonenumber || '',
          address: fullAddress,
          notes: client.notes || client.Notes || ''
        };

        if (existingCustomer) {
          await base44.asServiceRole.entities.Customer.update(existingCustomer.id, customerData);
        } else {
          await base44.asServiceRole.entities.Customer.create(customerData);
        }
        recordsSynced = 1;

        await base44.asServiceRole.entities.SyncLog.update(syncLog.id, {
          status: 'success',
          records_synced: recordsSynced,
          completed_at: new Date().toISOString()
        });

        return Response.json({ success: true, message: 'Customer synced successfully', recordsSynced });
      } catch (syncError) {
        errors.push(syncError.message);
        await base44.asServiceRole.entities.SyncLog.update(syncLog.id, {
          status: 'failed',
          error_message: JSON.stringify(errors),
          completed_at: new Date().toISOString()
        });
        return Response.json({ success: false, message: 'Customer sync failed', error: syncError.message }, { status: 500 });
      }
    }

    if (action === 'sync_now') {
      const syncLog = await base44.asServiceRole.entities.SyncLog.create({
        source: 'halopsa',
        status: 'in_progress',
        sync_type: 'full',
        started_at: new Date().toISOString()
      });

      let recordsSynced = 0;
      let recordsFailed = 0;
      const errors = [];

      try {
        // Fetch all active Clients with pagination
        let allClients = [];
        let pageNumber = 1;
        const pageSize = 1000;
        
        while (true) {
          // HaloPSA uses pageinate, page_size, page_no params
          const url = haloPsaApi(`Client?pageinate=true&page_size=${pageSize}&page_no=${pageNumber}&isactive=true`);
          console.log(`Fetching page ${pageNumber}: ${url}`);
          const clientsData = await fetchHaloPSA(url);
          
          // Handle different response formats
          const clients = Array.isArray(clientsData) ? clientsData : 
                          clientsData.clients || clientsData.records || clientsData.Clients || [];
          
          console.log(`Page ${pageNumber}: Got ${clients.length} clients`);
          
          if (!clients || clients.length === 0) break;
          allClients = allClients.concat(clients);
          
          // Check if we've fetched all records
          const totalCount = clientsData.record_count || clientsData.recordCount || clientsData.total_count || 0;
          console.log(`Total so far: ${allClients.length}, API total: ${totalCount}`);
          
          if (clients.length < pageSize) break;
          if (totalCount > 0 && allClients.length >= totalCount) break;
          pageNumber++;
          
          // Safety limit
          if (pageNumber > 20) break;
        }
        
        console.log(`Total clients fetched: ${allClients.length}`);

        // Get all existing customers in one call
        const existingCustomers = await base44.asServiceRole.entities.Customer.filter({ source: 'halopsa' });
        const existingByExternalId = {};
        for (const c of existingCustomers) {
          existingByExternalId[c.external_id] = c;
        }

        const toCreate = [];
        const toUpdate = [];

        for (const client of allClients) {
          if (excludedIds.includes(String(client.id))) continue;

          // Build full address
          const addressParts = [
            client.address1 || client.Address1 || '',
            client.address2 || client.Address2 || '',
            client.city || client.City || '',
            client.state || client.State || '',
            client.postcode || client.Postcode || '',
            client.country || client.Country || ''
          ].filter(Boolean);
          const fullAddress = addressParts.join(', ');

          const customerData = {
            name: client.name || client.Name || `Customer ${client.id}`,
            external_id: String(client.id),
            source: 'halopsa',
            status: !client.inactive ? 'active' : 'inactive',
            primary_contact: client.main_contact_name || client.primary_contact_name || client.PrimaryContactName || '',
            email: client.main_email_address || client.primary_contact_email || client.PrimaryContactEmail || client.email || '',
            phone: client.main_contact_phone || client.primary_contact_phone || client.PrimaryContactPhone || client.phonenumber || '',
            address: fullAddress,
            notes: client.notes || client.Notes || ''
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
          await base44.asServiceRole.entities.Customer.bulkCreate(toCreate);
          recordsSynced += toCreate.length;
        }

        // Update existing customers (one by one as no bulk update)
        for (const item of toUpdate) {
          await base44.asServiceRole.entities.Customer.update(item.id, item.data);
          recordsSynced++;
        }

        await base44.asServiceRole.entities.SyncLog.update(syncLog.id, {
          status: errors.length > 0 ? 'partial' : 'success',
          records_synced: recordsSynced,
          records_failed: recordsFailed,
          error_message: errors.length > 0 ? JSON.stringify(errors) : null,
          completed_at: new Date().toISOString()
        });

        return Response.json({ success: true, message: 'HaloPSA sync completed', recordsSynced, recordsFailed });

      } catch (syncError) {
        errors.push(syncError.message);
        await base44.asServiceRole.entities.SyncLog.update(syncLog.id, {
          status: 'failed',
          records_synced: recordsSynced,
          records_failed: recordsFailed,
          error_message: JSON.stringify(errors),
          completed_at: new Date().toISOString()
        });
        return Response.json({ success: false, message: 'HaloPSA sync failed', error: syncError.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});