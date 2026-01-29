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
    
    // Get all Spanning mappings
    const allMappings = await base44.asServiceRole.entities.SpanningMapping.list();
    
    if (allMappings.length === 0) {
      return Response.json({ success: true, message: 'No Spanning mappings found', synced: 0 });
    }

    let synced = 0;
    let errors = 0;
    const results = [];

    for (const mapping of allMappings) {
      try {
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

        const totalUsers = users.length;
        const assignedUsers = users.filter(u => u.lastBackupStatusTotal === 'success').length || totalUsers;

        // Get customer
        const customers = await base44.asServiceRole.entities.Customer.filter({ id: mapping.customer_id });
        const customer = customers[0];

        // Update contacts with spanning status
        const existingContacts = await base44.asServiceRole.entities.Contact.filter({ customer_id: mapping.customer_id });
        const existingByEmail = {};
        existingContacts.forEach(c => { 
          if (c.email) existingByEmail[c.email.toLowerCase()] = c; 
        });

        let contactsUpdated = 0;
        for (const spUser of users) {
          const email = spUser.email?.toLowerCase() || spUser.userPrincipalName?.toLowerCase();
          if (!email) continue;

          const isProtected = spUser.isAssigned === true || spUser.assigned === true || spUser.isLicensed === true || spUser.lastBackupStatusTotal === 'success';
          
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
          if (isProtected) titleParts.push('PROTECTED');
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

        results.push({
          customer: customer?.name,
          totalUsers,
          assignedUsers,
          contactsUpdated
        });
        synced++;
      } catch (e) {
        console.error(`Failed to sync mapping ${mapping.id}:`, e.message);
        errors++;
        results.push({
          customer_id: mapping.customer_id,
          error: e.message
        });
      }
    }

    return Response.json({ 
      success: true, 
      synced, 
      errors,
      totalMappings: allMappings.length,
      results 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});