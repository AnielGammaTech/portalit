/**
 * HaloPSA REST Routes
 *
 * Dedicated endpoints for HaloPSA integration:
 *   GET  /api/halo/status        — config + connection status
 *   POST /api/halo/test          — test connection
 *   POST /api/halo/sync          — full customer sync
 *   POST /api/halo/sync/customer — single customer + contacts
 *   POST /api/halo/sync/contacts — contacts for one customer
 *   GET  /api/halo/customers     — list HaloPSA customers (preview)
 */

import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getServiceSupabase } from '../lib/supabase.js';
import {
  getHaloConfig,
  isHaloConfigured,
  haloGet,
  extractRecords,
  mapHaloClientToCustomer,
  mapHaloUserToContact,
} from '../lib/halopsa.js';

const router = Router();

// ── GET /api/halo/status ─────────────────────────────────────────────────

router.get('/status', requireAuth, async (_req, res, next) => {
  try {
    const configured = await isHaloConfigured();

    const supabase = getServiceSupabase();
    const { data: lastSync } = await supabase
      .from('sync_logs')
      .select('completed_at, status, records_synced, error_message')
      .eq('source', 'halopsa')
      .order('completed_at', { ascending: false })
      .limit(1);

    // Count customers synced from HaloPSA
    const { count } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'halopsa');

    res.json({
      configured,
      customerCount: count || 0,
      lastSync: lastSync?.[0] || null,
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/halo/test ──────────────────────────────────────────────────

router.post('/test', requireAdmin, async (_req, res, next) => {
  try {
    const config = await getHaloConfig();
    const data = await haloGet('Client?count=1', config);
    const records = extractRecords(data, 'clients');
    const totalCount = data.record_count || data.recordCount || records.length;

    res.json({
      success: true,
      message: `Connection successful — ${totalCount} customers found in HaloPSA`,
      customerCount: totalCount,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    });
  }
});

// ── POST /api/halo/sync ─────────────────────────────────────────────────
// Full bulk customer sync

router.post('/sync', requireAdmin, async (_req, res, next) => {
  try {
    const config = await getHaloConfig();
    const supabase = getServiceSupabase();

    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        source: 'halopsa',
        status: 'in_progress',
        sync_type: 'full',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (logError) throw new Error(logError.message);

    let recordsSynced = 0;
    let recordsFailed = 0;
    const errors = [];

    try {
      // Fetch all active clients with pagination
      let allClients = [];
      let pageNumber = 1;
      const pageSize = 1000;

      while (true) {
        const url = `Client?pageinate=true&page_size=${pageSize}&page_no=${pageNumber}&isactive=true`;
        console.log(`[HaloPSA] Fetching page ${pageNumber}`);
        const data = await haloGet(url, config);
        const clients = extractRecords(data, 'clients');

        if (!clients.length) break;
        allClients = [...allClients, ...clients];

        const totalCount = data.record_count || data.recordCount || data.total_count || 0;
        console.log(`[HaloPSA] Page ${pageNumber}: ${clients.length} clients (total so far: ${allClients.length}/${totalCount})`);

        if (clients.length < pageSize) break;
        if (totalCount > 0 && allClients.length >= totalCount) break;
        if (pageNumber > 20) break; // Safety limit
        pageNumber++;
      }

      console.log(`[HaloPSA] Total clients fetched: ${allClients.length}`);

      // Get existing customers in one call
      const { data: existingCustomers } = await supabase
        .from('customers')
        .select('*')
        .eq('source', 'halopsa');

      const existingByExternalId = Object.fromEntries(
        (existingCustomers || []).map(c => [c.external_id, c])
      );

      const toCreate = [];
      const toUpdate = [];

      for (const client of allClients) {
        if (config.excludedIds.includes(String(client.id))) continue;
        if (client.inactive === true) continue;

        const customerData = mapHaloClientToCustomer(client);
        const existing = existingByExternalId[String(client.id)];

        if (existing) {
          toUpdate.push({ id: existing.id, data: customerData });
        } else {
          toCreate.push(customerData);
        }
      }

      // Bulk create
      if (toCreate.length > 0) {
        const { error } = await supabase.from('customers').insert(toCreate).select();
        if (error) throw new Error(error.message);
        recordsSynced += toCreate.length;
      }

      // Update existing
      for (const item of toUpdate) {
        try {
          const { error } = await supabase
            .from('customers')
            .update(item.data)
            .eq('id', item.id);
          if (error) throw new Error(error.message);
          recordsSynced++;
        } catch (err) {
          errors.push(`Update ${item.id}: ${err.message}`);
          recordsFailed++;
        }
      }

      // Update sync log
      await supabase
        .from('sync_logs')
        .update({
          status: errors.length > 0 ? 'partial' : 'success',
          records_synced: recordsSynced,
          records_failed: recordsFailed,
          error_message: errors.length > 0 ? JSON.stringify(errors) : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);

      res.json({
        success: true,
        message: `Synced ${recordsSynced} customers (${toCreate.length} new, ${toUpdate.length - recordsFailed} updated)`,
        recordsSynced,
        recordsFailed,
        created: toCreate.length,
        updated: toUpdate.length - recordsFailed,
      });
    } catch (syncError) {
      errors.push(syncError.message);
      await supabase
        .from('sync_logs')
        .update({
          status: 'failed',
          records_synced: recordsSynced,
          records_failed: recordsFailed,
          error_message: JSON.stringify(errors),
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
      throw syncError;
    }
  } catch (error) {
    next(error);
  }
});

// ── POST /api/halo/sync/customer ─────────────────────────────────────────
// Single customer + their contacts

router.post('/sync/customer', requireAdmin, async (req, res, next) => {
  try {
    const { customer_id } = req.body;
    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required (HaloPSA external ID)' });
    }

    const config = await getHaloConfig();
    const supabase = getServiceSupabase();

    // 1. Fetch customer from HaloPSA
    const clientData = await haloGet(`Client/${customer_id}`, config);
    const customerPayload = mapHaloClientToCustomer(clientData);

    // 2. Upsert in database
    const { data: existingArr } = await supabase
      .from('customers')
      .select('*')
      .eq('external_id', String(clientData.id))
      .eq('source', 'halopsa');

    const existing = (existingArr || [])[0];
    let dbCustomer;

    if (existing) {
      const { data, error } = await supabase
        .from('customers')
        .update(customerPayload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      dbCustomer = data;
    } else {
      const { data, error } = await supabase
        .from('customers')
        .insert(customerPayload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      dbCustomer = data;
    }

    // 3. Sync contacts for this customer
    const usersData = await haloGet(`Users?client_id=${customer_id}&page_size=500`, config);
    const haloUsers = extractRecords(usersData, 'users');

    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('customer_id', dbCustomer.id);

    const existingContactMap = new Map(
      (existingContacts || []).map(c => [c.halopsa_id, c])
    );

    const syncedIds = new Set();
    let contactsSynced = 0;
    let contactsFailed = 0;

    for (const haloUser of haloUsers) {
      try {
        const haloPSAId = String(haloUser.id);
        syncedIds.add(haloPSAId);
        const contactPayload = mapHaloUserToContact(haloUser, dbCustomer.id);
        const existingContact = existingContactMap.get(haloPSAId);

        if (existingContact) {
          await supabase.from('contacts').update(contactPayload).eq('id', existingContact.id);
        } else {
          const { error } = await supabase.from('contacts').insert(contactPayload);
          if (error) throw new Error(error.message);
        }
        contactsSynced++;
      } catch (err) {
        console.error(`[HaloPSA] Error syncing user ${haloUser.id}: ${err.message}`);
        contactsFailed++;
      }
    }

    // 4. Handle removed contacts (those in DB but not in HaloPSA anymore)
    const removedContacts = (existingContacts || []).filter(
      c => c.halopsa_id && !syncedIds.has(c.halopsa_id)
    );
    let contactsDeleted = 0;

    for (const contact of removedContacts) {
      // Check for active license assignments before deleting
      const { data: licenses } = await supabase
        .from('license_assignments')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('status', 'active')
        .limit(1);

      if (!licenses?.length) {
        await supabase.from('contacts').delete().eq('id', contact.id);
        contactsDeleted++;
      }
    }

    // 5. Update customer total_users
    await supabase
      .from('customers')
      .update({ total_users: haloUsers.length })
      .eq('id', dbCustomer.id);

    res.json({
      success: true,
      customer: { id: dbCustomer.id, name: dbCustomer.name },
      contactsSynced,
      contactsFailed,
      contactsDeleted,
      haloUserCount: haloUsers.length,
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/halo/sync/contacts ─────────────────────────────────────────
// Sync contacts for one customer (by PortalIT customer UUID)

router.post('/sync/contacts', requireAdmin, async (req, res, next) => {
  try {
    const { customer_id } = req.body;
    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id (PortalIT UUID) is required' });
    }

    const config = await getHaloConfig();
    const supabase = getServiceSupabase();

    // Look up customer
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customer_id)
      .eq('source', 'halopsa')
      .single();

    if (custErr || !customer) {
      return res.status(404).json({ error: 'HaloPSA customer not found in database' });
    }

    // Fetch contacts from HaloPSA
    const usersData = await haloGet(`Users?client_id=${customer.external_id}&page_size=500`, config);
    const haloUsers = extractRecords(usersData, 'users');

    // Get existing contacts
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('customer_id', customer.id);

    const existingMap = new Map(
      (existingContacts || []).map(c => [c.halopsa_id, c])
    );

    let synced = 0;
    let failed = 0;

    for (const haloUser of haloUsers) {
      try {
        const contactPayload = mapHaloUserToContact(haloUser, customer.id);
        const existing = existingMap.get(String(haloUser.id));

        if (existing) {
          await supabase.from('contacts').update(contactPayload).eq('id', existing.id);
        } else {
          const { error } = await supabase.from('contacts').insert(contactPayload);
          if (error) throw new Error(error.message);
        }
        synced++;
      } catch (err) {
        console.error(`[HaloPSA] Contact sync error: ${err.message}`);
        failed++;
      }
    }

    // Update customer total_users
    await supabase
      .from('customers')
      .update({ total_users: haloUsers.length })
      .eq('id', customer.id);

    res.json({ success: true, synced, failed, total: haloUsers.length });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/halo/customers ──────────────────────────────────────────────
// Preview: fetch first page of HaloPSA customers (for mapping UI)

router.get('/customers', requireAdmin, async (_req, res, next) => {
  try {
    const config = await getHaloConfig();
    const data = await haloGet('Client?pageinate=true&page_size=50&page_no=1&isactive=true', config);
    const clients = extractRecords(data, 'clients');
    const totalCount = data.record_count || data.recordCount || clients.length;

    res.json({
      customers: clients.map(c => ({
        id: c.id,
        name: c.name || c.Name,
        email: c.main_email_address || c.email || '',
        inactive: c.inactive || false,
      })),
      totalCount,
    });
  } catch (error) {
    next(error);
  }
});

export { router as haloRouter };
