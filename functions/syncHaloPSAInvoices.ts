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

// Helper: Parse HaloPSA date (handles various formats including OLE dates)
function parseHaloDate(dateValue) {
  if (!dateValue) return null;
  
  // If it's a string that looks like ISO date
  if (typeof dateValue === 'string') {
    // Check for invalid/default dates
    if (dateValue.includes('1899') || dateValue.includes('1900-01-01')) {
      return null;
    }
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
      return parsed.toISOString();
    }
  }
  
  // If it's a number (OLE date - days since Dec 30, 1899)
  if (typeof dateValue === 'number' && dateValue > 0) {
    const oleBaseDate = new Date(1899, 11, 30);
    const resultDate = new Date(oleBaseDate.getTime() + dateValue * 24 * 60 * 60 * 1000);
    if (resultDate.getFullYear() > 1900) {
      return resultDate.toISOString();
    }
  }
  
  return null;
}

// Transform HaloPSA invoice to Invoice schema
function transformInvoice(haloInvoice, customerId) {
  // Determine status based on payment status code
  // HaloPSA: -1 = unpaid, 1 = partial, 2 = paid
  let status = 'draft';
  const paymentStatus = haloInvoice.paymentstatus;
  
  if (paymentStatus === 2 || haloInvoice.amountdue === 0) {
    status = 'paid';
  } else if (haloInvoice.posted || paymentStatus === -1 || paymentStatus === 1) {
    status = 'sent';
  }
  
  // Check if overdue
  const dueDate = parseHaloDate(haloInvoice.duedate);
  if (status === 'sent' && dueDate) {
    const dueDateObj = new Date(dueDate);
    if (dueDateObj < new Date()) {
      status = 'overdue';
    }
  }

  // Try multiple possible field names for invoice date - use datepaid for paid invoices
  const invoiceDate = parseHaloDate(haloInvoice.datepaid) ||
                      parseHaloDate(haloInvoice.invoice_date) || 
                      parseHaloDate(haloInvoice.dateposted) ||
                      dueDate;

  // Get actual invoice number - try thirdpartyinvoicenumber first
  let invoiceNumber = haloInvoice.thirdpartyinvoicenumber || haloInvoice.invoicenumber;
  if (!invoiceNumber || invoiceNumber === '0' || invoiceNumber === 0) {
    invoiceNumber = haloInvoice.contract_ref || `INV-${haloInvoice.id}`;
  }

  return {
    customer_id: customerId,
    halopsa_id: String(haloInvoice.id),
    invoice_number: invoiceNumber,
    total: parseFloat(haloInvoice.total || haloInvoice.totalamount || (haloInvoice.amountdue || 0) + (haloInvoice.amountpaid || 0) || 0),
    amount_paid: parseFloat(haloInvoice.amountpaid || haloInvoice.amount_paid || 0),
    amount_due: parseFloat(haloInvoice.amountdue || haloInvoice.amount_due || 0),
    invoice_date: invoiceDate,
    due_date: dueDate,
    status: status,
    payment_status: String(paymentStatus ?? ''),
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
      console.log(`Invoice response sample: ${JSON.stringify(data).substring(0, 2500)}`);
      
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

          let dbInvoiceId;
          if (existing.length > 0) {
            await base44.asServiceRole.entities.Invoice.update(existing[0].id, invoicePayload);
            dbInvoiceId = existing[0].id;
          } else {
            const created = await base44.asServiceRole.entities.Invoice.create(invoicePayload);
            dbInvoiceId = created.id;
          }

          // Fetch line items separately from HaloPSA
          try {
            const invoiceDetailUrl = buildUrl(apiUrl, `Invoice/${haloInvoice.id}`);
            const invoiceDetail = await fetchHalo(invoiceDetailUrl, accessToken, haloClientId);
            const lineItems = invoiceDetail.lines || invoiceDetail.lineitems || invoiceDetail.items || [];
            
            console.log(`Invoice ${haloInvoice.id} has ${lineItems.length} line items`);
            if (lineItems.length > 0) {
              console.log(`Sample line item: ${JSON.stringify(lineItems[0])}`);
            }
            
            if (lineItems.length > 0) {
              // Delete existing line items for this invoice
              const existingItems = await base44.asServiceRole.entities.InvoiceLineItem.filter({ invoice_id: dbInvoiceId });
              for (const item of existingItems) {
                await base44.asServiceRole.entities.InvoiceLineItem.delete(item.id);
              }
              
              // Create new line items
              for (const line of lineItems) {
                await base44.asServiceRole.entities.InvoiceLineItem.create({
                  invoice_id: dbInvoiceId,
                  halopsa_id: String(line.id || `${haloInvoice.id}-${lineItems.indexOf(line)}`),
                  description: line.item_shortdescription || line.item_longdescription || line.linked_item?.name || 'Item',
                  quantity: parseFloat(line.qty_order || line.quantity || 1),
                  unit_price: parseFloat(line.unit_price || 0),
                  net_amount: parseFloat(line.net_amount || 0),
                  tax: parseFloat(line.tax_amount || 0),
                  item_code: line.item_code || ''
                });
              }
            }
          } catch (lineErr) {
            console.log(`Could not fetch line items for invoice ${haloInvoice.id}: ${lineErr.message}`);
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