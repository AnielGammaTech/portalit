import { getServiceSupabase } from '../lib/supabase.js';
import { getHaloConfig, haloGet, extractRecords } from '../lib/halopsa.js';

export async function syncHaloPSAContracts(body, _user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;
  const config = await getHaloConfig();

  if (action === 'sync_customer') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    console.log(`Syncing contracts for customer external_id: ${customer_id}`);

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

    console.log(`Found customer: ${dbCustomer.name} (id: ${dbCustomer.id})`);

    // Fetch contracts from HaloPSA for this client
    const data = await haloGet(`ClientContract?client_id=${customer_id}&pageinate=false`, config);
    const contracts = extractRecords(data, 'contracts');

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
        // contract_status is the string value (e.g., "Active"), status is numeric
        let contractStatus = 'active';
        const contractStatusStr = haloContract.contract_status || haloContract.status_name || haloContract.statusname || '';
        if (typeof contractStatusStr === 'string') {
          const rawStatus = contractStatusStr.toLowerCase();
          const statusMap = {
            'active': 'active',
            'pending': 'pending',
            'expired': 'expired',
            'cancelled': 'cancelled',
            'canceled': 'cancelled',
            'inactive': 'expired'
          };
          contractStatus = statusMap[rawStatus] || 'active';
        } else if (haloContract.active === true) {
          contractStatus = 'active';
        } else if (haloContract.expired === true) {
          contractStatus = 'expired';
        }

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

        // Parse dates properly
        const parseDate = (dateStr) => {
          if (!dateStr) return null;
          // Check for invalid dates like 2099-12-31
          if (dateStr.includes('2099')) return null;
          return dateStr.split('T')[0]; // Return just the date part
        };

        const contractPayload = {
          customer_id: dbCustomer.id,
          customer_name: dbCustomer.name,
          name: haloContract.contractname || haloContract.ref || haloContract.client_name || haloContract.name || `Contract ${haloContract.id}`,
          external_id: String(haloContract.id),
          source: 'halopsa',
          type: contractType,
          status: contractStatus,
          start_date: parseDate(haloContract.start_date || haloContract.startdate),
          end_date: parseDate(haloContract.end_date || haloContract.enddate),
          renewal_date: parseDate(haloContract.next_invoice_date || haloContract.renewaldate || haloContract.renewal_date),
          billing_cycle: billingCycle,
          value: parseFloat(haloContract.periodchargeamount || haloContract.contractvalue || haloContract.value || haloContract.monthlyvalue || 0) || 0,
          description: haloContract.notes || haloContract.description || '',
          auto_renew: haloContract.autorenew === true || haloContract.auto_renew === true || false
        };

        console.log(`Contract payload: ${JSON.stringify(contractPayload)}`);

        // Check if contract exists
        let existingQuery = supabase.from('contracts').select('*');
        existingQuery = existingQuery.eq('external_id', String(haloContract.id));
        existingQuery = existingQuery.eq('source', 'halopsa');
        const { data: existing } = await existingQuery;

        if ((existing || []).length > 0) {
          await supabase.from('contracts').update(contractPayload).eq('id', existing[0].id).select().single();
          console.log(`Updated contract ${haloContract.id}`);
        } else {
          const { error } = await supabase.from('contracts').insert(contractPayload).select().single();
          if (error) throw new Error(error.message);
          console.log(`Created contract ${haloContract.id}`);
        }

        recordsSynced++;
      } catch (err) {
        console.log(`Error syncing contract ${haloContract.id}: ${err.message}`);
        errors.push(err.message);
        recordsFailed++;
      }
    }

    return {
      success: true,
      recordsSynced,
      recordsFailed,
      errors: errors.slice(0, 5),
      message: `Synced ${recordsSynced} contracts`
    };
  }

  const err = new Error('Invalid action. Use: sync_customer');
  err.statusCode = 400;
  throw err;
}
