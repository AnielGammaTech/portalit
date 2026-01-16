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
      const tokenResponse = await fetch(`${authUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'api'
        })
      });

      if (!tokenResponse.ok) {
        return Response.json({ error: 'Failed to authenticate with HaloPSA' }, { status: 401 });
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
    } catch (error) {
      return Response.json({ error: `Authentication error: ${error.message}` }, { status: 500 });
    }

    const haloPsaApi = (endpoint) => `${apiUrl}/${endpoint}`;

    let requestCount = 0;
    const fetchHaloPSA = async (url) => {
      requestCount++;
      if (requestCount > 1 && requestCount % 25 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Tenant': tenant
        }
      });

      if (!response.ok) {
        throw new Error(`HaloPSA API error: ${response.status}`);
      }

      return await response.json();
    };

    if (action === 'test_connection') {
      await fetchHaloPSA(haloPsaApi('RecurringBill?pageSize=1'));
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
        const data = await fetchHaloPSA(haloPsaApi(`RecurringBill?clientid=${customer_id}&pageSize=1000`));
        const recurringBills = data.recurringbills || data || [];

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
        while (hasMore) {
          const data = await fetchHaloPSA(haloPsaApi(`RecurringBill?pageNumber=${pageNumber}&pageSize=${pageSize}`));
          const recurringBills = data.recurringbills || data || [];

          if (recurringBills.length === 0) {
            hasMore = false;
            break;
          }

          for (const bill of recurringBills) {
            try {
              const customers = await base44.asServiceRole.entities.Customer.filter({ 
                external_id: String(bill.clientid || bill.ClientID),
                source: 'halopsa'
              });
              const customerId = customers[0]?.id;

              if (!customerId) {
                recordsFailed++;
                continue;
              }

              const existingBill = (await base44.asServiceRole.entities.RecurringBill.filter({ 
                halopsa_id: String(bill.id),
                customer_id: customerId
              }))[0];

              const billPayload = {
                customer_id: customerId,
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

          if (recurringBills.length < pageSize) {
            hasMore = false;
          } else {
            pageNumber++;
          }
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