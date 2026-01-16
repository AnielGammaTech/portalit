import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: Authenticate with HaloPSA via OAuth 2.0 Client Credentials
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
    const errorText = await tokenResponse.text();
    throw new Error(`HaloPSA auth failed: ${tokenResponse.status} - ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error('No access token received from HaloPSA');
  }

  return tokenData.access_token;
}

// Helper: Build HaloPSA API URL
function buildHaloPsaApiUrl(baseUrl, endpoint) {
  return `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}${endpoint}`;
}

// Helper: Fetch from HaloPSA with rate limiting
async function fetchFromHaloPSA(url, accessToken, clientId) {
  await new Promise(resolve => setTimeout(resolve, 1000));

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

// Helper: Extract contracts array from response
function extractContractsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (data.contracts) return data.contracts;
  return [];
}

// Helper: Fetch line items for a specific contract
async function fetchLineItemsForContract(contractId, baseUrl, accessToken, clientId) {
  try {
    const url = buildHaloPsaApiUrl(baseUrl, `ContractLineItem?contract_id=${contractId}`);
    const data = await fetchFromHaloPSA(url, accessToken, clientId);
    if (Array.isArray(data)) return data;
    if (data.line_items) return data.line_items;
    if (data.LineItems) return data.LineItems;
    return [];
  } catch (err) {
    console.log(`Could not fetch line items for contract ${contractId}: ${err.message}`);
    return [];
  }
}

// Transform HaloPSA contract data to Contract schema
function transformContract(haloContract, customerId) {
  return {
    customer_id: customerId,
    customer_name: haloContract.client_name || haloContract.ClientName || '',
    name: haloContract.contractname || haloContract.ContractName || `Contract ${haloContract.id}`,
    external_id: String(haloContract.id),
    source: 'halopsa',
    type: 'managed_services',
    status: haloContract.status?.toLowerCase?.() || 'active',
    start_date: haloContract.startdate || haloContract.StartDate || null,
    end_date: haloContract.enddate || haloContract.EndDate || null,
    value: parseFloat(haloContract.contractvalue || haloContract.ContractValue || 0) || 0,
    description: haloContract.notes || haloContract.Notes || ''
  };
}

// Transform HaloPSA line item to ContractItem schema
function transformLineItem(haloLineItem, contractId) {
  return {
    contract_id: contractId,
    external_id: String(haloLineItem.id || haloLineItem.ID),
    description: haloLineItem.description || haloLineItem.Description || '',
    quantity: parseFloat(haloLineItem.quantity || haloLineItem.Quantity || 1),
    unit_price: parseFloat(haloLineItem.unit_price || haloLineItem.UnitPrice || haloLineItem.Price || 0) || 0,
    net_amount: parseFloat(haloLineItem.net_amount || haloLineItem.NetAmount || haloLineItem.total || haloLineItem.Total || 0) || 0,
    item_code: haloLineItem.item_code || haloLineItem.ItemCode || ''
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
    const { action } = body;

    const settings = (await base44.asServiceRole.entities.Settings.list())[0];
    if (!settings) {
      return Response.json({ error: 'HaloPSA settings not configured' }, { status: 400 });
    }

    let accessToken;
    try {
      accessToken = await authenticateWithHaloPSA(
        settings.halopsa_auth_url,
        settings.halopsa_client_id,
        settings.halopsa_client_secret
      );
    } catch (error) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    const apiUrl = settings.halopsa_api_url;
    const clientId = settings.halopsa_client_id;

    if (action === 'test_connection') {
      const url = buildHaloPsaApiUrl(apiUrl, 'Contracts?page_number=1&page_size=1');
      await fetchFromHaloPSA(url, accessToken, clientId);
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
        // Extract: Fetch contract from HaloPSA
        const url = buildHaloPsaApiUrl(apiUrl, `Contracts/${contract_id}`);
        const haloContract = await fetchFromHaloPSA(url, accessToken, clientId);

        // Extract: Lookup customer in database
        const customers = await base44.asServiceRole.entities.Customer.filter({ 
          external_id: String(haloContract.clientid || haloContract.ClientID),
          source: 'halopsa'
        });
        const customerId = customers[0]?.id;
        if (!customerId) throw new Error('Associated customer not found');

        // Transform: Contract data
        const contractPayload = transformContract(haloContract, customerId);

        // Load: Create or update contract
        const existingContract = (await base44.asServiceRole.entities.Contract.filter({ 
          external_id: String(haloContract.id), 
          source: 'halopsa' 
        }))[0];

        let savedContract;
        if (existingContract) {
          await base44.asServiceRole.entities.Contract.update(existingContract.id, contractPayload);
          savedContract = existingContract;
        } else {
          savedContract = await base44.asServiceRole.entities.Contract.create(contractPayload);
        }

        // Extract & Load: Line items
        const lineItems = await fetchLineItemsForContract(haloContract.id, apiUrl, accessToken, clientId);
        if (Array.isArray(lineItems) && lineItems.length > 0) {
          // Delete old line items
          const existingItems = await base44.asServiceRole.entities.ContractItem.filter({ contract_id: savedContract.id });
          if (existingItems.length > 0) {
            for (const item of existingItems) {
              await base44.asServiceRole.entities.ContractItem.delete(item.id);
            }
          }

          // Transform & Load: New line items
          const transformedItems = lineItems.map(item => transformLineItem(item, savedContract.id));
          await base44.asServiceRole.entities.ContractItem.bulkCreate(transformedItems);
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
        // Extract: Fetch all customers for mapping
        const allCustomers = await base44.asServiceRole.entities.Customer.list();
        const customerMap = new Map(allCustomers.map(c => [`${c.external_id}:halopsa`, c.id]));

        // Extract: Paginate through HaloPSA contracts
        while (hasMore) {
          const url = buildHaloPsaApiUrl(apiUrl, `Contracts?page_number=${pageNumber}&page_size=${pageSize}`);
          const data = await fetchFromHaloPSA(url, accessToken, clientId);
          const haloContracts = extractContractsFromResponse(data);

          if (haloContracts.length === 0) {
            hasMore = false;
            break;
          }

          // Transform & Load
          for (const haloContract of haloContracts) {
            try {
              const customerId = customerMap.get(`${haloContract.clientid || haloContract.ClientID}:halopsa`);
              if (!customerId) {
                recordsFailed++;
                continue;
              }

              // Transform contract data
              const contractPayload = transformContract(haloContract, customerId);

              // Load: Create or update contract
              const existingContract = (await base44.asServiceRole.entities.Contract.filter({ 
                external_id: String(haloContract.id), 
                source: 'halopsa' 
              }))[0];

              let savedContract;
              if (existingContract) {
                await base44.asServiceRole.entities.Contract.update(existingContract.id, contractPayload);
                savedContract = existingContract;
              } else {
                savedContract = await base44.asServiceRole.entities.Contract.create(contractPayload);
              }

              // Extract & Load: Line items
              const lineItems = await fetchLineItemsForContract(haloContract.id, apiUrl, accessToken, clientId);
              if (Array.isArray(lineItems) && lineItems.length > 0) {
                // Delete old line items
                const existingItems = await base44.asServiceRole.entities.ContractItem.filter({ contract_id: savedContract.id });
                if (existingItems.length > 0) {
                  for (const item of existingItems) {
                    await base44.asServiceRole.entities.ContractItem.delete(item.id);
                  }
                }

                // Transform & Load: New line items
                const transformedItems = lineItems.map(item => transformLineItem(item, savedContract.id));
                await base44.asServiceRole.entities.ContractItem.bulkCreate(transformedItems);
              }

              recordsSynced++;
            } catch (itemError) {
              recordsFailed++;
              errors.push(`Contract ${haloContract.id}: ${itemError.message}`);
            }
          }

          pageNumber++;
          if (haloContracts.length < pageSize) hasMore = false;
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