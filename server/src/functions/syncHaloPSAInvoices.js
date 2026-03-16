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

  if (action === 'sync_customer' || action === 'sync_customer_full') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    // Find customer in database
    const { data: customers } = await supabase.from('customers').select('*')
      .eq('external_id', String(customer_id))
      .eq('source', 'halopsa');
    const dbCustomer = (customers || [])[0];
    if (!dbCustomer) {
      const err = new Error('Customer not found in database');
      err.statusCode = 404;
      throw err;
    }

    // Fetch all invoices with pagination
    console.log(`[HaloPSA] Syncing invoices + line items for customer ${customer_id}`);

    let allInvoices = [];
    let page = 1;

    while (true) {
      const data = await haloGet(`Invoice?client_id=${customer_id}&page_size=200&page_no=${page}`, config);
      const pageInvoices = extractRecords(data, 'invoices');
      if (pageInvoices.length === 0) break;
      allInvoices = allInvoices.concat(pageInvoices);
      if (pageInvoices.length < 200 || page > 50) break;
      page++;
    }

    console.log(`[HaloPSA] Found ${allInvoices.length} invoices for client ${customer_id}`);

    // Batch-fetch existing invoices for this customer (avoid N+1)
    const { data: existingInvoices } = await supabase.from('invoices').select('id, halopsa_id')
      .eq('customer_id', dbCustomer.id);
    const existingMap = new Map((existingInvoices || []).map(i => [i.halopsa_id, i.id]));

    let recordsSynced = 0;
    let recordsFailed = 0;

    const toCreate = [];
    const toUpdate = [];

    for (const haloInvoice of allInvoices) {
      const invoicePayload = transformInvoice(haloInvoice, dbCustomer.id);
      const existingId = existingMap.get(String(haloInvoice.id));
      if (existingId) {
        toUpdate.push({ id: existingId, data: invoicePayload, haloId: haloInvoice.id });
      } else {
        toCreate.push({ payload: invoicePayload, haloId: haloInvoice.id });
      }
    }

    // Bulk create new invoices
    let createdInvoices = [];
    if (toCreate.length > 0) {
      const { data: created, error } = await supabase.from('invoices')
        .insert(toCreate.map(c => c.payload)).select();
      if (error) throw new Error(error.message);
      createdInvoices = created || [];
      recordsSynced += createdInvoices.length;
    }

    // Batch update existing invoices (parallel batches of 20)
    const BATCH_SIZE = 20;
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(item => supabase.from('invoices').update(item.data).eq('id', item.id))
      );
      for (const r of batchResults) {
        if (r.status === 'fulfilled' && !r.value.error) {
          recordsSynced++;
        } else {
          recordsFailed++;
        }
      }
    }

    // ── Sync line items for all invoices ──
    // Build a map of haloId -> dbInvoiceId
    const invoiceIdMap = new Map();
    for (let i = 0; i < createdInvoices.length; i++) {
      invoiceIdMap.set(String(toCreate[i].haloId), createdInvoices[i].id);
    }
    for (const upd of toUpdate) {
      invoiceIdMap.set(String(upd.haloId), upd.id);
    }

    // Fetch line items from HaloPSA for each invoice (batched, 5 concurrent)
    const allDbInvoiceIds = [...invoiceIdMap.values()];
    const allNewLineItems = [];
    const CONCURRENCY = 5;

    for (let i = 0; i < allInvoices.length; i += CONCURRENCY) {
      const batch = allInvoices.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (haloInvoice) => {
          try {
            const detail = await haloGet(`Invoice/${haloInvoice.id}`, config);
            const lines = detail.lines || detail.lineitems || detail.items || [];
            const dbInvoiceId = invoiceIdMap.get(String(haloInvoice.id));
            if (!dbInvoiceId || lines.length === 0) return [];

            return lines.map((line, idx) => ({
              invoice_id: dbInvoiceId,
              halopsa_id: String(line.id || `${haloInvoice.id}-${idx}`),
              description: line.item_shortdescription || line.item_longdescription || line.linked_item?.name || 'Item',
              quantity: parseFloat(line.qty_order || line.quantity || 1),
              unit_price: parseFloat(line.unit_price || 0),
              total: parseFloat(line.net_amount || line.total || 0),
              tax: parseFloat(line.tax_amount || 0),
              item_code: line.item_code || ''
            }));
          } catch (err) {
            console.log(`[HaloPSA] Could not fetch line items for invoice ${haloInvoice.id}: ${err.message}`);
            return [];
          }
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.length > 0) {
          allNewLineItems.push(...r.value);
        }
      }
    }

    // Bulk delete old line items for all synced invoices, then bulk insert new ones
    if (allDbInvoiceIds.length > 0) {
      await supabase.from('invoice_line_items').delete().in('invoice_id', allDbInvoiceIds);
    }
    if (allNewLineItems.length > 0) {
      // Insert in batches of 500 to avoid payload limits
      for (let i = 0; i < allNewLineItems.length; i += 500) {
        const batch = allNewLineItems.slice(i, i + 500);
        const { error } = await supabase.from('invoice_line_items').insert(batch);
        if (error) console.error(`[HaloPSA] Line items insert error: ${error.message}`);
      }
    }

    console.log(`[HaloPSA] Synced ${recordsSynced} invoices, ${allNewLineItems.length} line items`);

    return {
      success: true,
      recordsSynced,
      recordsFailed,
      lineItemsSynced: allNewLineItems.length,
      message: `Synced ${recordsSynced} invoices with ${allNewLineItems.length} line items`
    };
  }

  if (action === 'sync_now') {
    // Nightly sync: iterate all HaloPSA customers and sync invoices + line items
    const { data: allCustomers } = await supabase.from('customers').select('id, external_id, name')
      .eq('source', 'halopsa');

    if (!allCustomers || allCustomers.length === 0) {
      return { success: true, message: 'No HaloPSA customers found', recordsSynced: 0 };
    }

    console.log(`[HaloPSA] Nightly invoice sync for ${allCustomers.length} customers`);

    let totalSynced = 0;
    let totalFailed = 0;
    let totalLineItems = 0;
    const CONCURRENCY = 3;

    for (let i = 0; i < allCustomers.length; i += CONCURRENCY) {
      const batch = allCustomers.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (cust) => {
          try {
            const result = await syncHaloPSAInvoices(
              { action: 'sync_customer', customer_id: cust.external_id },
              _user
            );
            return result;
          } catch (err) {
            console.error(`[HaloPSA] Invoice sync failed for ${cust.name}: ${err.message}`);
            return { recordsSynced: 0, recordsFailed: 1, lineItemsSynced: 0 };
          }
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          totalSynced += r.value.recordsSynced || 0;
          totalFailed += r.value.recordsFailed || 0;
          totalLineItems += r.value.lineItemsSynced || 0;
        } else {
          totalFailed++;
        }
      }
    }

    return {
      success: true,
      recordsSynced: totalSynced,
      recordsFailed: totalFailed,
      lineItemsSynced: totalLineItems,
      message: `Synced ${totalSynced} invoices, ${totalLineItems} line items across ${allCustomers.length} customers`
    };
  }

  const err = new Error('Invalid action. Use: sync_customer, sync_customer_full, or sync_now');
  err.statusCode = 400;
  throw err;
}
