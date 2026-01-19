import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const UNITRENDS_API_BASE = 'https://public-api.backup.net';
const UNITRENDS_AUTH_URL = 'https://login.backup.net/connect/token';

let cachedToken = null;
let tokenExpiry = 0;

async function getUnitrendsToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiry > now) {
    return cachedToken;
  }

  const clientId = Deno.env.get('UNITRENDS_CLIENT_ID');
  const clientSecret = Deno.env.get('UNITRENDS_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Unitrends credentials not configured');
  }

  // Basic auth with Base64 encoded client_id:client_secret
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(UNITRENDS_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
      'Accept': '*/*'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Auth failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = now + ((data.expires_in || 3600) - 60) * 1000;
  return cachedToken;
}

async function unitrendsApiCall(endpoint) {
  const token = await getUnitrendsToken();
  const response = await fetch(`${UNITRENDS_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unitrends API error: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    const body = await req.json();
    const { action, customer_id, api_token, region } = body;

    // Test connection
    if (action === 'test_connection') {
      try {
        const customers = await unitrendsApiCall('/v1/customers?page_size=5');
        return Response.json({ 
          success: true, 
          totalCustomers: customers.length || 0
        });
      } catch (e) {
        return Response.json({ success: false, error: e.message });
      }
    }

    // List Spanning domains/tenants
    if (action === 'list_domains') {
      try {
        const domains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
        return Response.json({ 
          success: true, 
          domains: domains || []
        });
      } catch (e) {
        return Response.json({ success: false, error: e.message });
      }
    }

    // List users for a tenant
    if (action === 'list_users') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      const mappings = await base44.asServiceRole.entities.SpanningMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ error: 'No Spanning mapping found for this customer' }, { status: 400 });
      }

      const mapping = mappings[0];
      const users = await unitrendsApiCall(`/v2/spanning/domains/${mapping.spanning_tenant_id}/users?page_size=1000`);
      
      return Response.json({ 
        success: true, 
        users: users || [],
        total: users?.length || 0
      });
    }

    // Sync users to contacts
    if (action === 'sync_users') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      const mappings = await base44.asServiceRole.entities.SpanningMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ error: 'No Spanning mapping found for this customer' }, { status: 400 });
      }

      const mapping = mappings[0];
      const usersResponse = await unitrendsApiCall(`/v2/spanning/domains/${mapping.spanning_tenant_id}/users?page_size=1000`);
      const spanningUsers = usersResponse || [];

      // Get existing contacts
      const existingContacts = await base44.asServiceRole.entities.Contact.filter({ customer_id });
      const existingByEmail = {};
      existingContacts.forEach(c => { 
        if (c.email) existingByEmail[c.email.toLowerCase()] = c; 
      });

      let created = 0;
      let matched = 0;
      let updated = 0;

      for (const spUser of spanningUsers) {
        const email = spUser.userPrincipalName?.toLowerCase() || spUser.email?.toLowerCase();
        if (!email) continue;

        const fullName = spUser.displayName || spUser.name || email.split('@')[0];
        
        const existing = existingByEmail[email];
        if (existing) {
          if (existing.full_name !== fullName) {
            await base44.asServiceRole.entities.Contact.update(existing.id, {
              full_name: fullName
            });
            updated++;
          }
          matched++;
        } else {
          await base44.asServiceRole.entities.Contact.create({
            customer_id,
            full_name: fullName,
            email: email,
            source: 'spanning'
          });
          created++;
        }
      }

      // Update last_synced timestamp
      await base44.asServiceRole.entities.SpanningMapping.update(mapping.id, {
        last_synced: new Date().toISOString()
      });

      return Response.json({
        success: true,
        totalSpanningUsers: spanningUsers.length,
        created,
        matched,
        updated
      });
    }

    // Sync licenses (also syncs users/contacts)
    if (action === 'sync_licenses') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      const mappings = await base44.asServiceRole.entities.SpanningMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ error: 'No Spanning mapping found for this customer' }, { status: 400 });
      }

      const mapping = mappings[0];
      const usersResponse = await unitrendsApiCall(`/v2/spanning/domains/${mapping.spanning_tenant_id}/users?page_size=1000`);
      
      // Handle nested response structure - API returns { users: [{ users: [...] }] } or similar
      let users = [];
      if (Array.isArray(usersResponse)) {
        // Check if first element has nested users array
        if (usersResponse[0]?.users) {
          users = usersResponse[0].users;
        } else {
          users = usersResponse;
        }
      } else if (usersResponse?.users) {
        if (Array.isArray(usersResponse.users) && usersResponse.users[0]?.users) {
          users = usersResponse.users[0].users;
        } else {
          users = usersResponse.users;
        }
      }
      
      const totalUsers = users.length;
      const assignedUsers = users.filter(u => u.lastBackupStatusTotal === 'success').length || totalUsers;

      // Get customer name
      const customers = await base44.asServiceRole.entities.Customer.filter({ id: customer_id });
      const customer = customers[0];

      // Sync users as contacts
      const existingContacts = await base44.asServiceRole.entities.Contact.filter({ customer_id, source: 'spanning' });
      const existingByEmail = {};
      existingContacts.forEach(c => { 
        if (c.email) existingByEmail[c.email.toLowerCase()] = c; 
      });

      let contactsCreated = 0;
      let contactsUpdated = 0;

      for (const spUser of users) {
        const email = spUser.email?.toLowerCase() || spUser.userPrincipalName?.toLowerCase();
        if (!email) continue;

        const fullName = spUser.displayName || spUser.name || email.split('@')[0];
        const isActive = spUser.lastBackupStatusTotal === 'success' || spUser.assigned === true || spUser.isLicensed === true;
        
        // Calculate storage info from user data
        const mailStorageBytes = spUser.mailStorageBytes || spUser.exchangeStorageBytes || 0;
        const driveStorageBytes = spUser.driveStorageBytes || spUser.oneDriveStorageBytes || 0;
        const totalStorageBytes = mailStorageBytes + driveStorageBytes;
        
        // Format storage as human readable
        const formatStorage = (bytes) => {
          if (!bytes || bytes === 0) return null;
          if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
          if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
          return `${(bytes / 1024).toFixed(2)} KB`;
        };
        
        const storageInfo = formatStorage(totalStorageBytes);
        const backupStatus = spUser.lastBackupStatusTotal || (isActive ? 'success' : 'inactive');
        
        // Build title with storage and status info
        const titleParts = [];
        if (storageInfo) titleParts.push(storageInfo);
        titleParts.push(backupStatus);
        const contactTitle = titleParts.join(' | ');
        
        const existing = existingByEmail[email];
        if (existing) {
          await base44.asServiceRole.entities.Contact.update(existing.id, {
            full_name: fullName,
            title: contactTitle,
            source: 'spanning'
          });
          contactsUpdated++;
          delete existingByEmail[email];
        } else {
          await base44.asServiceRole.entities.Contact.create({
            customer_id,
            full_name: fullName,
            email: email,
            title: contactTitle,
            source: 'spanning'
          });
          contactsCreated++;
        }
      }

      // Sync license record
      const licenseId = `spanning-${customer_id}`;
      const existingLicenses = await base44.asServiceRole.entities.SaaSLicense.filter({ 
        customer_id, 
        source: 'spanning' 
      });

      const licenseData = {
        customer_id,
        customer_name: customer?.name,
        application_name: 'Spanning Backup',
        vendor: 'Unitrends',
        license_type: 'Microsoft 365 Backup',
        quantity: totalUsers,
        assigned_users: assignedUsers,
        status: 'active',
        external_id: licenseId,
        source: 'spanning',
        website_url: 'https://www.unitrends.com',
        logo_url: 'https://cdn.brandfetch.io/idBZmlTqXS/w/400/h/400/theme/dark/icon.png',
        category: 'backup',
        notes: `Spanning Backup - ${assignedUsers} users backed up from ${mapping.spanning_tenant_name || customer?.name}`
      };

      if (existingLicenses.length > 0) {
        await base44.asServiceRole.entities.SaaSLicense.update(existingLicenses[0].id, licenseData);
      } else {
        await base44.asServiceRole.entities.SaaSLicense.create(licenseData);
      }

      // Update last_synced
      await base44.asServiceRole.entities.SpanningMapping.update(mapping.id, {
        last_synced: new Date().toISOString()
      });

      return Response.json({
        success: true,
        totalUsers,
        assignedUsers,
        contactsCreated,
        contactsUpdated,
        tenantName: mapping.spanning_tenant_name
      });
    }

    // Sync all mapped customers
    if (action === 'sync_all') {
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }

      const allMappings = await base44.asServiceRole.entities.SpanningMapping.list();
      let synced = 0;
      let errors = 0;

      for (const mapping of allMappings) {
        try {
          const usersResponse = await unitrendsApiCall(`/v2/spanning/domains/${mapping.spanning_tenant_id}/users?page_size=1000`);
          const users = usersResponse || [];
          
          const assignedUsers = users.filter(u => u.isLicensed === true || u.assigned === true).length || users.length;
          const totalUsers = users.length;

          const customers = await base44.asServiceRole.entities.Customer.filter({ id: mapping.customer_id });
          const customer = customers[0];

          const existingLicenses = await base44.asServiceRole.entities.SaaSLicense.filter({ 
            customer_id: mapping.customer_id, 
            source: 'spanning' 
          });

          const licenseData = {
            customer_id: mapping.customer_id,
            customer_name: customer?.name,
            application_name: 'Spanning Backup',
            vendor: 'Unitrends',
            license_type: 'Microsoft 365 Backup',
            quantity: totalUsers,
            assigned_users: assignedUsers,
            status: 'active',
            external_id: `spanning-${mapping.customer_id}`,
            source: 'spanning',
            website_url: 'https://www.unitrends.com',
            logo_url: 'https://cdn.brandfetch.io/idBZmlTqXS/w/400/h/400/theme/dark/icon.png',
            category: 'backup',
            notes: `Spanning Backup - ${assignedUsers} users backed up`
          };

          if (existingLicenses.length > 0) {
            await base44.asServiceRole.entities.SaaSLicense.update(existingLicenses[0].id, licenseData);
          } else {
            await base44.asServiceRole.entities.SaaSLicense.create(licenseData);
          }

          await base44.asServiceRole.entities.SpanningMapping.update(mapping.id, {
            last_synced: new Date().toISOString()
          });

          synced++;
        } catch (e) {
          console.error(`Failed to sync mapping ${mapping.id}:`, e.message);
          errors++;
        }
      }

      return Response.json({ success: true, synced, errors });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});