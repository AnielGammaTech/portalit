import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const JUMPCLOUD_API_KEY = Deno.env.get('JUMPCLOUD_API_KEY');
const JUMPCLOUD_PROVIDER_ID = Deno.env.get('JUMPCLOUD_PROVIDER_ID');
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, customer_id, scheduled } = body;

    // For scheduled runs, skip user auth check
    if (!scheduled) {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    }

    if (!JUMPCLOUD_API_KEY) {
      return Response.json({ error: 'JumpCloud API key not configured' }, { status: 400 });
    }

    if (!JUMPCLOUD_PROVIDER_ID) {
      return Response.json({ error: 'JumpCloud Provider ID not configured (required for MTP)' }, { status: 400 });
    }

    // Action: Test connection
    if (action === 'test_connection') {
      try {
        // Try to get organizations (for MSP accounts) or current org info
        const orgs = await jumpcloudApiCall('/organizations');
        return Response.json({
          success: true,
          isMsp: true,
          organizations: orgs.results || orgs
        });
      } catch {
        // If organizations endpoint fails, try single-org approach
        try {
          const org = await jumpcloudApiCall('/organizations/me');
          return Response.json({
            success: true,
            isMsp: false,
            organization: org
          });
        } catch (e) {
          return Response.json({ error: e.message }, { status: 400 });
        }
      }
    }

    // Action: List organizations (for MSP accounts)
    if (action === 'list_organizations') {
      try {
        const orgs = await jumpcloudApiCall('/organizations');
        return Response.json({
          success: true,
          organizations: (orgs.results || orgs).map(org => ({
            id: org.id || org._id,
            name: org.displayName || org.name,
            userCount: org.totalUserCount || 0
          }))
        });
      } catch {
        // Single org - get current org
        const systemUsers = await jumpcloudApiCall('/systemusers');
        return Response.json({
          success: true,
          organizations: [{
            id: 'default',
            name: 'My Organization',
            userCount: systemUsers.totalCount || systemUsers.results?.length || 0
          }]
        });
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

      return Response.json({
        success: true,
        applications: appsWithUsers
      });
    }

    // Action: Debug - get raw applications data
    if (action === 'debug_applications') {
      const { org_id } = body;
      try {
        const applications = await jumpcloudV2ApiCall('/applications', org_id !== 'default' ? org_id : null);
        return Response.json({ success: true, raw: applications });
      } catch (e) {
        return Response.json({ success: false, error: e.message });
      }
    }

    // Action: Sync JumpCloud users with customer contacts
    if (action === 'sync_users') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      // Get the JumpCloud mapping for this customer
      const mappings = await base44.asServiceRole.entities.JumpCloudMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ error: 'No JumpCloud organization mapped to this customer' }, { status: 400 });
      }

      const mapping = mappings[0];
      const orgId = mapping.jumpcloud_org_id !== 'default' ? mapping.jumpcloud_org_id : null;

      // Get JumpCloud users
      const usersResponse = await jumpcloudApiCall('/systemusers', orgId);
      const jcUsers = usersResponse.results || [];

      // Get existing contacts for this customer
      const existingContacts = await base44.asServiceRole.entities.Contact.filter({ customer_id });
      const existingByEmail = {};
      existingContacts.forEach(c => { 
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
            await base44.asServiceRole.entities.Contact.update(existing.id, {
              full_name: fullName,
              title: jcUser.jobTitle || existing.title
            });
            updated++;
          }
          matched++;
        } else {
          // Create new contact
          await base44.asServiceRole.entities.Contact.create({
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
      await base44.asServiceRole.entities.JumpCloudMapping.update(mapping.id, {
        last_synced: new Date().toISOString()
      });

      return Response.json({
        success: true,
        totalJumpCloudUsers: jcUsers.length,
        created,
        matched,
        updated
      });
    }

    // Action: Sync licenses for a specific customer
    if (action === 'sync_licenses') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      // Get the JumpCloud mapping for this customer
      const mappings = await base44.asServiceRole.entities.JumpCloudMapping.filter({ customer_id });

      if (mappings.length === 0) {
        return Response.json({ error: 'No JumpCloud organization mapped to this customer' }, { status: 400 });
      }

      const mapping = mappings[0];
      const orgId = mapping.jumpcloud_org_id !== 'default' ? mapping.jumpcloud_org_id : null;

      // Get users for this organization
      let totalUsers = 0;
      let jcUsers = [];
      try {
        const usersResponse = await jumpcloudApiCall('/systemusers', orgId);
        jcUsers = usersResponse.results || [];
        totalUsers = usersResponse.totalCount || jcUsers.length || 0;
      } catch {
        // Fallback
      }

      // Sync users to contacts
      let usersCreated = 0;
      let usersUpdated = 0;
      
      const existingContacts = await base44.asServiceRole.entities.Contact.filter({ customer_id });
      const existingByEmail = {};
      existingContacts.forEach(c => { 
        if (c.email) existingByEmail[c.email.toLowerCase()] = c; 
      });

      for (const jcUser of jcUsers) {
        const email = jcUser.email?.toLowerCase();
        if (!email) continue;

        const fullName = [jcUser.firstname, jcUser.lastname].filter(Boolean).join(' ') || jcUser.username || email;
        
        const existing = existingByEmail[email];
        if (existing) {
          // Update if source is not jumpcloud or name changed
          if (existing.source !== 'jumpcloud' || existing.full_name !== fullName) {
            await base44.asServiceRole.entities.Contact.update(existing.id, {
              full_name: fullName,
              title: jcUser.jobTitle || existing.title,
              source: 'jumpcloud'
            });
            usersUpdated++;
          }
        } else {
          // Create new contact
          await base44.asServiceRole.entities.Contact.create({
            customer_id,
            full_name: fullName,
            email: jcUser.email,
            title: jcUser.jobTitle || '',
            source: 'jumpcloud'
          });
          usersCreated++;
        }
      }

      // Get existing JumpCloud licenses for this customer
      const existingLicenses = await base44.asServiceRole.entities.SaaSLicense.filter({ 
        customer_id, 
        source: 'jumpcloud' 
      });

      const existingByExternalId = {};
      existingLicenses.forEach(l => { existingByExternalId[l.external_id] = l; });

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
          await base44.asServiceRole.entities.SaaSLicense.update(existingJumpcloud.id, jumpcloudLicenseData);
          updated++;
        }
      } else {
        await base44.asServiceRole.entities.SaaSLicense.create(jumpcloudLicenseData);
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
            await base44.asServiceRole.entities.SaaSLicense.update(existing.id, licenseData);
            updated++;
          }
        } else {
          await base44.asServiceRole.entities.SaaSLicense.create(licenseData);
          created++;
        }
      }

      // Update last_synced timestamp on the mapping
      await base44.asServiceRole.entities.JumpCloudMapping.update(mapping.id, {
        last_synced: new Date().toISOString()
      });

      return Response.json({
        success: true,
        created,
        updated,
        totalUsers,
        ssoApps: applications?.length || 0
      });
    }

    // Action: Sync all mapped customers
    if (action === 'sync_all') {
      const allMappings = await base44.asServiceRole.entities.JumpCloudMapping.list();

      if (!allMappings || allMappings.length === 0) {
        return Response.json({ success: true, message: 'No mappings found' });
      }

      let totalCreated = 0;
      let totalUpdated = 0;
      const errors = [];

      for (const mapping of allMappings) {
        try {
          const orgId = mapping.jumpcloud_org_id !== 'default' ? mapping.jumpcloud_org_id : null;
          const applications = await jumpcloudV2ApiCall('/applications', orgId);

          const existingLicenses = await base44.asServiceRole.entities.SaaSLicense.filter({ 
            customer_id: mapping.customer_id, 
            source: 'jumpcloud' 
          });

          const existingByExternalId = {};
          existingLicenses.forEach(l => { existingByExternalId[l.external_id] = l; });

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
                await base44.asServiceRole.entities.SaaSLicense.update(existing.id, licenseData);
                totalUpdated++;
              }
            } else {
              await base44.asServiceRole.entities.SaaSLicense.create(licenseData);
              totalCreated++;
            }
          }
        } catch (err) {
          errors.push({ org: mapping.jumpcloud_org_name, error: err.message });
        }
      }

      return Response.json({
        success: true,
        created: totalCreated,
        updated: totalUpdated,
        errors: errors.length > 0 ? errors : undefined
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('JumpCloud sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function categorizeApp(appName) {
  const name = appName.toLowerCase();
  if (name.includes('slack') || name.includes('teams') || name.includes('zoom')) return 'collaboration';
  if (name.includes('office') || name.includes('google') || name.includes('dropbox')) return 'productivity';
  if (name.includes('salesforce') || name.includes('hubspot')) return 'crm';
  if (name.includes('github') || name.includes('jira') || name.includes('bitbucket')) return 'development';
  if (name.includes('okta') || name.includes('auth') || name.includes('duo')) return 'security';
  return 'other';
}