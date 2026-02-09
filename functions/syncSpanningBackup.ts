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

      // Extract storage information
      const domainStorage = domainInfo?.storageInformation || {};
      
      // Extract last backup status info
      const lastBackup = domainInfo?.lastBackup || {};
      const backupStatus7Days = domainInfo?.backupStatusLastSevenDays || {};
      
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
        // SharePoint backup info
        numberOfProtectedSharePointSites: domainInfo?.numberOfProtectedSharePointSites || 0,
        numberOfUnprotectedSharePointSites: domainInfo?.numberOfUnprotectedSharePointSites || 0,
        // Teams backup info
        numberOfProtectedTeamChannels: domainInfo?.numberOfProtectedTeamChannels || 0,
        numberOfUnprotectedTeamChannels: domainInfo?.numberOfUnprotectedTeamChannels || 0,
        // Storage info
        totalProtectedBytes: domainStorage.protectedBytes || 0,
        totalUsedBytes: domainStorage.usedBytes || 0,
        totalProtectedStorage: formatStorage(domainStorage.protectedBytes || 0),
        totalUsedStorage: formatStorage(domainStorage.usedBytes || 0),
        // Backup status
        lastBackupStatus: lastBackup.status || 'unknown',
        lastBackupTimestamp: lastBackup.timestamp || null,
        sharePointBackupStatus: lastBackup.sharePoint?.status || 'unknown',
        sharePointLastBackup: lastBackup.sharePoint?.timestamp || null,
        teamsBackupStatus: lastBackup.teams?.status || 'unknown',
        teamsLastBackup: lastBackup.teams?.timestamp || null,
        // 7-day backup status breakdown
        backupStatus7Days: {
          mail: backupStatus7Days.totalForMail || 'unknown',
          calendar: backupStatus7Days.totalForCalendar || 'unknown',
          contacts: backupStatus7Days.totalForContact || 'unknown',
          drive: backupStatus7Days.totalForDrive || 'unknown',
          sharePoint: backupStatus7Days.totalForSharePoint || 'unknown',
          teams: backupStatus7Days.totalForTeams || 'unknown'
        },
        overallBackupStatus7Days: domainInfo?.backupStatusLastSevenDaysTotal || 'unknown',
        domainName: domainInfo?.name || 'unknown',
        domainId: domainInfo?.id || 'unknown',
        expirationDate: domainInfo?.expirationDate || null,
        origin: domainInfo?.origin || 'unknown'
      });
    }

    // List SharePoint sites for a tenant (uses per-tenant API key)
    if (action === 'list_sharepoint_sites') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      const mappings = await base44.asServiceRole.entities.SpanningMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ error: 'No Spanning mapping found for this customer' }, { status: 400 });
      }

      const mapping = mappings[0];
      
      // Check if tenant has API key configured
      if (!mapping.spanning_api_key) {
        return Response.json({ 
          success: true, 
          total: 0, 
          sites: [],
          message: 'No tenant API key configured. Add the Spanning API key in Settings to view SharePoint sites.'
        });
      }

      const region = mapping.spanning_region || 'us';
      const tenantApiBase = `https://o365-api-${region}.spanningbackup.com`;
      
      try {
        const formatStorage = (bytes) => {
          if (!bytes || bytes === 0) return '0 B';
          if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
          if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
          return `${(bytes / 1024).toFixed(2)} KB`;
        };
        
        // Use Unitrends API to get tenant data (already working)
        const allDomains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
        const domainInfo = allDomains.find(d => d.id === mapping.spanning_tenant_id);
        
        if (!domainInfo) {
          return Response.json({ success: false, error: 'Could not find domain info in Unitrends API' });
        }

        return Response.json({
          success: true,
          total: 0, // Spanning API doesn't expose individual sites via the external API
          sites: [],
          // Include summary counts from domain info
          sharePointSummary: {
            protectedSites: domainInfo.numberOfProtectedSharePointSites || 0,
            unprotectedSites: domainInfo.numberOfUnprotectedSharePointSites || 0,
            totalSites: (domainInfo.numberOfProtectedSharePointSites || 0) + (domainInfo.numberOfUnprotectedSharePointSites || 0)
          },
          tenantName: domainInfo.name || mapping.spanning_tenant_name,
          message: 'SharePoint site details are available in the Spanning portal. Summary counts shown here.'
        });
      } catch (e) {
        return Response.json({ success: false, error: e.message });
      }
    }

    // List Teams channels for a tenant (uses per-tenant API key)
    if (action === 'list_teams_channels') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      const mappings = await base44.asServiceRole.entities.SpanningMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ error: 'No Spanning mapping found for this customer' }, { status: 400 });
      }

      const mapping = mappings[0];
      
      // Check if tenant has API key configured
      if (!mapping.spanning_api_key) {
        return Response.json({ 
          success: true, 
          total: 0, 
          teams: [],
          message: 'No tenant API key configured. Add the Spanning API key in Settings to view Teams channels.'
        });
      }

      const region = mapping.spanning_region || 'us';
      const tenantApiBase = `https://o365-api-${region}.spanningbackup.com`;
      
      try {
        const formatStorage = (bytes) => {
          if (!bytes || bytes === 0) return '0 B';
          if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
          if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
          return `${(bytes / 1024).toFixed(2)} KB`;
        };
        
        // Spanning API uses Basic auth with empty username and API key as password
        const basicAuth = btoa(`:${mapping.spanning_api_key}`);
        
        // Get tenant info which includes Teams summary
        const tenantResponse = await fetch(`${tenantApiBase}/external/tenant`, {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Accept': 'application/json'
          }
        });
        
        if (!tenantResponse.ok) {
          const errorText = await tenantResponse.text();
          return Response.json({ success: false, error: `Tenant API error: ${tenantResponse.status} - ${errorText}` });
        }
        
        const tenantData = await tenantResponse.json();
        
        // Get users to find Teams-related info
        const usersResponse = await fetch(`${tenantApiBase}/external/users?size=1000`, {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Accept': 'application/json'
          }
        });
        
        let users = [];
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          users = usersData.users || usersData || [];
        }
        
        // Extract Teams from users (if available in user data)
        const teamsMap = new Map();
        for (const user of users) {
          if (user.teams && Array.isArray(user.teams)) {
            for (const team of user.teams) {
              if (!teamsMap.has(team.id || team.teamId || team.name)) {
                teamsMap.set(team.id || team.teamId || team.name, team);
              }
            }
          }
        }

        const teams = Array.from(teamsMap.values()).map(t => ({
          id: t.id || t.teamId,
          name: t.name || t.displayName || 'Unnamed Team',
          description: t.description || null,
          isProtected: t.isAssigned === true || t.assigned === true,
          storageBytes: t.size || t.storageBytes || 0,
          storage: formatStorage(t.size || t.storageBytes || 0),
          lastBackupStatus: t.lastBackupStatus || 'unknown',
          lastBackupDate: t.lastBackupDate || null,
          channelCount: t.channels?.length || t.channelCount || 0
        }));

        return Response.json({
          success: true,
          total: teams.length,
          teams,
          // Include summary counts from tenant info
          teamsSummary: {
            protectedChannels: tenantData.teamsProtectedChannels || tenantData.numberOfProtectedTeamChannels || 0,
            unprotectedChannels: tenantData.teamsUnprotectedChannels || tenantData.numberOfUnprotectedTeamChannels || 0,
            totalStorage: formatStorage(tenantData.teamsStorageBytes || 0)
          },
          tenantName: tenantData.name || tenantData.displayName,
          rawTenantData: tenantData // For debugging
        });
      } catch (e) {
        return Response.json({ success: false, error: e.message });
      }
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