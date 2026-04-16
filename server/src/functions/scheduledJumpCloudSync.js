import { getServiceSupabase } from '../lib/supabase.js';

const JUMPCLOUD_API_KEY = process.env.JUMPCLOUD_API_KEY;
const JUMPCLOUD_PROVIDER_ID = process.env.JUMPCLOUD_PROVIDER_ID;
const JUMPCLOUD_API_URL = 'https://console.jumpcloud.com/api';

async function jumpcloudApiCall(endpoint, orgId = null) {
  const headers = {
    'x-api-key': JUMPCLOUD_API_KEY,
    'Content-Type': 'application/json'
  };

  if (JUMPCLOUD_PROVIDER_ID) {
    headers['x-provider-id'] = JUMPCLOUD_PROVIDER_ID;
  }

  if (orgId && orgId !== 'default') {
    headers['x-org-id'] = orgId;
  }

  const response = await fetch(`${JUMPCLOUD_API_URL}${endpoint}`, { headers });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`JumpCloud API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function jumpcloudV2ApiCall(endpoint, orgId = null) {
  const headers = {
    'x-api-key': JUMPCLOUD_API_KEY,
    'Content-Type': 'application/json'
  };

  if (JUMPCLOUD_PROVIDER_ID) {
    headers['x-provider-id'] = JUMPCLOUD_PROVIDER_ID;
  }

  if (orgId && orgId !== 'default') {
    headers['x-org-id'] = orgId;
  }

  const response = await fetch(`https://console.jumpcloud.com/api/v2${endpoint}`, { headers });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`JumpCloud API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function fetchAllApplications(orgId) {
  let allApps = [];
  let skip = 0;
  const limit = 100;
  while (true) {
    const batch = await jumpcloudV2ApiCall(`/applications?limit=${limit}&skip=${skip}`, orgId);
    if (!Array.isArray(batch) || batch.length === 0) break;
    allApps = allApps.concat(batch);
    if (batch.length < limit) break;
    skip += limit;
    if (skip > 5000) break;
  }
  return allApps;
}

async function fetchApplicationUsers(appId, orgId) {
  let allUsers = [];
  let skip = 0;
  const limit = 100;
  while (true) {
    const batch = await jumpcloudV2ApiCall(`/applications/${appId}/users?limit=${limit}&skip=${skip}`, orgId);
    if (!Array.isArray(batch) || batch.length === 0) break;
    allUsers = allUsers.concat(batch);
    if (batch.length < limit) break;
    skip += limit;
    if (skip > 5000) break;
  }
  return allUsers;
}

function categorizeApp(appName) {
  const name = appName.toLowerCase();
  if (name.includes('slack') || name.includes('teams') || name.includes('zoom')) return 'collaboration';
  if (name.includes('office') || name.includes('google') || name.includes('dropbox')) return 'productivity';
  if (name.includes('salesforce') || name.includes('hubspot')) return 'crm';
  if (name.includes('github') || name.includes('jira') || name.includes('bitbucket')) return 'development';
  if (name.includes('okta') || name.includes('auth') || name.includes('duo')) return 'security';
  return 'other';
}

export async function scheduledJumpCloudSync(body, user) {
  const supabase = getServiceSupabase();

  if (!JUMPCLOUD_API_KEY || !JUMPCLOUD_PROVIDER_ID) {
    return { success: false, error: 'JumpCloud credentials not configured' };
  }

  // Get all JumpCloud mappings
  const { data: allMappings } = await supabase
    .from('jump_cloud_mappings')
    .select('*');

  if (!allMappings || allMappings.length === 0) {
    return { success: true, message: 'No JumpCloud mappings found', synced: 0 };
  }

  let synced = 0;
  let errors = 0;
  const results = [];

  for (const mapping of allMappings) {
    try {
      const orgId = mapping.jumpcloud_org_id !== 'default' ? mapping.jumpcloud_org_id : null;

      // Get users for this organization (paginated — JumpCloud defaults to 10 per page)
      let jcUsers = [];
      let skip = 0;
      const pageLimit = 100;
      while (true) {
        const page = await jumpcloudApiCall(`/systemusers?limit=${pageLimit}&skip=${skip}`, orgId);
        const results = page.results || [];
        jcUsers = jcUsers.concat(results);
        const totalCount = page.totalCount || 0;
        skip += results.length;
        if (results.length < pageLimit || skip >= totalCount) break;
      }
      const totalUsers = jcUsers.length;

      // Get existing contacts
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('customer_id', mapping.customer_id);

      const existingByEmail = {};
      (existingContacts || []).forEach(c => {
        if (c.email) existingByEmail[c.email.toLowerCase()] = c;
      });

      let usersCreated = 0;
      let usersUpdated = 0;

      // Sync users to contacts
      for (const jcUser of jcUsers) {
        const email = jcUser.email?.toLowerCase();
        if (!email) continue;

        const fullName = [jcUser.firstname, jcUser.lastname].filter(Boolean).join(' ') || jcUser.username || email;
        const jcStatus = jcUser.state || (jcUser.activated ? 'ACTIVATED' : 'STAGED');

        const existing = existingByEmail[email];
        if (existing) {
          const updateData = {
            full_name: fullName,
            jumpcloud_id: jcUser._id || jcUser.id,
            jumpcloud_status: jcStatus
          };
          if (jcUser.jobTitle) updateData.title = jcUser.jobTitle;
          if (!existing.source || existing.source === 'manual') {
            updateData.source = 'jumpcloud';
          }
          await supabase
            .from('contacts')
            .update(updateData)
            .eq('id', existing.id);
          usersUpdated++;
        } else {
          await supabase
            .from('contacts')
            .insert({
              customer_id: mapping.customer_id,
              full_name: fullName,
              email: jcUser.email,
              title: jcUser.jobTitle || '',
              source: 'jumpcloud',
              jumpcloud_id: jcUser._id || jcUser.id,
              jumpcloud_status: jcStatus
            });
          usersCreated++;
        }
      }

      // Get existing licenses
      const { data: existingLicenses } = await supabase
        .from('saas_licenses')
        .select('*')
        .eq('customer_id', mapping.customer_id)
        .eq('source', 'jumpcloud');

      const existingByExternalId = {};
      (existingLicenses || []).forEach(l => { existingByExternalId[l.external_id] = l; });

      let licensesCreated = 0;
      let licensesUpdated = 0;

      // Update main JumpCloud license
      const jumpcloudLicenseId = `jumpcloud-org-${mapping.jumpcloud_org_id}`;
      const jumpcloudLicenseData = {
        customer_id: mapping.customer_id,
        application_name: 'JumpCloud',
        vendor: 'JumpCloud',
        license_type: 'Directory Platform',
        quantity: totalUsers,
        assigned_users: totalUsers,
        cost_per_license: 0,
        total_cost: 0,
        billing_cycle: 'monthly',
        status: 'active',
        external_id: jumpcloudLicenseId,
        source: 'jumpcloud',
        website_url: 'https://jumpcloud.com',
        logo_url: 'https://cdn.brandfetch.io/idoUb6RCfq/w/400/h/400/theme/dark/icon.png',
        category: 'security',
        notes: `JumpCloud Directory - ${totalUsers} users synced from ${mapping.jumpcloud_org_name}`
      };

      const existingJumpcloud = existingByExternalId[jumpcloudLicenseId];
      if (existingJumpcloud) {
        await supabase
          .from('saas_licenses')
          .update(jumpcloudLicenseData)
          .eq('id', existingJumpcloud.id);
        licensesUpdated++;
      } else {
        await supabase
          .from('saas_licenses')
          .insert(jumpcloudLicenseData);
        licensesCreated++;
      }

      // Get and sync SSO applications (paginated)
      const applications = await fetchAllApplications(orgId);

      for (const app of (applications || [])) {
        let userCount = 0;
        try {
          const users = await fetchApplicationUsers(app.id, orgId);
          userCount = users.length;
        } catch (err) {
          console.error(`Failed to fetch users for app ${app.id} during scheduled sync:`, err.message);
        }

        const licenseData = {
          customer_id: mapping.customer_id,
          application_name: app.displayName || app.name,
          vendor: 'JumpCloud SSO',
          license_type: app.sso?.type || 'SSO Application',
          quantity: userCount,
          assigned_users: userCount,
          cost_per_license: 0,
          total_cost: 0,
          billing_cycle: 'monthly',
          status: 'active',
          external_id: app.id,
          source: 'jumpcloud',
          logo_url: app.logo?.url || null,
          category: categorizeApp(app.displayName || app.name),
          notes: `Synced from JumpCloud - ${app.sso?.type || 'SSO'} Application`
        };

        const existing = existingByExternalId[app.id];
        if (existing) {
          await supabase
            .from('saas_licenses')
            .update(licenseData)
            .eq('id', existing.id);
          licensesUpdated++;
        } else {
          await supabase
            .from('saas_licenses')
            .insert(licenseData);
          licensesCreated++;
        }
      }

      // Update last_synced
      await supabase
        .from('jump_cloud_mappings')
        .update({ last_synced: new Date().toISOString() })
        .eq('id', mapping.id);

      results.push({
        customer_id: mapping.customer_id,
        org_name: mapping.jumpcloud_org_name,
        totalUsers,
        usersCreated,
        usersUpdated,
        licensesCreated,
        licensesUpdated,
        ssoApps: applications?.length || 0
      });
      synced++;
    } catch (e) {
      console.error(`Failed to sync mapping ${mapping.id}:`, e.message);
      errors++;
      results.push({
        customer_id: mapping.customer_id,
        org_name: mapping.jumpcloud_org_name,
        error: e.message
      });
    }
  }

  return {
    success: true,
    synced,
    errors,
    totalMappings: allMappings.length,
    results
  };
}
