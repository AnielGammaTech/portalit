import { getServiceSupabase } from '../lib/supabase.js';
import { getHaloConfig, haloGet, extractRecords } from '../lib/halopsa.js';

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

export async function syncHaloPSAInvoices(body, _user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;
  const config = await getHaloConfig();

  if (action === 'sync_customer') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    // Find customer in database
    let customerQuery = supabase.from('customers').select('*');
    customerQuery = customerQuery.eq('external_id', String(customer_id));
    customerQuery = customerQuery.eq('source', 'halopsa');
    const { data: customers } = await customerQuery;
    const dbCustomer = (customers || [])[0];
    if (!dbCustomer) {
      const err = new Error('Customer not found in database');
      err.statusCode = 404;
      throw err;
    }

    // Fetch invoices from HaloPSA for this specific customer only
    // Use a single page request with reasonable limit for quick sync
    console.log(`Quick sync for customer ${customer_id}`);

    const data = await haloGet(`Invoice?client_id=${customer_id}&page_size=200&page_no=1`, config);
    const invoices = extractRecords(data, 'invoices');

    console.log(`Found ${invoices.length} invoices for client ${customer_id}`);

    let recordsSynced = 0;
    let recordsFailed = 0;

    // Process invoices in parallel batches for speed
    const batchSize = 10;
    for (let i = 0; i < invoices.length; i += batchSize) {
      const batch = invoices.slice(i, i + batchSize);

      await Promise.all(batch.map(async (haloInvoice) => {
        try {
          const invoicePayload = transformInvoice(haloInvoice, dbCustomer.id);

          // Check if invoice exists
          let existingQuery = supabase.from('invoices').select('*');
          existingQuery = existingQuery.eq('halopsa_id', String(haloInvoice.id));
          existingQuery = existingQuery.eq('customer_id', dbCustomer.id);
          const { data: existing } = await existingQuery;

          if ((existing || []).length > 0) {
            await supabase.from('invoices').update(invoicePayload).eq('id', existing[0].id).select().single();
          } else {
            const { error } = await supabase.from('invoices').insert(invoicePayload).select().single();
            if (error) throw new Error(error.message);
          }

          recordsSynced++;
        } catch (err) {
          console.log(`Error syncing invoice ${haloInvoice.id}: ${err.message}`);
          recordsFailed++;
        }
      }));
    }

    return {
      success: true,
      recordsSynced,
      recordsFailed,
      message: `Synced ${recordsSynced} invoices`
    };
  }

  // Full sync with line items - use this for comprehensive sync
  if (action === 'sync_customer_full') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    // Find customer in database
    let customerQuery = supabase.from('customers').select('*');
    customerQuery = customerQuery.eq('external_id', String(customer_id));
    customerQuery = customerQuery.eq('source', 'halopsa');
    const { data: customers } = await customerQuery;
    const dbCustomer = (customers || [])[0];
    if (!dbCustomer) {
      const err = new Error('Customer not found in database');
      err.statusCode = 404;
      throw err;
    }

    // Fetch ALL invoices with pagination
    console.log(`Full sync with line items for customer ${customer_id}`);

    let allInvoices = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await haloGet(`Invoice?client_id=${customer_id}&page_size=100&page_no=${page}`, config);
      const pageInvoices = extractRecords(data, 'invoices');

      if (pageInvoices.length === 0) {
        hasMore = false;
      } else {
        allInvoices = allInvoices.concat(pageInvoices);
        page++;
        if (page > 50) hasMore = false;
      }
    }

    const invoices = allInvoices;
    console.log(`Total invoices: ${invoices.length}`);

    let recordsSynced = 0;
    let recordsFailed = 0;

    for (const haloInvoice of invoices) {
      try {
        const invoicePayload = transformInvoice(haloInvoice, dbCustomer.id);

        let existingQuery = supabase.from('invoices').select('*');
        existingQuery = existingQuery.eq('halopsa_id', String(haloInvoice.id));
        existingQuery = existingQuery.eq('customer_id', dbCustomer.id);
        const { data: existing } = await existingQuery;

        let dbInvoiceId;
        if ((existing || []).length > 0) {
          await supabase.from('invoices').update(invoicePayload).eq('id', existing[0].id).select().single();
          dbInvoiceId = existing[0].id;
        } else {
          const { data: created, error } = await supabase.from('invoices').insert(invoicePayload).select().single();
          if (error) throw new Error(error.message);
          dbInvoiceId = created.id;
        }

        // Fetch line items for full sync
        try {
          const invoiceDetail = await haloGet(`Invoice/${haloInvoice.id}`, config);
          const lineItems = invoiceDetail.lines || invoiceDetail.lineitems || invoiceDetail.items || [];

          if (lineItems.length > 0) {
            const { data: existingItems } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', dbInvoiceId);
            for (const item of (existingItems || [])) {
              await supabase.from('invoice_line_items').delete().eq('id', item.id);
            }

            for (const line of lineItems) {
              const { error } = await supabase.from('invoice_line_items').insert({
                invoice_id: dbInvoiceId,
                halopsa_id: String(line.id || `${haloInvoice.id}-${lineItems.indexOf(line)}`),
                description: line.item_shortdescription || line.item_longdescription || line.linked_item?.name || 'Item',
                quantity: parseFloat(line.qty_order || line.quantity || 1),
                unit_price: parseFloat(line.unit_price || 0),
                net_amount: parseFloat(line.net_amount || 0),
                tax: parseFloat(line.tax_amount || 0),
                item_code: line.item_code || ''
              }).select().single();
              if (error) throw new Error(error.message);
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

    return {
      success: true,
      recordsSynced,
      recordsFailed,
      message: `Synced ${recordsSynced} invoices with line items`
    };
  }

  const err = new Error('Invalid action. Use: sync_customer or sync_customer_full');
  err.statusCode = 400;
  throw err;
}
