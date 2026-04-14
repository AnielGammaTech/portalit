import { getServiceSupabase } from '../lib/supabase.js';
import {
  getHaloConfig,
  haloGet,
  extractRecords,
  mapHaloUserToContact,
} from '../lib/halopsa.js';

export async function syncHaloPSAContacts(body, _user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;
  const config = await getHaloConfig();

  // ── sync_customer ──────────────────────────────────────────────────
  if (action === 'sync_customer') {
    if (!customer_id) {
      throw Object.assign(new Error('customer_id is required'), { statusCode: 400 });
    }

    // Find customer in database
    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .eq('external_id', String(customer_id))
      .eq('source', 'halopsa');

    const dbCustomer = (customers || [])[0];
    if (!dbCustomer) {
      throw Object.assign(new Error('Customer not found in database'), { statusCode: 404 });
    }

    // Get existing contacts
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('customer_id', dbCustomer.id);
    const existingContactMap = new Map(
      (existingContacts || []).map(c => [c.halopsa_id, c]),
    );

    // Fetch users from HaloPSA
    const safeId = String(customer_id).replace(/[^a-zA-Z0-9_-]/g, '');
    const data = await haloGet(`Users?client_id=${safeId}&page_size=500`, config);
    const users = extractRecords(data, 'users');

    const syncedHaloPSAIds = new Set();
    const toCreate = [];
    const toUpdate = [];

    for (const haloUser of users) {
      const haloPSAId = String(haloUser.id);
      syncedHaloPSAIds.add(haloPSAId);
      const contactPayload = mapHaloUserToContact(haloUser, dbCustomer.id);
      const existing = existingContactMap.get(haloPSAId);
      if (existing) {
        toUpdate.push({ id: existing.id, data: contactPayload });
      } else {
        toCreate.push(contactPayload);
      }
    }

    let recordsSynced = 0;
    let recordsFailed = 0;

    // Bulk insert new contacts
    if (toCreate.length > 0) {
      const { error } = await supabase.from('contacts').insert(toCreate);
      if (error) {
        console.error(`[HaloPSA] Bulk insert error: ${error.message}`);
        recordsFailed += toCreate.length;
      } else {
        recordsSynced += toCreate.length;
      }
    }

    // Parallel update existing contacts (batches of 20)
    const BATCH_SIZE = 20;
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(item => supabase.from('contacts').update(item.data).eq('id', item.id))
      );
      results.forEach(r => {
        if (r.status === 'fulfilled' && !r.value.error) recordsSynced++;
        else recordsFailed++;
      });
    }

    // Handle removed contacts (parallel)
    const missingContacts = (existingContacts || []).filter(
      c => c.halopsa_id && !syncedHaloPSAIds.has(c.halopsa_id),
    );
    let recordsDeleted = 0;
    let recordsFlagged = 0;

    if (missingContacts.length > 0) {
      const removalResults = await Promise.allSettled(
        missingContacts.map(async (contact) => {
          const { data: licenses } = await supabase
            .from('license_assignments')
            .select('id')
            .eq('contact_id', contact.id)
            .eq('status', 'active')
            .limit(1);

          if (licenses?.length) {
            await supabase.from('activities').insert({
              type: 'license_revoked',
              title: 'User Removed from HaloPSA with Active Licenses',
              description: `${contact.full_name} (${contact.email || 'no email'}) removed from HaloPSA but has active license(s).`,
              entity_type: 'customer',
              entity_id: dbCustomer.id,
              entity_name: dbCustomer.name,
              metadata: JSON.stringify({
                contact_id: contact.id,
                contact_name: contact.full_name,
                contact_email: contact.email,
                license_count: licenses.length,
                action_needed: 'Review and revoke licenses if appropriate',
              }),
            });
            return 'flagged';
          } else {
            await supabase.from('contacts').delete().eq('id', contact.id);
            return 'deleted';
          }
        })
      );
      recordsDeleted = removalResults.filter(r => r.status === 'fulfilled' && r.value === 'deleted').length;
      recordsFlagged = removalResults.filter(r => r.status === 'fulfilled' && r.value === 'flagged').length;
    }

    // Update customer total_users
    await supabase
      .from('customers')
      .update({ total_users: users.length })
      .eq('id', dbCustomer.id);

    return {
      success: true,
      recordsSynced,
      recordsFailed,
      recordsDeleted,
      recordsFlagged,
      haloUserCount: users.length,
      message: `Synced ${recordsSynced} users, deleted ${recordsDeleted}, flagged ${recordsFlagged} with active licenses`,
    };
  }

  // ── delete_customer_contacts ───────────────────────────────────────
  if (action === 'delete_customer_contacts') {
    if (!customer_id) {
      throw Object.assign(new Error('customer_id is required'), { statusCode: 400 });
    }

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('customer_id', customer_id);

    let deleted = 0;
    for (const contact of (contacts || [])) {
      await supabase.from('contacts').delete().eq('id', contact.id);
      deleted++;
    }

    return { success: true, deleted, message: `Deleted ${deleted} contacts` };
  }

  throw Object.assign(new Error('Invalid action. Use: sync_customer or delete_customer_contacts'), { statusCode: 400 });
}
