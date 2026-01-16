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

// Helper: Fetch from HaloPSA with rate limiting
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

// Transform HaloPSA invoice to Invoice schema
function transformInvoice(haloInvoice, customerId) {
  // Determine status
  let status = 'draft';
  if (haloInvoice.paymentstatus === 1 || haloInvoice.amountdue === 0) {
    status = 'paid';
  } else if (haloInvoice.posted) {
    status = 'sent';
  }
  
  // Check if overdue
  if (status === 'sent' && haloInvoice.duedate) {
    const dueDate = new Date(haloInvoice.duedate);
    if (dueDate < new Date()) {
      status = 'overdue';
    }
  }

  return {
    customer_id: customerId,
    halopsa_id: String(haloInvoice.id),
    invoice_number: haloInvoice.invoicenumber || `INV-${haloInvoice.id}`,
    total: parseFloat(haloInvoice.total || haloInvoice.amountdue + haloInvoice.amountpaid || 0),
    amount_paid: parseFloat(haloInvoice.amountpaid || 0),
    amount_due: parseFloat(haloInvoice.amountdue || 0),
    invoice_date: haloInvoice.invoicedate || haloInvoice.datesent || null,
    due_date: haloInvoice.duedate || null,
    status: status,
    payment_status: String(haloInvoice.paymentstatus || ''),
    source: 'halopsa'
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

      // Fetch invoices from HaloPSA
      const url = buildUrl(apiUrl, `Invoice?client_id=${customer_id}&page_size=100`);
      const data = await fetchHalo(url, accessToken, haloClientId);
      console.log(`Invoice response sample: ${JSON.stringify(data).substring(0, 1500)}`);
      
      // Extract invoices array
      let invoices = [];
      if (Array.isArray(data)) {
        invoices = data;
      } else if (data.invoices) {
        invoices = data.invoices;
      } else if (data.records) {
        invoices = data.records;
      }

      console.log(`Found ${invoices.length} invoices for client ${customer_id}`);

      let recordsSynced = 0;
      let recordsFailed = 0;

      for (const haloInvoice of invoices) {
        try {
          const invoicePayload = transformInvoice(haloInvoice, dbCustomer.id);

          // Check if invoice exists
          const existing = await base44.asServiceRole.entities.Invoice.filter({ 
            halopsa_id: String(haloInvoice.id),
            customer_id: dbCustomer.id
          });

          if (existing.length > 0) {
            await base44.asServiceRole.entities.Invoice.update(existing[0].id, invoicePayload);
          } else {
            await base44.asServiceRole.entities.Invoice.create(invoicePayload);
          }

          recordsSynced++;
        } catch (err) {
          console.log(`Error syncing invoice ${haloInvoice.id}: ${err.message}`);
          recordsFailed++;
        }
      }

      return Response.json({
        success: true,
        recordsSynced,
        recordsFailed,
        message: `Synced ${recordsSynced} invoices`
      });
    }

    return Response.json({ error: 'Invalid action. Use: sync_customer' }, { status: 400 });
  } catch (error) {
    console.log(`Error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});