import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const apiKey = Deno.env.get("JUMPCLOUD_API_KEY");
    const providerId = Deno.env.get("JUMPCLOUD_PROVIDER_ID");

    if (!apiKey || !providerId) {
      return Response.json({ error: 'JumpCloud credentials not configured' }, { status: 400 });
    }

    // Fetch all organizations (customers) from JumpCloud MSP
    const orgsResponse = await fetch(`https://console.jumpcloud.com/api/organizations`, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!orgsResponse.ok) {
      return Response.json({ error: 'Failed to fetch JumpCloud organizations' }, { status: 500 });
    }

    const organizations = await orgsResponse.json();
    const billingData = [];

    // For each organization, get user count
    for (const org of organizations.results || organizations) {
      // Fetch users for this organization
      const usersResponse = await fetch(`https://console.jumpcloud.com/api/systemusers?limit=1000`, {
        headers: {
          'x-api-key': apiKey,
          'x-org-id': org.id || org._id,
          'Content-Type': 'application/json'
        }
      });

      let userCount = 0;
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        userCount = usersData.totalCount || usersData.results?.length || 0;
      }

      billingData.push({
        org_id: org.id || org._id,
        org_name: org.displayName || org.name,
        user_count: userCount,
        vendor: 'jumpcloud'
      });
    }

    // Get existing mappings and customers
    const [mappings, customers] = await Promise.all([
      base44.asServiceRole.entities.JumpCloudMapping.list(),
      base44.asServiceRole.entities.Customer.list()
    ]);

    // Match billing data to customers
    const matchedData = billingData.map(billing => {
      const mapping = mappings.find(m => m.jumpcloud_org_id === billing.org_id);
      let customer = null;
      
      if (mapping) {
        customer = customers.find(c => c.id === mapping.customer_id);
      } else {
        // Try to match by name
        customer = customers.find(c => 
          c.name.toLowerCase().includes(billing.org_name.toLowerCase()) ||
          billing.org_name.toLowerCase().includes(c.name.toLowerCase())
        );
      }

      return {
        ...billing,
        customer_id: customer?.id || null,
        customer_name: customer?.name || billing.org_name,
        matched: !!customer
      };
    });

    return Response.json({ 
      success: true, 
      data: matchedData,
      total_orgs: organizations.results?.length || organizations.length || 0,
      total_users: billingData.reduce((sum, b) => sum + b.user_count, 0)
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});