import { getServiceSupabase } from '../lib/supabase.js';

const JUMPCLOUD_API_KEY = process.env.JUMPCLOUD_API_KEY;
const JUMPCLOUD_PROVIDER_ID = process.env.JUMPCLOUD_PROVIDER_ID;
const JUMPCLOUD_API_URL = 'https://console.jumpcloud.com/api';

async function jumpcloudApiCall(endpoint, orgId = null) {
  const headers = {
    'x-api-key': JUMPCLOUD_API_KEY,
    'Content-Type': 'application/json'
  };

  // For MTP, always include provider ID
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

  // For MTP, always include provider ID
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

function categorizeApp(appName) {
  const name = appName.toLowerCase();
  if (name.includes('slack') || name.includes('teams') || name.includes('zoom')) return 'collaboration';
  if (name.includes('office') || name.includes('google') || name.includes('dropbox')) return 'productivity';
  if (name.includes('salesforce') || name.includes('hubspot')) return 'crm';
  if (name.includes('github') || name.includes('jira') || name.includes('bitbucket')) return 'development';
  if (name.includes('okta') || name.includes('auth') || name.includes('duo')) return 'security';
  return 'other';
}

async function fetchAllOrganizations() {
  let allOrgs = [];
  let skip = 0;
  const pageLimit = 100;
  while (true) {
    const page = await jumpcloudApiCall(`/organizations?limit=${pageLimit}&skip=${skip}`);
    const results = page.results || page;
    const orgs = Array.isArray(results) ? results : [];
    allOrgs = allOrgs.concat(orgs);
    skip += orgs.length;
    if (orgs.length < pageLimit) break;
  }
  return allOrgs;
}

export async function syncJumpCloudLicenses(body, user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;

  if (!JUMPCLOUD_API_KEY) {
    const err = new Error('JumpCloud API key not configured');
    err.statusCode = 400;
    throw err;
  }

  if (!JUMPCLOUD_PROVIDER_ID) {
    const err = new Error('JumpCloud Provider ID not configured (required for MTP)');
    err.statusCode = 400;
    throw err;
  }

  // Get cached data without calling external API
  if (action === 'get_cached') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: mappings } = await supabase
      .from('jump_cloud_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      const err = new Error('No JumpCloud organization mapped to this customer');
      err.statusCode = 400;
      throw err;
    }

    const mapping = mappings[0];

    // Return cached data if available
    if (mapping.cached_data) {
      try {
        return {
          success: true,
          cached: true,
          last_synced: mapping.last_synced,
          ...mapping.cached_data
        };
      } catch (e) {
        // Cache invalid
      }
    }

    return {
      success: true,
      cached: true,
      last_synced: mapping.last_synced,
      totalUsers: 0,
      ssoApps: 0,
      message: 'No cached data available. Click Sync to fetch data.'
    };
  }

  // Action: Test connection
  if (action === 'test_connection') {
    try {
      // Try to get organizations (for MSP accounts) or current org info
      const orgs = await fetchAllOrganizations();
      return {
        success: true,
        isMsp: true,
        organizations: orgs
      };
    } catch {
      // If organizations endpoint fails, try single-org approach
      try {
        const org = await jumpcloudApiCall('/organizations/me');
        return {
          success: true,
          isMsp: false,
          organization: org
        };
      } catch (e) {
        const err = new Error(e.message);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  // Action: List organizations (for MSP accounts)
  if (action === 'list_organizations') {
    try {
      const orgs = await fetchAllOrganizations();
      return {
        success: true,
        organizations: orgs.map(org => ({
          id: org.id || org._id,
          name: org.displayName || org.name,
          userCount: org.totalUserCount || 0
        }))
      };
    } catch {
      // Single org - get current org
      const systemUsers = await jumpcloudApiCall('/systemusers?limit=1');
      return {
        success: true,
        organizations: [{
          id: 'default',
          name: 'My Organization',
          userCount: systemUsers.totalCount || systemUsers.results?.length || 0
        }]
      };
    }
  }

  // Action: Get applications for an organization
  if (action === 'get_applications') {
    const { org_id } = body;

    // Get SSO applications
    const applications = await jumpcloudV2ApiCall('/applications', org_id !== 'default' ? org_id : null);

    // Get user count for each application
    const appsWithUsers = await Promise.all(
      (applications || []).map(async (app) => {
        try {
          const users = await jumpcloudV2ApiCall(`/applications/${app.id}/users`, org_id !== 'default' ? org_id : null);
          return {
            id: app.id,
            name: app.displayName || app.name,
            type: app.sso?.type || 'SSO',
            logo: app.logo?.url,
            userCount: users?.length || 0
          };
        } catch {
          return {
            id: app.id,
            name: app.displayName || app.name,
            type: app.sso?.type || 'SSO',
            logo: app.logo?.url,
            userCount: 0
          };
        }
      })
    );

    return {
      success: true,
      applications: appsWithUsers
    };
  }

  // Action: Debug - get raw applications data
  if (action === 'debug_applications') {
    const { org_id } = body;
    try {
      const applications = await jumpcloudV2ApiCall('/applications', org_id !== 'default' ? org_id : null);
      return { success: true, raw: applications };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Action: Sync JumpCloud users with customer contacts
  if (action === 'sync_users') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    // Get the JumpCloud mapping for this customer
    const { data: mappings } = await supabase
      .from('jump_cloud_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      const err = new Error('No JumpCloud organization mapped to this customer');
      err.statusCode = 400;
      throw err;
    }

    const mapping = mappings[0];
    const orgId = mapping.jumpcloud_org_id !== 'default' ? mapping.jumpcloud_org_id : null;

    // Get JumpCloud users (paginated — API defaults to 10 per page)
    let jcUsers = [];
    let skip = 0;
    const pageLimit = 100;
    while (true) {
      const page = await jumpcloudApiCall(`/systemusers?limit=${pageLimit}&skip=${skip}`, orgId);
      const results = page.results || [];
      jcUsers = jcUsers.concat(results);
      skip += results.length;
      if (results.length < pageLimit || skip >= (page.totalCount || 0)) break;
    }

    // Get existing contacts for this customer
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('customer_id', customer_id);

    const existingByEmail = {};
    (existingContacts || []).forEach(c => {
      if (c.email) existingByEmail[c.email.toLowerCase()] = c;
    });

    let created = 0;
    let matched = 0;
    let updated = 0;

    for (const jcUser of jcUsers) {
      const email = jcUser.email?.toLowerCase();
      if (!email) continue;

      const fullName = [jcUser.firstname, jcUser.lastname].filter(Boolean).join(' ') || jcUser.username || email;

      const existing = existingByEmail[email];
      if (existing) {
        // Update if name changed
        if (existing.full_name !== fullName) {
          await supabase
            .from('contacts')
            .update({
              full_name: fullName,
              title: jcUser.jobTitle || existing.title
            })
            .eq('id', existing.id);
          updated++;
        }
        matched++;
      } else {
        // Create new contact
        await supabase
          .from('contacts')
          .insert({
            customer_id,
            full_name: fullName,
            email: jcUser.email,
            title: jcUser.jobTitle || '',
            source: 'jumpcloud'
          });
        created++;
      }
    }

    // Update last_synced timestamp
    await supabase
      .from('jump_cloud_mappings')
      .update({ last_synced: new Date().toISOString() })
      .eq('id', mapping.id);

    return {
      success: true,
      totalJumpCloudUsers: jcUsers.length,
      created,
      matched,
      updated
    };
  }

  // Action: Sync licenses for a specific customer
  if (action === 'sync_licenses') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    // Get the JumpCloud mapping for this customer
    const { data: mappings } = await supabase
      .from('jump_cloud_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      const err = new Error('No JumpCloud organization mapped to this customer');
      err.statusCode = 400;
      throw err;
    }

    const mapping = mappings[0];
    const orgId = mapping.jumpcloud_org_id !== 'default' ? mapping.jumpcloud_org_id : null;

    // Get users for this organization (paginated)
    let jcUsers = [];
    try {
      let skip = 0;
      const pageLimit = 100;
      while (true) {
        const page = await jumpcloudApiCall(`/systemusers?limit=${pageLimit}&skip=${skip}`, orgId);
        const results = page.results || [];
        jcUsers = jcUsers.concat(results);
        skip += results.length;
        if (results.length < pageLimit || skip >= (page.totalCount || 0)) break;
      }
    } catch {
      // Fallback
    }
    const totalUsers = jcUsers.length;

    // Sync users to contacts
    let usersCreated = 0;
    let usersUpdated = 0;

    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('customer_id', customer_id);

    const existingByEmail = {};
    (existingContacts || []).forEach(c => {
      if (c.email) existingByEmail[c.email.toLowerCase()] = c;
    });

    for (const jcUser of jcUsers) {
      const email = jcUser.email?.toLowerCase();
      if (!email) continue;

      const fullName = [jcUser.firstname, jcUser.lastname].filter(Boolean).join(' ') || jcUser.username || email;
      const jcStatus = jcUser.state || (jcUser.activated ? 'ACTIVATED' : 'STAGED');

      const existing = existingByEmail[email];
      if (existing) {
        // Update with JumpCloud info, preserve source if already something else
        const updateData = {
          full_name: fullName,
          jumpcloud_id: jcUser._id || jcUser.id,
          jumpcloud_status: jcStatus
        };
        if (jcUser.jobTitle) updateData.title = jcUser.jobTitle;
        // Only set source to jumpcloud if it was manual before
        if (!existing.source || existing.source === 'manual') {
          updateData.source = 'jumpcloud';
        }
        await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', existing.id);
        usersUpdated++;
      } else {
        // Create new contact
        await supabase
          .from('contacts')
          .insert({
            customer_id,
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

    // Get existing JumpCloud licenses for this customer
    const { data: existingLicenses } = await supabase
      .from('saas_licenses')
      .select('*')
      .eq('customer_id', customer_id)
      .eq('source', 'jumpcloud');

    const existingByExternalId = {};
    (existingLicenses || []).forEach(l => { existingByExternalId[l.external_id] = l; });

    let created = 0;
    let updated = 0;

    // Always create/update the main JumpCloud license
    const jumpcloudLicenseId = `jumpcloud-org-${mapping.jumpcloud_org_id}`;
    const jumpcloudLicenseData = {
      customer_id,
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
      if (existingJumpcloud.quantity !== totalUsers) {
        await supabase
          .from('saas_licenses')
          .update(jumpcloudLicenseData)
          .eq('id', existingJumpcloud.id);
        updated++;
      }
    } else {
      await supabase
        .from('saas_licenses')
        .insert(jumpcloudLicenseData);
      created++;
    }

    // Get SSO applications
    const applications = await jumpcloudV2ApiCall('/applications', orgId);

    for (const app of (applications || [])) {
      // Get users assigned to this application
      let userCount = 0;
      try {
        const users = await jumpcloudV2ApiCall(`/applications/${app.id}/users`, orgId);
        userCount = users?.length || 0;
      } catch {
        // Ignore errors getting user count
      }

      const licenseData = {
        customer_id,
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
        if (existing.quantity !== userCount || existing.application_name !== licenseData.application_name) {
          await supabase
            .from('saas_licenses')
            .update(licenseData)
            .eq('id', existing.id);
          updated++;
        }
      } else {
        await supabase
          .from('saas_licenses')
          .insert(licenseData);
        created++;
      }
    }

    const responseData = {
      success: true,
      licensesCreated: created,
      licensesUpdated: updated,
      usersCreated,
      usersUpdated,
      totalUsers,
      ssoApps: applications?.length || 0
    };

    // Cache the data for future quick loads
    await supabase
      .from('jump_cloud_mappings')
      .update({
        last_synced: new Date().toISOString(),
        cached_data: {
          totalUsers,
          ssoApps: applications?.length || 0,
          usersCreated,
          usersUpdated,
          licensesCreated: created,
          licensesUpdated: updated
        }
      })
      .eq('id', mapping.id);

    return responseData;
  }

  // Action: Sync all mapped customers
  if (action === 'sync_all') {
    const { data: allMappings } = await supabase
      .from('jump_cloud_mappings')
      .select('*');

    if (!allMappings || allMappings.length === 0) {
      return { success: true, message: 'No mappings found' };
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    const errors = [];

    for (const mapping of allMappings) {
      try {
        const orgId = mapping.jumpcloud_org_id !== 'default' ? mapping.jumpcloud_org_id : null;
        const applications = await jumpcloudV2ApiCall('/applications', orgId);

        const { data: existingLicenses } = await supabase
          .from('saas_licenses')
          .select('*')
          .eq('customer_id', mapping.customer_id)
          .eq('source', 'jumpcloud');

        const existingByExternalId = {};
        (existingLicenses || []).forEach(l => { existingByExternalId[l.external_id] = l; });

        for (const app of (applications || [])) {
          let userCount = 0;
          try {
            const users = await jumpcloudV2ApiCall(`/applications/${app.id}/users`, orgId);
            userCount = users?.length || 0;
          } catch {
            // Ignore
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
            if (existing.quantity !== userCount || existing.application_name !== licenseData.application_name) {
              await supabase
                .from('saas_licenses')
                .update(licenseData)
                .eq('id', existing.id);
              totalUpdated++;
            }
          } else {
            await supabase
              .from('saas_licenses')
              .insert(licenseData);
            totalCreated++;
          }
        }
      } catch (err) {
        errors.push({ org: mapping.jumpcloud_org_name, error: err.message });
      }
    }

    return {
      success: true,
      created: totalCreated,
      updated: totalUpdated,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  const err = new Error('Invalid action');
  err.statusCode = 400;
  throw err;
}
