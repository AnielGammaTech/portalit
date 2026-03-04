import { getServiceSupabase } from '../lib/supabase.js';

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
  // HaloPSA fields: item_shortdescription, item_code, qty_order, unit_price, net_amount
  const description = haloLineItem.item_shortdescription || haloLineItem.item_longdescription ||
                     haloLineItem.description || haloLineItem.name || '';

  return {
    recurring_bill_id: recurringBillId,
    halopsa_id: String(haloLineItem.id || haloLineItem.ID),
    description: description,
    quantity: parseFloat(haloLineItem.qty_order || haloLineItem.quantity || 1),
    price: parseFloat(haloLineItem.unit_price || 0) || 0,
    net_amount: parseFloat(haloLineItem.net_amount || 0) || 0,
    tax: parseFloat(haloLineItem.tax_amount || haloLineItem.tax || 0) || 0,
    item_code: String(haloLineItem.item_code || haloLineItem._itemid || ''),
    asset: haloLineItem.asset_inventory_number || '',
    active: haloLineItem.active !== false
  };
}

export async function syncHaloPSARecurringBills(body, user) {
  const supabase = getServiceSupabase();

  const { action, customer_id } = body;

  const { data: settingsList } = await supabase.from('settings').select('*');
  const settings = (settingsList || [])[0];
  if (!settings) {
    const err = new Error('HaloPSA settings not configured');
    err.statusCode = 400;
    throw err;
  }

  let accessToken;
  try {
    accessToken = await authenticateWithHaloPSA(
      settings.halopsa_auth_url,
      settings.halopsa_client_id,
      settings.halopsa_client_secret
    );
  } catch (authError) {
    const err = new Error(authError.message);
    err.statusCode = 401;
    throw err;
  }

  const apiUrl = settings.halopsa_api_url;
  const clientId = settings.halopsa_client_id;

  if (action === 'test_connection') {
    const url = buildHaloPsaApiUrl(apiUrl, 'RecurringInvoice?page_number=1&page_size=1');
    await fetchFromHaloPSA(url, accessToken, clientId);
    return { success: true, message: 'HaloPSA connection successful!' };
  }

  if (action === 'sync_customer') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: syncLog, error: syncLogError } = await supabase.from('sync_logs').insert({
      source: 'halopsa',
      status: 'in_progress',
      sync_type: 'recurring_bills',
      started_at: new Date().toISOString()
    }).select().single();
    if (syncLogError) throw new Error(syncLogError.message);

    let recordsSynced = 0;
    let recordsFailed = 0;
    const errors = [];

    try {
      // Extract customer from database
      let customerQuery = supabase.from('customers').select('*');
      customerQuery = customerQuery.eq('external_id', String(customer_id));
      customerQuery = customerQuery.eq('source', 'halopsa');
      const { data: customers } = await customerQuery;
      const dbCustomer = (customers || [])[0];
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
          let existingQuery = supabase.from('recurring_bills').select('*');
          existingQuery = existingQuery.eq('halopsa_id', billPayload.halopsa_id);
          existingQuery = existingQuery.eq('customer_id', dbCustomer.id);
          const { data: existingBillArr } = await existingQuery;
          const existingBill = (existingBillArr || [])[0];

          let savedBill;
          if (existingBill) {
            await supabase.from('recurring_bills').update(billPayload).eq('id', existingBill.id).select().single();
            savedBill = existingBill;
          } else {
            const { data: created, error } = await supabase.from('recurring_bills').insert(billPayload).select().single();
            if (error) throw new Error(error.message);
            savedBill = created;
          }

          // Extract & Transform: Line items (HaloPSA uses "lines" field)
          const lineItems = haloBill.lines || haloBill.line_items || haloBill.LineItems || haloBill.Lines || [];
          console.log(`Bill ${haloBill.id} has ${lineItems.length} line items`);
          if (Array.isArray(lineItems) && lineItems.length > 0) {
            // Delete old line items
            const { data: existingItems } = await supabase.from('recurring_bill_line_items').select('*').eq('recurring_bill_id', savedBill.id);
            if ((existingItems || []).length > 0) {
              for (const item of existingItems) {
                await supabase.from('recurring_bill_line_items').delete().eq('id', item.id);
              }
            }

            // Load: Create new line items
            const transformedItems = lineItems.map(item => transformLineItem(item, savedBill.id));
            if (transformedItems.length > 0) {
              const { error } = await supabase.from('recurring_bill_line_items').insert(transformedItems).select();
              if (error) throw new Error(error.message);
            }
          }

          recordsSynced++;
        } catch (itemError) {
          recordsFailed++;
          errors.push(`Bill ${haloBill.id}: ${itemError.message}`);
        }
      }

      await supabase.from('sync_logs').update({
        status: recordsFailed === 0 ? 'success' : 'partial',
        records_synced: recordsSynced,
        records_failed: recordsFailed,
        error_message: errors.length > 0 ? JSON.stringify(errors) : null,
        completed_at: new Date().toISOString()
      }).eq('id', syncLog.id).select().single();

      return {
        success: true,
        recordsSynced,
        recordsFailed,
        message: `Synced ${recordsSynced} recurring bills`
      };
    } catch (error) {
      await supabase.from('sync_logs').update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      }).eq('id', syncLog.id).select().single();
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }
  }

  if (action === 'sync_now') {
    const { data: syncLog, error: syncLogError } = await supabase.from('sync_logs').insert({
      source: 'halopsa',
      status: 'in_progress',
      sync_type: 'recurring_bills',
      started_at: new Date().toISOString()
    }).select().single();
    if (syncLogError) throw new Error(syncLogError.message);

    let recordsSynced = 0;
    let recordsFailed = 0;
    const errors = [];
    let pageNumber = 1;
    let hasMore = true;

    try {
      // Extract: Fetch all customers and existing bills for comparison
      const { data: allCustomers } = await supabase.from('customers').select('*');
      const { data: existingBills } = await supabase.from('recurring_bills').select('*').order('created_date', { ascending: false }).limit(500);
      const customerMap = new Map((allCustomers || []).map(c => [`${c.external_id}:halopsa`, c.id]));
      const billMap = new Map((existingBills || []).map(b => [`${b.halopsa_id}:${b.customer_id}`, b.id]));

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
        const { data, error } = await supabase.from('recurring_bills').insert(billsToCreate).select();
        if (error) throw new Error(error.message);
        createdBills = data || [];
        recordsSynced += allToCreate.length;
      }

      // Load: Create line items for new bills
      for (let i = 0; i < allToCreate.length; i++) {
        const bill = createdBills[i];
        const billData = allToCreate[i];
        const lineItems = billData._lineItems;

        if (Array.isArray(lineItems) && lineItems.length > 0) {
          const transformedItems = lineItems.map(item => transformLineItem(item, bill.id));
          const { error } = await supabase.from('recurring_bill_line_items').insert(transformedItems).select();
          if (error) throw new Error(error.message);
        }
      }

      // Load: Update existing bills and their line items
      for (const { id, data, lineItems } of allToUpdate) {
        await supabase.from('recurring_bills').update(data).eq('id', id).select().single();

        // Delete old line items
        const { data: existingItems } = await supabase.from('recurring_bill_line_items').select('*').eq('recurring_bill_id', id);
        if ((existingItems || []).length > 0) {
          for (const item of existingItems) {
            await supabase.from('recurring_bill_line_items').delete().eq('id', item.id);
          }
        }

        // Create new line items
        if (Array.isArray(lineItems) && lineItems.length > 0) {
          const transformedItems = lineItems.map(item => transformLineItem(item, id));
          const { error } = await supabase.from('recurring_bill_line_items').insert(transformedItems).select();
          if (error) throw new Error(error.message);
        }

        recordsSynced++;
      }

      await supabase.from('sync_logs').update({
        status: recordsFailed === 0 ? 'success' : 'partial',
        records_synced: recordsSynced,
        records_failed: recordsFailed,
        error_message: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
        completed_at: new Date().toISOString()
      }).eq('id', syncLog.id).select().single();

      return {
        success: true,
        recordsSynced,
        recordsFailed,
        message: `Synced ${recordsSynced} recurring bills`
      };
    } catch (error) {
      await supabase.from('sync_logs').update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      }).eq('id', syncLog.id).select().single();
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }
  }

  const err = new Error('Invalid action');
  err.statusCode = 400;
  throw err;
}
