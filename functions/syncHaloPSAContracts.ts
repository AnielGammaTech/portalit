import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

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
      await fetchHaloPSA(haloPsaApi('Contract?pageSize=1'));
      return Response.json({ success: true, message: 'HaloPSA connection successful!' });
    }

    if (action === 'sync_contract') {
      const { contract_id } = body;

      const syncLog = await base44.asServiceRole.entities.SyncLog.create({
        source: 'halopsa',
        status: 'in_progress',
        sync_type: 'contracts',
        started_at: new Date().toISOString()
      });

      let recordsSynced = 0;
      const errors = [];

      try {
        const contractData = await fetchHaloPSA(haloPsaApi(`Contract/${contract_id}`));
        const contract = contractData;

        const existingContract = (await base44.asServiceRole.entities.Contract.filter({ 
          external_id: String(contract.id), 
          source: 'halopsa' 
        }))[0];

        const customers = await base44.asServiceRole.entities.Customer.filter({ 
          external_id: String(contract.clientid || contract.ClientID),
          source: 'halopsa'
        });
        const customerId = customers[0]?.id;

        if (!customerId) {
          throw new Error('Associated customer not found');
        }

        const contractPayload = {
          customer_id: customerId,
          customer_name: contract.client_name || contract.ClientName || '',
          name: contract.contractname || contract.ContractName || `Contract ${contract.id}`,
          external_id: String(contract.id),
          source: 'halopsa',
          type: 'managed_services',
          status: contract.status?.toLowerCase() || 'active',
          start_date: contract.startdate || contract.StartDate || null,
          end_date: contract.enddate || contract.EndDate || null,
          value: parseFloat(contract.contractvalue || contract.ContractValue || 0) || 0,
          description: contract.notes || contract.Notes || ''
        };

        if (existingContract) {
          await base44.asServiceRole.entities.Contract.update(existingContract.id, contractPayload);
        } else {
          await base44.asServiceRole.entities.Contract.create(contractPayload);
        }
        recordsSynced = 1;

        await base44.asServiceRole.entities.SyncLog.update(syncLog.id, {
          status: 'success',
          records_synced: recordsSynced,
          completed_at: new Date().toISOString()
        });

        return Response.json({ success: true, message: 'Contract synced successfully', recordsSynced });
      } catch (syncError) {
        errors.push(syncError.message);
        await base44.asServiceRole.entities.SyncLog.update(syncLog.id, {
          status: 'failed',
          error_message: JSON.stringify(errors),
          completed_at: new Date().toISOString()
        });
        return Response.json({ success: false, error: syncError.message }, { status: 500 });
      }
    }

    if (action === 'sync_now') {
      const syncLog = await base44.asServiceRole.entities.SyncLog.create({
        source: 'halopsa',
        status: 'in_progress',
        sync_type: 'contracts',
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
          const data = await fetchHaloPSA(haloPsaApi(`Contract?pageNumber=${pageNumber}&pageSize=${pageSize}`));
          const contracts = data.contracts || data || [];

          if (contracts.length === 0) {
            hasMore = false;
            break;
          }

          for (const contract of contracts) {
            try {
              const existingContract = (await base44.asServiceRole.entities.Contract.filter({ 
                external_id: String(contract.id), 
                source: 'halopsa' 
              }))[0];

              const customers = await base44.asServiceRole.entities.Customer.filter({ 
                external_id: String(contract.clientid || contract.ClientID),
                source: 'halopsa'
              });
              const customerId = customers[0]?.id;

              if (!customerId) {
                recordsFailed++;
                continue;
              }

              const contractPayload = {
                customer_id: customerId,
                customer_name: contract.client_name || contract.ClientName || '',
                name: contract.contractname || contract.ContractName || `Contract ${contract.id}`,
                external_id: String(contract.id),
                source: 'halopsa',
                type: 'managed_services',
                status: contract.status?.toLowerCase() || 'active',
                start_date: contract.startdate || contract.StartDate || null,
                end_date: contract.enddate || contract.EndDate || null,
                value: parseFloat(contract.contractvalue || contract.ContractValue || 0) || 0,
                description: contract.notes || contract.Notes || ''
              };

              if (existingContract) {
                await base44.asServiceRole.entities.Contract.update(existingContract.id, contractPayload);
              } else {
                await base44.asServiceRole.entities.Contract.create(contractPayload);
              }
              recordsSynced++;
            } catch (itemError) {
              recordsFailed++;
              errors.push(`Contract ${contract.id}: ${itemError.message}`);
            }
          }

          if (contracts.length < pageSize) {
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
          message: `Synced ${recordsSynced} contracts${recordsFailed > 0 ? `, ${recordsFailed} failed` : ''}`
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