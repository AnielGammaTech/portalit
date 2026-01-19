import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const REGION_ENDPOINTS = {
  us: 'https://o365-api-us.spanningbackup.com',
  eu: 'https://o365-api-eu.spanningbackup.com',
  ap: 'https://o365-api-ap.spanningbackup.com',
  ca: 'https://o365-api-ca.spanningbackup.com',
  uk: 'https://o365-api-uk.spanningbackup.com',
  af: 'https://o365-api-af.spanningbackup.com'
};

async function spanningApiCall(endpoint, apiToken, region = 'us') {
  const baseUrl = REGION_ENDPOINTS[region] || REGION_ENDPOINTS.us;
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Spanning API error: ${response.status} ${response.statusText}`);
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
      if (!api_token) {
        return Response.json({ error: 'API token is required' }, { status: 400 });
      }
      
      try {
        const tenant = await spanningApiCall('/external/tenant', api_token, region || 'us');
        return Response.json({ 
          success: true, 
          tenant: {
            name: tenant.companyName || tenant.name,
            users: tenant.users,
            assigned: tenant.assigned
          }
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
      const users = await spanningApiCall('/external/users', mapping.api_token, mapping.region);
      
      return Response.json({ 
        success: true, 
        users: users.users || users,
        total: users.total || (users.users ? users.users.length : 0)
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
      const usersResponse = await spanningApiCall('/external/users', mapping.api_token, mapping.region);
      const spanningUsers = usersResponse.users || usersResponse || [];

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

    // Sync licenses
    if (action === 'sync_licenses') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      const mappings = await base44.asServiceRole.entities.SpanningMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ error: 'No Spanning mapping found for this customer' }, { status: 400 });
      }

      const mapping = mappings[0];
      const tenant = await spanningApiCall('/external/tenant', mapping.api_token, mapping.region);
      const usersResponse = await spanningApiCall('/external/users', mapping.api_token, mapping.region);
      const users = usersResponse.users || usersResponse || [];
      
      const assignedUsers = users.filter(u => u.isAdmin || u.assigned === true).length || tenant.assigned || users.length;
      const totalUsers = tenant.users || users.length;

      // Get customer name
      const customers = await base44.asServiceRole.entities.Customer.filter({ id: customer_id });
      const customer = customers[0];

      const licenseId = `spanning-${customer_id}`;
      const existingLicenses = await base44.asServiceRole.entities.SaaSLicense.filter({ 
        customer_id, 
        source: 'spanning' 
      });

      const licenseData = {
        customer_id,
        customer_name: customer?.name,
        application_name: 'Spanning Backup',
        vendor: 'Spanning (Kaseya)',
        license_type: 'Microsoft 365 Backup',
        quantity: totalUsers,
        assigned_users: assignedUsers,
        status: 'active',
        external_id: licenseId,
        source: 'spanning',
        website_url: 'https://spanning.com',
        logo_url: 'https://cdn.brandfetch.io/idchmBoHEZ/w/400/h/400/theme/dark/icon.png',
        category: 'backup',
        notes: `Spanning Backup - ${assignedUsers} users backed up from ${tenant.companyName || customer?.name}`
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
        tenantName: tenant.companyName || tenant.name
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
          const tenant = await spanningApiCall('/external/tenant', mapping.api_token, mapping.region);
          const usersResponse = await spanningApiCall('/external/users', mapping.api_token, mapping.region);
          const users = usersResponse.users || usersResponse || [];
          
          const assignedUsers = users.filter(u => u.isAdmin || u.assigned === true).length || tenant.assigned || users.length;
          const totalUsers = tenant.users || users.length;

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
            vendor: 'Spanning (Kaseya)',
            license_type: 'Microsoft 365 Backup',
            quantity: totalUsers,
            assigned_users: assignedUsers,
            status: 'active',
            external_id: `spanning-${mapping.customer_id}`,
            source: 'spanning',
            website_url: 'https://spanning.com',
            logo_url: 'https://cdn.brandfetch.io/idchmBoHEZ/w/400/h/400/theme/dark/icon.png',
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