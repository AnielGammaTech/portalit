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

  // Get auth token — Datto RMM uses password grant with public-client:public as Basic auth
  const baseUrl = apiUrl.replace(/\/$/, '');
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', apiKey);
  params.append('password', apiSecret);

  const basicAuth = Buffer.from('public-client:public').toString('base64');
  const tokenResponse = await fetch(`${baseUrl}/auth/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!tokenResponse.ok) {
    const err = new Error('Failed to authenticate with Datto RMM');
    err.statusCode = 401;
    throw err;
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // Fetch all sites with pagination (Datto paginates at 250 items, 0-based pages)
  let sites = [];
  let sitePage = 0;
  const pageSize = 250;

  while (true) {
    const sitesResponse = await fetch(`${baseUrl}/api/v2/account/sites?max=${pageSize}&page=${sitePage}`, {
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
    const pageSites = sitesData.sites || [];

    if (pageSites.length === 0) break;
    sites = sites.concat(pageSites);

    if (pageSites.length < pageSize) break;
    sitePage++;
    if (sitePage > 20) break; // Safety limit
  }

  // Fetch device counts per site
  const billingData = [];

  for (const site of sites) {
    // Fetch devices for this site with pagination (Datto paginates at 250)
    let deviceCount = 0;
    let devPage = 0;

    while (true) {
      const devicesResponse = await fetch(`${baseUrl}/api/v2/site/${site.uid}/devices?max=${pageSize}&page=${devPage}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!devicesResponse.ok) break;

      const devicesData = await devicesResponse.json();
      const pageDevices = devicesData.devices || [];

      deviceCount += pageDevices.length;

      if (pageDevices.length < pageSize) break;
      devPage++;
      if (devPage > 50) break; // Safety limit
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
        (c.name || '').toLowerCase().includes((billing.site_name || '').toLowerCase()) ||
        (billing.site_name || '').toLowerCase().includes((c.name || '').toLowerCase())
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
