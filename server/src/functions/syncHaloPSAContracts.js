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

    console.log(`[HaloPSA] Found ${contracts.length} contracts for client ${customer_id}`);

    // Mapping helpers
    const typeMap = {
      'managed': 'managed_services', 'managed services': 'managed_services',
      'break fix': 'break_fix', 'breakfix': 'break_fix',
      'project': 'project', 'subscription': 'subscription',
    };
    const statusMap = {
      'active': 'active', 'pending': 'pending', 'expired': 'expired',
      'cancelled': 'cancelled', 'canceled': 'cancelled', 'inactive': 'expired',
    };
    const billingMap = {
      'monthly': 'monthly', 'quarterly': 'quarterly', 'annually': 'annually',
      'annual': 'annually', 'yearly': 'annually',
      'one time': 'one_time', 'one-time': 'one_time', 'onetime': 'one_time',
    };
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      if (dateStr.includes('2099')) return null;
      return dateStr.split('T')[0];
    };

    // Get existing contracts in one call
    const { data: existingContracts } = await supabase
      .from('contracts')
      .select('*')
      .eq('customer_id', dbCustomer.id)
      .eq('source', 'halopsa');

    const existingByExternalId = Object.fromEntries(
      (existingContracts || []).map(c => [c.external_id, c])
    );

    const toCreate = [];
    const toUpdate = [];

    for (const haloContract of contracts) {
      console.log(`[HaloPSA] Contract fields:`, JSON.stringify(Object.keys(haloContract)));
      console.log(`[HaloPSA] Contract type fields: type_name=${haloContract.type_name}, typename=${haloContract.typename}, type=${haloContract.type}, contract_type=${haloContract.contract_type}, contracttype=${haloContract.contracttype}, contract_type_name=${haloContract.contract_type_name}`);
      const rawTypeName = haloContract.type_name || haloContract.typename || haloContract.type || haloContract.contract_type_name || haloContract.contracttype || '';
      const rawType = rawTypeName.toLowerCase();
      const contractType = typeMap[rawType]
        || (rawType.includes('managed') ? 'managed_services' : null)
        || (rawType.includes('break') && rawType.includes('fix') ? 'break_fix' : null)
        || (rawType.includes('project') ? 'project' : null)
        || (rawType.includes('subscription') ? 'subscription' : null)
        || 'other';

      let contractStatus = 'active';
      const contractStatusStr = haloContract.contract_status || haloContract.status_name || haloContract.statusname || '';
      if (typeof contractStatusStr === 'string' && contractStatusStr) {
        contractStatus = statusMap[contractStatusStr.toLowerCase()] || 'active';
      } else if (haloContract.active === true) {
        contractStatus = 'active';
      } else if (haloContract.expired === true) {
        contractStatus = 'expired';
      }

      const rawBilling = (haloContract.billing_cycle || haloContract.billingcycle || haloContract.billingfrequency || 'monthly').toLowerCase();
      const billingCycle = billingMap[rawBilling] || 'monthly';

      const contractPayload = {
        customer_id: dbCustomer.id,
        name: haloContract.contractname || haloContract.ref || haloContract.client_name || haloContract.name || `Contract ${haloContract.id}`,
        external_id: String(haloContract.id),
        source: 'halopsa',
        contract_type: contractType,
        contract_type_raw: rawTypeName || null,
        status: contractStatus,
        start_date: parseDate(haloContract.start_date || haloContract.startdate),
        end_date: parseDate(haloContract.end_date || haloContract.enddate),
        billing_cycle: billingCycle,
        value: parseFloat(haloContract.periodchargeamount || haloContract.contractvalue || haloContract.value || haloContract.monthlyvalue || 0) || 0,
        notes: haloContract.notes || haloContract.description || '',
      };

      const existing = existingByExternalId[String(haloContract.id)];
      if (existing) {
        toUpdate.push({ id: existing.id, data: contractPayload });
      } else {
        toCreate.push(contractPayload);
      }
    }

    let recordsSynced = 0;
    let recordsFailed = 0;
    const errors = [];

    // Bulk insert new contracts
    if (toCreate.length > 0) {
      const { error } = await supabase.from('contracts').insert(toCreate);
      if (error) {
        console.error(`[HaloPSA] Contract bulk insert error: ${error.message}`);
        errors.push(error.message);
        recordsFailed += toCreate.length;
      } else {
        recordsSynced += toCreate.length;
      }
    }

    // Parallel update existing contracts (batches of 20)
    const BATCH_SIZE = 20;
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(item => supabase.from('contracts').update(item.data).eq('id', item.id))
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && !r.value.error) {
          recordsSynced++;
        } else {
          const errMsg = r.status === 'rejected' ? r.reason?.message : r.value?.error?.message;
          errors.push(`Contract ${batch[idx].id}: ${errMsg}`);
          recordsFailed++;
        }
      });
    }

    return {
      success: true,
      recordsSynced,
      recordsFailed,
      errors: errors.slice(0, 5),
      message: `Synced ${recordsSynced} contracts`,
    };
  }

  const err = new Error('Invalid action. Use: sync_customer');
  err.statusCode = 400;
  throw err;
}
