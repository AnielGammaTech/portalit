import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const apiKey = Deno.env.get("DATTO_RMM_API_KEY");
    const apiSecret = Deno.env.get("DATTO_RMM_API_SECRET");
    const apiUrl = Deno.env.get("DATTO_RMM_API_URL");

    if (!apiKey || !apiSecret || !apiUrl) {
      return Response.json({ error: 'Datto RMM credentials not configured' }, { status: 400 });
    }

    // Get auth token
    const authString = btoa(`${apiKey}:${apiSecret}`);
    const tokenResponse = await fetch(`${apiUrl}/auth/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      return Response.json({ error: 'Failed to authenticate with Datto RMM' }, { status: 401 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch all sites (customers in Datto RMM)
    const sitesResponse = await fetch(`${apiUrl}/api/v2/account/sites`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!sitesResponse.ok) {
      return Response.json({ error: 'Failed to fetch Datto RMM sites' }, { status: 500 });
    }

    const sitesData = await sitesResponse.json();
    const sites = sitesData.sites || [];

    // Fetch device counts per site
    const billingData = [];
    
    for (const site of sites) {
      // Fetch devices for this site
      const devicesResponse = await fetch(`${apiUrl}/api/v2/site/${site.uid}/devices`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      let deviceCount = 0;
      if (devicesResponse.ok) {
        const devicesData = await devicesResponse.json();
        deviceCount = devicesData.devices?.length || 0;
      }

      billingData.push({
        site_id: site.uid,
        site_name: site.name,
        device_count: deviceCount,
        vendor: 'datto_rmm'
      });
    }

    // Get existing mappings and customers
    const [mappings, customers] = await Promise.all([
      base44.asServiceRole.entities.DattoSiteMapping.list(),
      base44.asServiceRole.entities.Customer.list()
    ]);

    // Match billing data to customers
    const matchedData = billingData.map(billing => {
      const mapping = mappings.find(m => m.datto_site_id === billing.site_id);
      let customer = null;
      
      if (mapping) {
        customer = customers.find(c => c.id === mapping.customer_id);
      } else {
        // Try to match by name
        customer = customers.find(c => 
          c.name.toLowerCase().includes(billing.site_name.toLowerCase()) ||
          billing.site_name.toLowerCase().includes(c.name.toLowerCase())
        );
      }

      return {
        ...billing,
        customer_id: customer?.id || null,
        customer_name: customer?.name || billing.site_name,
        matched: !!customer
      };
    });

    return Response.json({ 
      success: true, 
      data: matchedData,
      total_sites: sites.length,
      total_devices: billingData.reduce((sum, b) => sum + b.device_count, 0)
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});