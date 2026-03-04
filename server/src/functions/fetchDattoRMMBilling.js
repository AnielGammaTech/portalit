import { getServiceSupabase } from '../lib/supabase.js';

export async function fetchDattoRMMBilling(body, user) {
  const supabase = getServiceSupabase();

  const apiKey = process.env.DATTO_RMM_API_KEY;
  const apiSecret = process.env.DATTO_RMM_API_SECRET;
  const apiUrl = process.env.DATTO_RMM_API_URL;

  if (!apiKey || !apiSecret || !apiUrl) {
    const err = new Error('Datto RMM credentials not configured');
    err.statusCode = 400;
    throw err;
  }

  // Get auth token
  const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const tokenResponse = await fetch(`${apiUrl}/auth/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!tokenResponse.ok) {
    const err = new Error('Failed to authenticate with Datto RMM');
    err.statusCode = 401;
    throw err;
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
    const err = new Error('Failed to fetch Datto RMM sites');
    err.statusCode = 500;
    throw err;
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
  const [mappingsResult, customersResult] = await Promise.all([
    supabase.from('datto_site_mappings').select('*'),
    supabase.from('customers').select('*')
  ]);

  const mappings = mappingsResult.data || [];
  const customers = customersResult.data || [];

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

  return {
    success: true,
    data: matchedData,
    total_sites: sites.length,
    total_devices: billingData.reduce((sum, b) => sum + b.device_count, 0)
  };
}
