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
          userType: u.userType || 'standard',
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
      
      // Get all domains and find this one by ID for accurate license counts
      const allDomains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
      const domainInfo = allDomains.find(d => d.id === mapping.spanning_tenant_id);
      
      // Extract counts for each license type
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

      // Get customer name
      const customers = await base44.asServiceRole.entities.Customer.filter({ id: customer_id });
      const customer = customers[0];

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

      // Delete existing spanning licenses for this customer (we'll recreate them)
      const existingLicenses = await base44.asServiceRole.entities.SaaSLicense.filter({ 
        customer_id, 
        source: 'spanning' 
      });
      
      // Keep track of license IDs we're keeping vs removing
      const licenseTypes = ['standard', 'archived', 'shared'];
      const existingByType = {};
      for (const lic of existingLicenses) {
        if (lic.license_type === 'Standard Users') existingByType.standard = lic;
        else if (lic.license_type === 'Archived Users') existingByType.archived = lic;
        else if (lic.license_type === 'Shared Mailboxes') existingByType.shared = lic;
        else if (lic.license_type === 'Microsoft 365 Backup') {
          // Old format - delete it
          await base44.asServiceRole.entities.SaaSLicense.delete(lic.id);
        }
      }

      // Create/update three separate licenses
      const licensesConfig = [
        { 
          type: 'standard', 
          name: 'Spanning - Standard Users',
          licenseType: 'Standard Users',
          quantity: standardLicenses, 
          assigned: protectedStandard,
          notes: `Standard M365 user backups`
        },
        { 
          type: 'archived', 
          name: 'Spanning - Archived Users',
          licenseType: 'Archived Users',
          quantity: archivedLicenses, 
          assigned: protectedArchived,
          notes: `Departed user data retention`
        },
        { 
          type: 'shared', 
          name: 'Spanning - Shared Mailboxes',
          licenseType: 'Shared Mailboxes',
          quantity: sharedMailboxes, 
          assigned: protectedShared,
          notes: `Shared/resource mailbox backups`
        }
      ];

      const createdLicenses = {};
      
      for (const config of licensesConfig) {
        // Skip if no licenses of this type
        if (config.quantity === 0 && config.assigned === 0) continue;
        
        const licenseData = {
          customer_id,
          customer_name: customer?.name,
          application_name: config.name,
          vendor: 'Unitrends',
          license_type: config.licenseType,
          management_type: 'managed',
          quantity: config.quantity,
          assigned_users: config.assigned,
          status: 'active',
          external_id: `spanning-${config.type}-${customer_id}`,
          source: 'spanning',
          website_url: 'https://spanning.com',
          logo_url: 'https://cdn.brandfetch.io/idBZmlTqXS/w/400/h/400/theme/dark/icon.png',
          category: 'backup',
          notes: config.notes
        };

        if (existingByType[config.type]) {
          await base44.asServiceRole.entities.SaaSLicense.update(existingByType[config.type].id, licenseData);
          createdLicenses[config.type] = existingByType[config.type];
        } else {
          createdLicenses[config.type] = await base44.asServiceRole.entities.SaaSLicense.create(licenseData);
        }
      }

      // Create LicenseAssignments for protected users - match to existing contacts
      // Get existing assignments for spanning licenses
      const existingAssignments = [];
      for (const lic of Object.values(createdLicenses)) {
        if (lic?.id) {
          const licAssignments = await base44.asServiceRole.entities.LicenseAssignment.filter({ license_id: lic.id });
          existingAssignments.push(...licAssignments);
        }
      }
      
      const assignmentsByEmail = {};
      existingAssignments.forEach(a => {
        const contact = existingContacts.find(c => c.id === a.contact_id);
        if (contact?.email) assignmentsByEmail[contact.email.toLowerCase()] = a;
      });

      let assignmentsCreated = 0;
      
      // Standard license gets standard users with backup data
      if (createdLicenses.standard?.id) {
        for (const spUser of users) {
          const email = spUser.email?.toLowerCase() || spUser.userPrincipalName?.toLowerCase();
          if (!email) continue;
          
          // Check if user has backup data (protected)
          const storageInfo = spUser.storageInformation || {};
          const mailStorageBytes = storageInfo.protectedMailBytes || spUser.mailStorageBytes || 0;
          const driveStorageBytes = storageInfo.protectedBytes || spUser.driveStorageBytes || 0;
          const totalStorageBytes = mailStorageBytes + driveStorageBytes;
          const isProtected = totalStorageBytes > 0 || spUser.isAssigned === true || spUser.lastBackupStatusTotal === 'success';
          
          // Skip archived users (they go in archived license) and shared mailboxes
          const userType = spUser.userType?.toLowerCase() || '';
          if (userType === 'archived' || userType === 'sharedmailbox' || userType === 'shared') continue;
          
          if (isProtected && existingByEmail[email] && !assignmentsByEmail[email]) {
            const contact = existingByEmail[email];
            await base44.asServiceRole.entities.LicenseAssignment.create({
              license_id: createdLicenses.standard.id,
              contact_id: contact.id,
              customer_id,
              assigned_date: new Date().toISOString().split('T')[0],
              status: 'active'
            });
            assignmentsByEmail[email] = true;
            assignmentsCreated++;
          }
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
        assignmentsCreated,
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

      // Get all domains upfront for efficiency
      const allDomains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
      
      for (const mapping of allMappings) {
        try {
          // Find domain info by ID for accurate license counts
          const domainInfo = allDomains.find(d => d.id === mapping.spanning_tenant_id);
          
          // Use domain-level counts - these match the Spanning portal exactly
          const assignedUsers = domainInfo?.numberOfProtectedStandardUsers || domainInfo?.numberOfProtectedUsers || 0;
          const totalUsers = assignedUsers;

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
            management_type: 'managed',
            quantity: assignedUsers,
            assigned_users: assignedUsers,
            status: 'active',
            external_id: `spanning-${mapping.customer_id}`,
            source: 'spanning',
            website_url: 'https://spanning.com',
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