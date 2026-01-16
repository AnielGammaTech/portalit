import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    const clientId = settings.halopsa_client_id;
    const clientSecret = settings.halopsa_client_secret;
    const tenant = settings.halopsa_tenant;
    const authUrl = settings.halopsa_auth_url;
    const apiUrl = settings.halopsa_api_url;

    let accessToken;
    try {
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
        const errorText = await tokenResponse.text();
        console.error('Token response error:', tokenResponse.status, errorText);
        return Response.json({ error: `Failed to authenticate with HaloPSA: ${tokenResponse.status} - ${errorText}` }, { status: 401 });
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
      if (!accessToken) {
        console.error('No access token in response:', tokenData);
        return Response.json({ error: 'No access token received from HaloPSA' }, { status: 401 });
      }
    } catch (error) {
      console.error('Token fetch error:', error);
      return Response.json({ error: `Authentication error: ${error.message}` }, { status: 500 });
    }

    const haloPsaApi = (endpoint) => `${apiUrl.endsWith('/') ? apiUrl : apiUrl + '/'}${endpoint}`;

    const fetchHaloPSA = async (url) => {
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
    };

    if (action === 'test_connection') {
      await fetchHaloPSA(haloPsaApi('RecurringInvoice?page_number=1&page_size=1'));
      return Response.json({ success: true, message: 'HaloPSA connection successful!' });
    }

    if (action === 'sync_customer') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      const syncLog = await base44.asServiceRole.entities.SyncLog.create({
        source: 'halopsa',
        status: 'in_progress',
        sync_type: 'recurring_bills',
        started_at: new Date().toISOString()
      });

      let recordsSynced = 0;
      let recordsFailed = 0;
      const errors = [];

      try {
        // Get the customer by external_id
        const customers = await base44.asServiceRole.entities.Customer.filter({ 
          external_id: String(customer_id),
          source: 'halopsa'
        });
        const dbCustomer = customers[0];

        if (!dbCustomer) {
          throw new Error('Customer not found in database');
        }

        // Fetch recurring bills for this client
        const data = await fetchHaloPSA(haloPsaApi(`RecurringInvoice?client_id=${customer_id}&page_size=1000`));
        const recurringBills = Array.isArray(data) ? data : (data.invoices || data.recurringInvoices || []);

        for (const bill of recurringBills) {
          try {
            const existingBill = (await base44.asServiceRole.entities.RecurringBill.filter({ 
              halopsa_id: String(bill.id),
              customer_id: dbCustomer.id
            }))[0];

            const billPayload = {
              customer_id: dbCustomer.id,
              halopsa_id: String(bill.id),
              name: bill.name || bill.Name || `Bill ${bill.id}`,
              description: bill.description || bill.Description || '',
              amount: parseFloat(bill.value || bill.Value || 0) || 0,
              frequency: (bill.frequency || bill.Frequency || 'monthly').toLowerCase(),
              status: bill.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active',
              start_date: bill.startdate || bill.StartDate || null,
              end_date: bill.enddate || bill.EndDate || null
            };

            if (existingBill) {
              await base44.asServiceRole.entities.RecurringBill.update(existingBill.id, billPayload);
            } else {
              await base44.asServiceRole.entities.RecurringBill.create(billPayload);
            }
            recordsSynced++;
          } catch (itemError) {
            recordsFailed++;
            errors.push(`Bill ${bill.id}: ${itemError.message}`);
          }
        }

        await base44.asServiceRole.entities.SyncLog.update(syncLog.id, {
          status: recordsFailed === 0 ? 'success' : 'partial',
          records_synced: recordsSynced,
          records_failed: recordsFailed,
          error_message: errors.length > 0 ? JSON.stringify(errors) : null,
          completed_at: new Date().toISOString()
        });

        return Response.json({
          success: true,
          recordsSynced,
          recordsFailed,
          message: `Synced ${recordsSynced} recurring bills`
        });
      } catch (error) {
        await base44.asServiceRole.entities.SyncLog.update(syncLog.id, {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        });
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    if (action === 'sync_now') {
      const syncLog = await base44.asServiceRole.entities.SyncLog.create({
        source: 'halopsa',
        status: 'in_progress',
        sync_type: 'recurring_bills',
        started_at: new Date().toISOString()
      });

      let recordsSynced = 0;
      let recordsFailed = 0;
      const errors = [];
      let pageNumber = 1;
      const pageSize = 100;
      let hasMore = true;

      try {
        const allCustomers = await base44.asServiceRole.entities.Customer.list();
        const existingBills = await base44.asServiceRole.entities.RecurringBill.list('-created_date', 500);
        const customerMap = new Map(allCustomers.map(c => [`${c.external_id}:halopsa`, c.id]));
        const billMap = new Map(existingBills.map(b => [`${b.halopsa_id}:${b.customer_id}`, b.id]));
        
        const allToCreate = [];
        const allToUpdate = [];

        while (hasMore) {
          const data = await fetchHaloPSA(haloPsaApi(`RecurringInvoice?page_number=${pageNumber}&page_size=500`));
          let recurringBills = [];
          
          if (Array.isArray(data)) {
            recurringBills = data;
          } else if (data.invoices) {
            recurringBills = data.invoices;
          } else if (data.recurringInvoices) {
            recurringBills = data.recurringInvoices;
          } else if (data.pageDetails && data.pageDetails.pageResult) {
            recurringBills = data.pageDetails.pageResult;
          } else if (data.records) {
            recurringBills = data.records;
          }

          if (recurringBills.length === 0) {
            hasMore = false;
            break;
          }

          for (const bill of recurringBills) {
            try {
              console.log('Bill fields:', Object.keys(bill), 'Bill data:', JSON.stringify(bill));
              const customerId = customerMap.get(`${bill.client_id || bill.ClientID}:halopsa`);
              if (!customerId) {
                recordsFailed++;
                continue;
              }

              const billPayload = {
                customer_id: customerId,
                halopsa_id: String(bill.id),
                name: bill.name || bill.Name || `Bill ${bill.id}`,
                description: bill.description || bill.Description || '',
                amount: parseFloat(bill.value || bill.Value || bill.total || bill.Total || 0) || 0,
                frequency: (bill.frequency || bill.Frequency || 'monthly').toLowerCase(),
                status: bill.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active',
                start_date: bill.startdate || bill.StartDate || null,
                end_date: bill.enddate || bill.EndDate || null
              };

              const billKey = `${bill.id}:${customerId}`;
              const existingId = billMap.get(billKey);
              if (existingId) {
                allToUpdate.push({ id: existingId, data: billPayload });
              } else {
                allToCreate.push(billPayload);
              }
            } catch (itemError) {
              recordsFailed++;
              errors.push(`Bill ${bill.id}: ${itemError.message}`);
            }
          }

          if (recurringBills.length < 500) {
            hasMore = false;
          } else {
            pageNumber++;
          }
        }

        if (allToCreate.length > 0) {
          await base44.asServiceRole.entities.RecurringBill.bulkCreate(allToCreate);
          recordsSynced += allToCreate.length;
        }

        for (const { id, data } of allToUpdate) {
          await base44.asServiceRole.entities.RecurringBill.update(id, data);
          recordsSynced++;
        }

        await base44.asServiceRole.entities.SyncLog.update(syncLog.id, {
          status: recordsFailed === 0 ? 'success' : 'partial',
          records_synced: recordsSynced,
          records_failed: recordsFailed,
          error_message: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
          completed_at: new Date().toISOString()
        });

        return Response.json({
          success: true,
          recordsSynced,
          recordsFailed,
          message: `Synced ${recordsSynced} recurring bills`
        });
      } catch (error) {
        await base44.asServiceRole.entities.SyncLog.update(syncLog.id, {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        });
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});