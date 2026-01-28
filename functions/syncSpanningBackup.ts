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
        // Get full details for each domain to see license info
        const domainsWithDetails = domains || [];
        return Response.json({ 
          success: true, 
          domains: domainsWithDetails,
          sampleDomain: domainsWithDetails[0] || null
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
      const usersResponse = await unitrendsApiCall(`/v2/spanning/domains/${mapping.spanning_tenant_id}/users?page_size=1000`);
      
      // Parse nested response: [{ users: [...] }] or { users: [{ users: [...] }] }
      let users = [];
      if (Array.isArray(usersResponse)) {
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
      
      // Get all domains and find this one by ID
      const allDomains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
      const domainInfo = allDomains.find(d => d.id === mapping.spanning_tenant_id);
      
      // Format users with storage info
      const formatStorage = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
        if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
        return `${(bytes / 1024).toFixed(2)} KB`;
      };
      
      const formattedUsers = users.map(u => {
        const storageInfo = u.storageInformation || {};
        const mailBytes = storageInfo.protectedMailBytes || u.mailStorageBytes || u.exchangeStorageBytes || 0;
        const driveBytes = storageInfo.protectedBytes || u.driveStorageBytes || u.oneDriveStorageBytes || 0;
        const totalBytes = mailBytes + driveBytes;
        
        // User is protected if they have backup data or are assigned/licensed
        const hasBackupData = totalBytes > 0;
        const isAssigned = u.isAssigned === true || u.assigned === true || u.isLicensed === true;
        const hasSuccessBackup = u.lastBackupStatusTotal === 'success';
        const isProtected = hasBackupData || isAssigned || hasSuccessBackup;
        
        return {
          email: u.email || u.userPrincipalName || 'Unknown',
          displayName: u.displayName || u.email || 'Unknown',
          isProtected,
          backupStatus: u.lastBackupStatusTotal || 'unknown',
          mailStorage: formatStorage(mailBytes),
          driveStorage: formatStorage(driveBytes),
          totalStorage: formatStorage(totalBytes),
          totalStorageBytes: totalBytes,
          mailStorageBytes: mailBytes,
          driveStorageBytes: driveBytes,
          userType: u.userType || u.type || 'standard',
          lastBackupDate: u.lastBackupDate || null
        };
      });
      
      return Response.json({ 
        success: true, 
        total: users.length,
        users: formattedUsers,
        // Domain-level license counts (matches Spanning portal)
        numberOfStandardLicensesTotal: domainInfo?.numberOfStandardLicensesTotal || 0,
        numberOfProtectedStandardUsers: domainInfo?.numberOfProtectedStandardUsers || 0,
        numberOfArchivedLicensesTotal: domainInfo?.numberOfArchivedLicensesTotal || 0,
        numberOfProtectedArchivedUsers: domainInfo?.numberOfProtectedArchivedUsers || 0,
        numberOfUsers: domainInfo?.numberOfUsers || 0,
        numberOfProtectedUsers: domainInfo?.numberOfProtectedUsers || 0,
        numberOfSharedMailboxesTotal: domainInfo?.numberOfSharedMailboxesTotal || 0,
        numberOfProtectedSharedMailboxes: domainInfo?.numberOfProtectedSharedMailboxes || 0,
        domainName: domainInfo?.name || 'unknown',
        domainId: domainInfo?.id || 'unknown'
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
      
      // Handle nested response structure
      let spanningUsers = [];
      if (Array.isArray(usersResponse)) {
        if (usersResponse[0]?.users) {
          spanningUsers = usersResponse[0].users;
        } else {
          spanningUsers = usersResponse;
        }
      } else if (usersResponse?.users) {
        if (Array.isArray(usersResponse.users) && usersResponse.users[0]?.users) {
          spanningUsers = usersResponse.users[0].users;
        } else {
          spanningUsers = usersResponse.users;
        }
      }

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
        const email = spUser.email?.toLowerCase() || spUser.userPrincipalName?.toLowerCase();
        if (!email) continue;

        const isActive = spUser.lastBackupStatusTotal === 'success' || spUser.assigned === true || spUser.isLicensed === true;
        
        // Calculate storage info
        const storageInfoObj = spUser.storageInformation || {};
        const mailStorageBytes = storageInfoObj.protectedMailBytes || spUser.mailStorageBytes || spUser.exchangeStorageBytes || 0;
        const driveStorageBytes = storageInfoObj.protectedBytes || spUser.driveStorageBytes || spUser.oneDriveStorageBytes || 0;
        const totalStorageBytes = mailStorageBytes + driveStorageBytes;
        
        const formatStorage = (bytes) => {
          if (!bytes || bytes === 0) return null;
          if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
          if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
          return `${(bytes / 1024).toFixed(2)} KB`;
        };
        
        const storageStr = formatStorage(totalStorageBytes);
        const backupStatus = spUser.lastBackupStatusTotal || (isActive ? 'success' : 'inactive');
        const titleParts = [];
        if (storageStr) titleParts.push(storageStr);
        titleParts.push(backupStatus);
        if (isActive) titleParts.push('PROTECTED');
        const contactTitle = titleParts.join(' | ');
        
        const existing = existingByEmail[email];
        if (existing) {
          // Update existing contact with spanning info - NEVER change source
          await base44.asServiceRole.entities.Contact.update(existing.id, {
            spanning_status: contactTitle
          });
          updated++;
          matched++;
        }
        // NEVER create new contacts - Spanning only attaches to existing contacts
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

    // Sync licenses (contacts only, no SaaS license auto-creation)
    if (action === 'sync_licenses') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      const mappings = await base44.asServiceRole.entities.SpanningMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ error: 'No Spanning mapping found for this customer' }, { status: 400 });
      }

      const mapping = mappings[0];
      
      // Get all domains and find this one by ID for accurate license counts
      const allDomains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
      const domainInfo = allDomains.find(d => d.id === mapping.spanning_tenant_id);
      
      // Extract counts for each license type (for display only)
      const standardLicenses = domainInfo?.numberOfStandardLicensesTotal || 0;
      const protectedStandard = domainInfo?.numberOfProtectedStandardUsers || 0;
      const archivedLicenses = domainInfo?.numberOfArchivedLicensesTotal || 0;
      const protectedArchived = domainInfo?.numberOfProtectedArchivedUsers || 0;
      const sharedMailboxes = domainInfo?.numberOfSharedMailboxesTotal || 0;
      const protectedShared = domainInfo?.numberOfProtectedSharedMailboxes || 0;
      
      // Also get user list for contact syncing
      const usersResponse = await unitrendsApiCall(`/v2/spanning/domains/${mapping.spanning_tenant_id}/users?page_size=1000`);
      
      // Handle nested response structure
      let users = [];
      if (Array.isArray(usersResponse)) {
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

      // Sync users as contacts
      const existingContacts = await base44.asServiceRole.entities.Contact.filter({ customer_id });
      const existingByEmail = {};
      existingContacts.forEach(c => { 
        if (c.email) existingByEmail[c.email.toLowerCase()] = c; 
      });

      let contactsUpdated = 0;

      for (const spUser of users) {
        const email = spUser.email?.toLowerCase() || spUser.userPrincipalName?.toLowerCase();
        if (!email) continue;

        const isProtected = spUser.isAssigned === true || spUser.assigned === true || spUser.isLicensed === true;
        const hasBackup = spUser.lastBackupStatusTotal === 'success';
        
        const storageInfo = spUser.storageInformation || {};
        const mailStorageBytes = storageInfo.protectedMailBytes || spUser.mailStorageBytes || spUser.exchangeStorageBytes || 0;
        const driveStorageBytes = storageInfo.protectedBytes || spUser.driveStorageBytes || spUser.oneDriveStorageBytes || 0;
        const totalStorageBytes = mailStorageBytes + driveStorageBytes;
        
        const formatStorage = (bytes) => {
          if (!bytes || bytes === 0) return null;
          if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
          if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
          return `${(bytes / 1024).toFixed(2)} KB`;
        };
        
        const storageStr = formatStorage(totalStorageBytes);
        const backupStatus = spUser.lastBackupStatusTotal || (isProtected ? 'protected' : 'not_protected');
        
        const titleParts = [];
        if (storageStr) titleParts.push(storageStr);
        titleParts.push(backupStatus);
        if (isProtected || hasBackup) titleParts.push('PROTECTED');
        const contactTitle = titleParts.join(' | ');
        
        const existing = existingByEmail[email];
        if (existing) {
          await base44.asServiceRole.entities.Contact.update(existing.id, {
            spanning_status: contactTitle
          });
          contactsUpdated++;
        }
      }

      // Update last_synced
      await base44.asServiceRole.entities.SpanningMapping.update(mapping.id, {
        last_synced: new Date().toISOString()
      });

      return Response.json({
        success: true,
        standardLicenses,
        protectedStandard,
        archivedLicenses,
        protectedArchived,
        sharedMailboxes,
        protectedShared,
        contactsUpdated,
        tenantName: mapping.spanning_tenant_name
      });
    }

    // Sync all mapped customers (contacts only)
    if (action === 'sync_all') {
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }

      const allMappings = await base44.asServiceRole.entities.SpanningMapping.list();
      let synced = 0;
      let errors = 0;
      
      for (const mapping of allMappings) {
        try {
          // Get users for this tenant
          const usersResponse = await unitrendsApiCall(`/v2/spanning/domains/${mapping.spanning_tenant_id}/users?page_size=1000`);
          
          let users = [];
          if (Array.isArray(usersResponse)) {
            users = usersResponse[0]?.users || usersResponse;
          } else if (usersResponse?.users) {
            users = Array.isArray(usersResponse.users) && usersResponse.users[0]?.users 
              ? usersResponse.users[0].users 
              : usersResponse.users;
          }

          // Sync contacts
          const existingContacts = await base44.asServiceRole.entities.Contact.filter({ customer_id: mapping.customer_id });
          const existingByEmail = {};
          existingContacts.forEach(c => { 
            if (c.email) existingByEmail[c.email.toLowerCase()] = c; 
          });

          for (const spUser of users) {
            const email = spUser.email?.toLowerCase() || spUser.userPrincipalName?.toLowerCase();
            if (!email) continue;

            const isProtected = spUser.isAssigned === true || spUser.assigned === true || spUser.isLicensed === true;
            const hasBackup = spUser.lastBackupStatusTotal === 'success';
            
            const storageInfo = spUser.storageInformation || {};
            const mailStorageBytes = storageInfo.protectedMailBytes || spUser.mailStorageBytes || 0;
            const driveStorageBytes = storageInfo.protectedBytes || spUser.driveStorageBytes || 0;
            const totalStorageBytes = mailStorageBytes + driveStorageBytes;
            
            const formatStorage = (bytes) => {
              if (!bytes || bytes === 0) return null;
              if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
              if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
              return `${(bytes / 1024).toFixed(2)} KB`;
            };
            
            const storageStr = formatStorage(totalStorageBytes);
            const backupStatus = spUser.lastBackupStatusTotal || (isProtected ? 'protected' : 'not_protected');
            
            const titleParts = [];
            if (storageStr) titleParts.push(storageStr);
            titleParts.push(backupStatus);
            if (isProtected || hasBackup) titleParts.push('PROTECTED');
            const contactTitle = titleParts.join(' | ');
            
            const existing = existingByEmail[email];
            if (existing) {
              await base44.asServiceRole.entities.Contact.update(existing.id, {
                spanning_status: contactTitle
              });
            }
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