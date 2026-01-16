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
function buildUrl(baseUrl, endpoint) {
  return `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}${endpoint}`;
}

// Helper: Fetch from HaloPSA
async function fetchHalo(url, accessToken, clientId) {
  console.log(`Fetching: ${url}`);
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-ID': clientId
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HaloPSA API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log(`Response keys: ${Object.keys(data)}`);
  return data;
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

    // Action: sync_customer - sync contracts for a specific customer
    if (action === 'sync_customer') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      console.log(`Syncing contracts for customer external_id: ${customer_id}`);

      // Find customer in database
      const customers = await base44.asServiceRole.entities.Customer.filter({ 
        external_id: String(customer_id),
        source: 'halopsa'
      });
      const dbCustomer = customers[0];
      if (!dbCustomer) {
        return Response.json({ error: 'Customer not found in database' }, { status: 404 });
      }

      console.log(`Found customer: ${dbCustomer.name} (id: ${dbCustomer.id})`);

      // Fetch contracts from HaloPSA for this client
      const url = buildUrl(apiUrl, `ClientContract?client_id=${customer_id}&pageinate=false`);
      const data = await fetchHalo(url, accessToken, haloClientId);
      
      // Extract contracts array
      let contracts = [];
      if (Array.isArray(data)) {
        contracts = data;
      } else if (data.contracts) {
        contracts = data.contracts;
      } else if (data.records) {
        contracts = data.records;
      }

      console.log(`Found ${contracts.length} contracts for client ${customer_id}`);
      console.log(`First contract sample: ${JSON.stringify(contracts[0] || {})}`);

      let recordsSynced = 0;
      let recordsFailed = 0;
      const errors = [];

      for (const haloContract of contracts) {
        try {
          console.log(`Processing contract: ${JSON.stringify(haloContract)}`);

          // Map contract type from HaloPSA
          const typeMap = {
            'managed': 'managed_services',
            'managed services': 'managed_services',
            'break fix': 'break_fix',
            'breakfix': 'break_fix',
            'project': 'project',
            'subscription': 'subscription'
          };
          const rawType = (haloContract.type_name || haloContract.typename || haloContract.type || '').toLowerCase();
          const contractType = typeMap[rawType] || 'other';

          // Map contract status from HaloPSA
          const statusMap = {
            'active': 'active',
            'pending': 'pending',
            'expired': 'expired',
            'cancelled': 'cancelled',
            'canceled': 'cancelled',
            'inactive': 'expired'
          };
          const rawStatus = (haloContract.status_name || haloContract.statusname || haloContract.status || 'active').toLowerCase();
          const contractStatus = statusMap[rawStatus] || 'active';

          // Map billing cycle from HaloPSA
          const billingMap = {
            'monthly': 'monthly',
            'quarterly': 'quarterly',
            'annually': 'annually',
            'annual': 'annually',
            'yearly': 'annually',
            'one time': 'one_time',
            'one-time': 'one_time',
            'onetime': 'one_time'
          };
          const rawBilling = (haloContract.billing_cycle || haloContract.billingcycle || haloContract.billingfrequency || 'monthly').toLowerCase();
          const billingCycle = billingMap[rawBilling] || 'monthly';

          const contractPayload = {
            customer_id: dbCustomer.id,
            customer_name: dbCustomer.name,
            name: haloContract.contractname || haloContract.ref || haloContract.name || `Contract ${haloContract.id}`,
            external_id: String(haloContract.id),
            source: 'halopsa',
            type: contractType,
            status: contractStatus,
            start_date: haloContract.startdate || haloContract.start_date || null,
            end_date: haloContract.enddate || haloContract.end_date || null,
            renewal_date: haloContract.renewaldate || haloContract.renewal_date || haloContract.nextbillingdate || null,
            billing_cycle: billingCycle,
            value: parseFloat(haloContract.contractvalue || haloContract.value || haloContract.monthlyvalue || haloContract.recurringvalue || 0) || 0,
            description: haloContract.notes || haloContract.description || '',
            auto_renew: haloContract.autorenew === true || haloContract.auto_renew === true || false
          };

          console.log(`Contract payload: ${JSON.stringify(contractPayload)}`);

          // Check if contract exists
          const existing = await base44.asServiceRole.entities.Contract.filter({ 
            external_id: String(haloContract.id), 
            source: 'halopsa' 
          });

          if (existing.length > 0) {
            await base44.asServiceRole.entities.Contract.update(existing[0].id, contractPayload);
            console.log(`Updated contract ${haloContract.id}`);
          } else {
            await base44.asServiceRole.entities.Contract.create(contractPayload);
            console.log(`Created contract ${haloContract.id}`);
          }

          recordsSynced++;
        } catch (err) {
          console.log(`Error syncing contract ${haloContract.id}: ${err.message}`);
          errors.push(err.message);
          recordsFailed++;
        }
      }

      return Response.json({
        success: true,
        recordsSynced,
        recordsFailed,
        errors: errors.slice(0, 5),
        message: `Synced ${recordsSynced} contracts`
      });
    }

    return Response.json({ error: 'Invalid action. Use: sync_customer' }, { status: 400 });
  } catch (error) {
    console.log(`Error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});