import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: Extract HaloPSA access token via OAuth 2.0 Client Credentials flow
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

// Helper: Fetch from HaloPSA with rate limiting and error handling
async function fetchFromHaloPSA(url, accessToken, clientId) {
  await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting

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

// Helper: Extract recurring bills array from various HaloPSA response formats
function extractRecurringBillsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (data.invoices) return data.invoices;
  if (data.recurringInvoices) return data.recurringInvoices;
  if (data.pageDetails?.pageResult) return data.pageDetails.pageResult;
  if (data.records) return data.records;
  return [];
}

// Helper: Fetch line items for a specific recurring invoice
async function fetchLineItemsForBill(billId, baseUrl, accessToken, clientId) {
  try {
    const url = buildHaloPsaApiUrl(baseUrl, `RecurringInvoiceLineItem?recurringinvoice_id=${billId}`);
    const data = await fetchFromHaloPSA(url, accessToken, clientId);
    if (Array.isArray(data)) return data;
    if (data.line_items) return data.line_items;
    if (data.LineItems) return data.LineItems;
    return [];
  } catch (err) {
    console.log(`Could not fetch line items for bill ${billId}: ${err.message}`);
    return [];
  }
}

// Transform HaloPSA bill data to RecurringBill schema
function transformRecurringBill(haloBill, customerId) {
  return {
    customer_id: customerId,
    halopsa_id: String(haloBill.id),
    name: haloBill.name || haloBill.Name || `Bill ${haloBill.id}`,
    description: haloBill.description || haloBill.Description || '',
    amount: parseFloat(haloBill.total || haloBill.Total || 0) || 0,
    frequency: (haloBill.frequency || haloBill.Frequency || 'monthly').toLowerCase(),
    status: haloBill.status?.toLowerCase?.() === 'inactive' ? 'inactive' : 'active',
    start_date: haloBill.startdate || haloBill.StartDate || null,
    end_date: haloBill.enddate || haloBill.EndDate || null
  };
}

// Transform HaloPSA line item to RecurringBillLineItem schema
function transformLineItem(haloLineItem, recurringBillId) {
  // Log full line item structure for debugging
  console.log(`Line item raw: ${JSON.stringify(haloLineItem)}`);
  
  // Try multiple field names for description
  const description = haloLineItem.description || haloLineItem.Description || 
                     haloLineItem.itemdescription || haloLineItem.item_description ||
                     haloLineItem.item_name || haloLineItem.itemname ||
                     haloLineItem.name || haloLineItem.Name ||
                     haloLineItem.summary || haloLineItem.Summary || '';
  
  return {
    recurring_bill_id: recurringBillId,
    halopsa_id: String(haloLineItem.id || haloLineItem.ID),
    description: description,
    quantity: parseFloat(haloLineItem.quantity || haloLineItem.Quantity || haloLineItem.count || 1),
    price: parseFloat(haloLineItem.unit_price || haloLineItem.UnitPrice || haloLineItem.unitprice || 
                     haloLineItem.price || haloLineItem.Price || 0) || 0,
    net_amount: parseFloat(haloLineItem.net_amount || haloLineItem.NetAmount || haloLineItem.netamount ||
                          haloLineItem.net || haloLineItem.total || haloLineItem.Total || 0) || 0,
    tax: parseFloat(haloLineItem.tax || haloLineItem.Tax || haloLineItem.taxamount || 0) || 0,
    item_code: String(haloLineItem.item_id || haloLineItem.itemid || haloLineItem.item_code || 
                     haloLineItem.ItemCode || haloLineItem.itemcode || ''),
    asset: haloLineItem.asset || haloLineItem.Asset || haloLineItem.assetname || '',
    active: haloLineItem.active !== false
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
      const url = buildHaloPsaApiUrl(apiUrl, 'RecurringInvoice?page_number=1&page_size=1');
      await fetchFromHaloPSA(url, accessToken, clientId);
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
        // Extract customer from database
        const customers = await base44.asServiceRole.entities.Customer.filter({ 
          external_id: String(customer_id),
          source: 'halopsa'
        });
        const dbCustomer = customers[0];
        if (!dbCustomer) throw new Error('Customer not found in database');

        // Extract: Fetch recurring bills WITH line items included
        const url = buildHaloPsaApiUrl(apiUrl, `RecurringInvoice?client_id=${customer_id}&page_size=1000&includelines=true`);
        const data = await fetchFromHaloPSA(url, accessToken, clientId);
        console.log(`Response sample: ${JSON.stringify(data).substring(0, 2000)}`);
        const recurringBills = extractRecurringBillsFromResponse(data);

        // Transform & Load: Process each bill
        for (const haloBill of recurringBills) {
          try {
            // Transform bill data
            const billPayload = transformRecurringBill(haloBill, dbCustomer.id);

            // Load: Create or update bill
            const existingBill = (await base44.asServiceRole.entities.RecurringBill.filter({ 
              halopsa_id: billPayload.halopsa_id,
              customer_id: dbCustomer.id
            }))[0];

            let savedBill;
            if (existingBill) {
              await base44.asServiceRole.entities.RecurringBill.update(existingBill.id, billPayload);
              savedBill = existingBill;
            } else {
              savedBill = await base44.asServiceRole.entities.RecurringBill.create(billPayload);
            }

            // Extract & Transform: Line items
            const lineItems = haloBill.line_items || haloBill.LineItems || haloBill.lines || haloBill.Lines || [];
            if (Array.isArray(lineItems) && lineItems.length > 0) {
              // Delete old line items
              const existingItems = await base44.asServiceRole.entities.RecurringBillLineItem.filter({ recurring_bill_id: savedBill.id });
              if (existingItems.length > 0) {
                for (const item of existingItems) {
                  await base44.asServiceRole.entities.RecurringBillLineItem.delete(item.id);
                }
              }

              // Load: Create new line items
              const transformedItems = lineItems.map(item => transformLineItem(item, savedBill.id));
              if (transformedItems.length > 0) {
                await base44.asServiceRole.entities.RecurringBillLineItem.bulkCreate(transformedItems);
              }
            }

            recordsSynced++;
          } catch (itemError) {
            recordsFailed++;
            errors.push(`Bill ${haloBill.id}: ${itemError.message}`);
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
        // Extract: Fetch all customers and existing bills for comparison
        const allCustomers = await base44.asServiceRole.entities.Customer.list();
        const existingBills = await base44.asServiceRole.entities.RecurringBill.list('-created_date', 500);
        const customerMap = new Map(allCustomers.map(c => [`${c.external_id}:halopsa`, c.id]));
        const billMap = new Map(existingBills.map(b => [`${b.halopsa_id}:${b.customer_id}`, b.id]));

        const allToCreate = [];
        const allToUpdate = [];

        // Extract: Paginate through HaloPSA recurring invoices
        while (hasMore) {
          const url = buildHaloPsaApiUrl(apiUrl, `RecurringInvoice?page_number=${pageNumber}&page_size=500`);
          const data = await fetchFromHaloPSA(url, accessToken, clientId);
          const recurringBills = extractRecurringBillsFromResponse(data);

          if (recurringBills.length === 0) {
            hasMore = false;
            break;
          }

          // Transform & prepare for load
          for (const haloBill of recurringBills) {
            try {
              const customerId = customerMap.get(`${haloBill.client_id || haloBill.ClientID}:halopsa`);
              if (!customerId) {
                recordsFailed++;
                continue;
              }

              // Transform bill
              const billPayload = transformRecurringBill(haloBill, customerId);

              // Extract: Fetch line items
              const lineItems = await fetchLineItemsForBill(haloBill.id, apiUrl, accessToken, clientId);

              // Determine if creating or updating
              const billKey = `${haloBill.id}:${customerId}`;
              const existingId = billMap.get(billKey);
              if (existingId) {
                allToUpdate.push({ id: existingId, data: billPayload, lineItems });
              } else {
                allToCreate.push({ ...billPayload, _lineItems: lineItems });
              }
            } catch (itemError) {
              recordsFailed++;
              errors.push(`Bill ${haloBill.id}: ${itemError.message}`);
            }
          }

          pageNumber++;
          if (recurringBills.length < 500) hasMore = false;
        }

        // Load: Create new bills
        let createdBills = [];
        if (allToCreate.length > 0) {
          const billsToCreate = allToCreate.map(({ _lineItems, ...rest }) => rest);
          createdBills = await base44.asServiceRole.entities.RecurringBill.bulkCreate(billsToCreate);
          recordsSynced += allToCreate.length;
        }

        // Load: Create line items for new bills
        for (let i = 0; i < allToCreate.length; i++) {
          const bill = createdBills[i];
          const billData = allToCreate[i];
          const lineItems = billData._lineItems;

          if (Array.isArray(lineItems) && lineItems.length > 0) {
            const transformedItems = lineItems.map(item => transformLineItem(item, bill.id));
            await base44.asServiceRole.entities.RecurringBillLineItem.bulkCreate(transformedItems);
          }
        }

        // Load: Update existing bills and their line items
        for (const { id, data, lineItems } of allToUpdate) {
          await base44.asServiceRole.entities.RecurringBill.update(id, data);

          // Delete old line items
          const existingItems = await base44.asServiceRole.entities.RecurringBillLineItem.filter({ recurring_bill_id: id });
          if (existingItems.length > 0) {
            for (const item of existingItems) {
              await base44.asServiceRole.entities.RecurringBillLineItem.delete(item.id);
            }
          }

          // Create new line items
          if (Array.isArray(lineItems) && lineItems.length > 0) {
            const transformedItems = lineItems.map(item => transformLineItem(item, id));
            await base44.asServiceRole.entities.RecurringBillLineItem.bulkCreate(transformedItems);
          }

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