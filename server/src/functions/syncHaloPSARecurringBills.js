import { getServiceSupabase } from '../lib/supabase.js';
import { getHaloConfig, haloGet, extractRecords } from '../lib/halopsa.js';

// Map HaloPSA period codes/names to normalized frequency
function normalizeFrequency(haloBill) {
  // HaloPSA uses various field names for repeat period
  const raw = haloBill.period || haloBill.Period || haloBill.frequency || haloBill.Frequency ||
    haloBill.billing_cycle || haloBill.BillingCycle || haloBill.repeat_period || haloBill.RepeatPeriod ||
    haloBill.recurringtype || haloBill.RecurringType || '';

  const val = String(raw).toLowerCase().trim();

  // Handle numeric codes (HaloPSA sometimes uses 1=monthly, 2=quarterly, 3=yearly etc.)
  if (val === '1' || val === 'monthly' || val === 'month') return 'monthly';
  if (val === '2' || val === 'quarterly' || val === 'quarter') return 'quarterly';
  if (val === '3' || val === '4' || val === 'yearly' || val === 'annual' || val === 'annually' || val === 'year') return 'yearly';
  if (val === 'weekly' || val === 'week') return 'weekly';

  // If we got nothing, log and default to monthly
  if (!val) return 'monthly';
  console.log(`[HaloPSA] Unknown frequency value "${raw}" for bill ${haloBill.id} — defaulting to monthly`);
  return 'monthly';
}

// Transform HaloPSA bill data to RecurringBill schema
function transformRecurringBill(haloBill, customerId) {
  return {
    customer_id: customerId,
    halopsa_id: String(haloBill.id),
    name: haloBill.name || haloBill.Name || `Bill ${haloBill.id}`,
    description: haloBill.description || haloBill.Description || '',
    amount: parseFloat(haloBill.total || haloBill.Total || 0) || 0,
    frequency: normalizeFrequency(haloBill),
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

export async function syncHaloPSARecurringBills(body, _user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;
  const config = await getHaloConfig();

  if (action === 'test_connection') {
    await haloGet('RecurringInvoice?page_number=1&page_size=1', config);
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
      // Find customer in database
      const { data: customers } = await supabase.from('customers').select('*')
        .eq('external_id', String(customer_id))
        .eq('source', 'halopsa');
      const dbCustomer = (customers || [])[0];
      if (!dbCustomer) throw new Error('Customer not found in database');

      // Fetch recurring bills WITH line items included (single API call)
      const data = await haloGet(`RecurringInvoice?client_id=${customer_id}&page_size=1000&includelines=true`, config);
      const recurringBills = extractRecords(data, 'invoices');

      // Batch-fetch existing bills for this customer (avoid N+1)
      const { data: existingBills } = await supabase.from('recurring_bills').select('*')
        .eq('customer_id', dbCustomer.id);
      const existingBillMap = new Map((existingBills || []).map(b => [b.halopsa_id, b]));

      const toCreate = [];
      const toUpdate = [];
      const billLineItems = new Map(); // halopsa_id -> line items

      for (const haloBill of recurringBills) {
        const billPayload = transformRecurringBill(haloBill, dbCustomer.id);
        const lineItems = haloBill.lines || haloBill.line_items || haloBill.LineItems || haloBill.Lines || [];
        const existing = existingBillMap.get(billPayload.halopsa_id);

        if (existing) {
          toUpdate.push({ id: existing.id, data: billPayload, halopsa_id: billPayload.halopsa_id });
          billLineItems.set(existing.id, lineItems);
        } else {
          toCreate.push(billPayload);
          billLineItems.set(billPayload.halopsa_id, lineItems);
        }
      }

      // Bulk create new bills
      let createdBills = [];
      if (toCreate.length > 0) {
        const { data: created, error } = await supabase.from('recurring_bills').insert(toCreate).select();
        if (error) throw new Error(error.message);
        createdBills = created || [];
        recordsSynced += createdBills.length;
      }

      // Batch update existing bills (parallel batches of 20)
      const BATCH_SIZE = 20;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(item => supabase.from('recurring_bills').update(item.data).eq('id', item.id))
        );
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled' && !r.value.error) recordsSynced++;
          else { recordsFailed++; errors.push(`Bill ${batch[idx].halopsa_id}: update failed`); }
        });
      }

      // Collect all bill IDs that need line item refresh
      const allBillIds = [
        ...createdBills.map(b => b.id),
        ...toUpdate.map(u => u.id),
      ];

      // Upsert line items (preserves UUIDs so manual Pax8 overrides stay valid)
      const allNewLineItems = [];
      for (const bill of createdBills) {
        const lines = billLineItems.get(bill.halopsa_id) || [];
        for (const line of lines) allNewLineItems.push(transformLineItem(line, bill.id));
      }
      for (const upd of toUpdate) {
        const lines = billLineItems.get(upd.id) || [];
        for (const line of lines) allNewLineItems.push(transformLineItem(line, upd.id));
      }
      if (allNewLineItems.length > 0) {
        const { error } = await supabase
          .from('recurring_bill_line_items')
          .upsert(allNewLineItems, { onConflict: 'recurring_bill_id,halopsa_id' });
        if (error) errors.push(`Line items upsert: ${error.message}`);
      }

      // Remove line items no longer in HaloPSA (deleted on vendor side)
      if (allBillIds.length > 0) {
        const newHaloIds = new Set(allNewLineItems.map(li => `${li.recurring_bill_id}:${li.halopsa_id}`));
        const { data: existingItems } = await supabase
          .from('recurring_bill_line_items')
          .select('id, recurring_bill_id, halopsa_id')
          .in('recurring_bill_id', allBillIds);
        const toDelete = (existingItems || [])
          .filter(item => !newHaloIds.has(`${item.recurring_bill_id}:${item.halopsa_id}`))
          .map(item => item.id);
        if (toDelete.length > 0) {
          await supabase.from('recurring_bill_line_items').delete().in('id', toDelete);
        }
      }

      await supabase.from('sync_logs').update({
        status: recordsFailed === 0 ? 'success' : 'partial',
        records_synced: recordsSynced,
        records_failed: recordsFailed,
        error_message: errors.length > 0 ? JSON.stringify(errors) : null,
        completed_at: new Date().toISOString()
      }).eq('id', syncLog.id);

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
      }).eq('id', syncLog.id);
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

    try {
      // Fetch all customers and existing bills upfront (avoid N+1)
      const { data: allCustomers } = await supabase.from('customers').select('id, external_id, source')
        .eq('source', 'halopsa');
      const { data: existingBills } = await supabase.from('recurring_bills').select('id, halopsa_id, customer_id');
      const customerMap = new Map((allCustomers || []).map(c => [c.external_id, c.id]));
      const billMap = new Map((existingBills || []).map(b => [`${b.halopsa_id}:${b.customer_id}`, b.id]));

      const allToCreate = [];
      const allToUpdate = [];

      // Paginate through HaloPSA recurring invoices WITH line items included
      let pageNumber = 1;
      let hasMore = true;

      while (hasMore) {
        const data = await haloGet(`RecurringInvoice?page_number=${pageNumber}&page_size=500&includelines=true`, config);
        const recurringBills = extractRecords(data, 'invoices');

        if (recurringBills.length === 0) break;

        for (const haloBill of recurringBills) {
          try {
            const customerId = customerMap.get(String(haloBill.client_id || haloBill.ClientID));
            if (!customerId) { recordsFailed++; continue; }

            const billPayload = transformRecurringBill(haloBill, customerId);
            // Get line items from included data (no separate API call)
            const lineItems = haloBill.lines || haloBill.line_items || haloBill.LineItems || haloBill.Lines || [];

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

      // Bulk create new bills
      let createdBills = [];
      if (allToCreate.length > 0) {
        const billsToCreate = allToCreate.map(({ _lineItems, ...rest }) => rest);
        const { data, error } = await supabase.from('recurring_bills').insert(billsToCreate).select();
        if (error) throw new Error(error.message);
        createdBills = data || [];
        recordsSynced += createdBills.length;
      }

      // Bulk insert line items for new bills
      const newLineItems = [];
      for (let i = 0; i < allToCreate.length; i++) {
        const bill = createdBills[i];
        const lines = allToCreate[i]._lineItems;
        if (Array.isArray(lines)) {
          for (const line of lines) newLineItems.push(transformLineItem(line, bill.id));
        }
      }
      if (newLineItems.length > 0) {
        await supabase.from('recurring_bill_line_items').insert(newLineItems);
      }

      // Batch update existing bills (parallel batches of 20)
      const BATCH_SIZE = 20;
      for (let i = 0; i < allToUpdate.length; i += BATCH_SIZE) {
        const batch = allToUpdate.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(item => supabase.from('recurring_bills').update(item.data).eq('id', item.id))
        );
        recordsSynced += batch.length;
      }

      // Upsert line items for updated bills (preserves UUIDs for manual overrides)
      const updateBillIds = allToUpdate.map(u => u.id);
      const updatedLineItems = [];
      for (const { id, lineItems } of allToUpdate) {
        if (Array.isArray(lineItems)) {
          for (const line of lineItems) updatedLineItems.push(transformLineItem(line, id));
        }
      }
      if (updatedLineItems.length > 0) {
        await supabase
          .from('recurring_bill_line_items')
          .upsert(updatedLineItems, { onConflict: 'recurring_bill_id,halopsa_id' });
      }
      // Remove line items no longer present in HaloPSA
      if (updateBillIds.length > 0) {
        const newHaloIds = new Set(updatedLineItems.map(li => `${li.recurring_bill_id}:${li.halopsa_id}`));
        const { data: existingItems } = await supabase
          .from('recurring_bill_line_items')
          .select('id, recurring_bill_id, halopsa_id')
          .in('recurring_bill_id', updateBillIds);
        const toDelete = (existingItems || [])
          .filter(item => !newHaloIds.has(`${item.recurring_bill_id}:${item.halopsa_id}`))
          .map(item => item.id);
        if (toDelete.length > 0) {
          await supabase.from('recurring_bill_line_items').delete().in('id', toDelete);
        }
      }

      await supabase.from('sync_logs').update({
        status: recordsFailed === 0 ? 'success' : 'partial',
        records_synced: recordsSynced,
        records_failed: recordsFailed,
        error_message: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
        completed_at: new Date().toISOString()
      }).eq('id', syncLog.id);

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
      }).eq('id', syncLog.id);
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }
  }

  const err = new Error('Invalid action');
  err.statusCode = 400;
  throw err;
}
