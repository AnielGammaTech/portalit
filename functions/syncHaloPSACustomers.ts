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
        // Fetch Clients (Customers)
        const clientsData = await fetchHaloPSA(haloPsaApi('Client'));
        const clients = Array.isArray(clientsData) ? clientsData : clientsData.clients || clientsData.pageDetails?.pageResult || [];

        for (const client of clients) {
          if (excludedIds.includes(String(client.id))) continue;

          const existingCustomer = (await base44.asServiceRole.entities.Customer.filter({ external_id: String(client.id), source: 'halopsa' }))[0];
          const customerData = {
            name: client.name || client.Name || `Customer ${client.id}`,
            external_id: String(client.id),
            source: 'halopsa',
            status: !client.inactive ? 'active' : 'inactive',
            primary_contact: client.primary_contact_name || client.PrimaryContactName || '',
            email: client.primary_contact_email || client.PrimaryContactEmail || '',
            phone: client.primary_contact_phone || client.PrimaryContactPhone || '',
            address: (client.address1 || client.Address1 || '') + (client.address2 || client.Address2 ? ` ${client.address2}` : '') + (client.postcode || client.Postcode ? ` ${client.postcode}` : '')
          };

          let customerId;
          if (existingCustomer) {
            await base44.asServiceRole.entities.Customer.update(existingCustomer.id, customerData);
            customerId = existingCustomer.id;
          } else {
            const newCustomer = await base44.asServiceRole.entities.Customer.create(customerData);
            customerId = newCustomer.id;
          }
          recordsSynced++;

          // Fetch Sites for this Client
          try {
            const sitesData = await fetchHaloPSA(haloPsaApi(`Site?client_id=${client.id}`));
            const sites = Array.isArray(sitesData) ? sitesData : sitesData.sites || [];
            
            for (const site of sites) {
              if (excludedIds.includes(String(site.id))) continue;
              const existingSite = (await base44.asServiceRole.entities.Site.filter({ halopsa_id: String(site.id) }))[0];
              const siteData = {
                customer_id: customerId,
                halopsa_id: String(site.id),
                name: site.name || site.Name || `Site ${site.id}`,
                address: (site.address1 || site.Address1 || '') + (site.address2 || site.Address2 ? ` ${site.address2}` : '') + (site.postcode || site.Postcode ? ` ${site.postcode}` : ''),
                contact_name: site.contact_name || site.ContactName || '',
                contact_email: site.contact_email || site.ContactEmail || '',
                contact_phone: site.contact_phone || site.ContactPhone || ''
              };
              if (existingSite) {
                await base44.asServiceRole.entities.Site.update(existingSite.id, siteData);
              } else {
                await base44.asServiceRole.entities.Site.create(siteData);
              }
              recordsSynced++;
            }
          } catch (siteError) {
            // Skip sites if endpoint fails
          }

          // Skip users - endpoint not available, causes rate limiting issues

          // Fetch Contracts (Recurring Bills) for this Client
          try {
            const contractsData = await fetchHaloPSA(haloPsaApi(`RecurringInvoice?client_id=${client.id}`));
            const contracts = Array.isArray(contractsData) ? contractsData : contractsData.recurringinvoices || contractsData.invoices || contractsData.contracts || [];
            
            for (const contract of contracts) {
              if (excludedIds.includes(String(contract.id))) continue;
              const existingBill = (await base44.asServiceRole.entities.RecurringBill.filter({ halopsa_id: String(contract.id) }))[0];
              const billData = {
                customer_id: customerId,
                halopsa_id: String(contract.id),
                name: contract.name || contract.ContractName || `Contract ${contract.id}`,
                description: contract.description || contract.ContractDescription || '',
                amount: contract.value || contract.Value || 0,
                currency: 'USD',
                frequency: 'monthly',
                start_date: contract.start_date || contract.StartDate,
                end_date: contract.end_date || contract.EndDate,
                status: contract.active !== false ? 'active' : 'inactive'
              };
              if (existingBill) {
                await base44.asServiceRole.entities.RecurringBill.update(existingBill.id, billData);
              } else {
                await base44.asServiceRole.entities.RecurringBill.create(billData);
              }
              recordsSynced++;
            }
          } catch (contractError) {
            // Skip contracts if endpoint fails
          }
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