import { getServiceSupabase } from '../lib/supabase.js';

export async function fetchJumpCloudBilling(body, user) {
  const supabase = getServiceSupabase();

  const apiKey = process.env.JUMPCLOUD_API_KEY;
  const providerId = process.env.JUMPCLOUD_PROVIDER_ID;

  if (!apiKey || !providerId) {
    const err = new Error('JumpCloud credentials not configured');
    err.statusCode = 400;
    throw err;
  }

  // Fetch all organizations (customers) from JumpCloud MSP with pagination
  let allOrgs = [];
  let orgSkip = 0;
  const orgPageLimit = 100;
  while (true) {
    const orgsResponse = await fetch(
      `https://console.jumpcloud.com/api/organizations?limit=${orgPageLimit}&skip=${orgSkip}`,
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!orgsResponse.ok) {
      const err = new Error('Failed to fetch JumpCloud organizations');
      err.statusCode = 500;
      throw err;
    }

    const page = await orgsResponse.json();
    const results = page.results || page;
    const orgs = Array.isArray(results) ? results : [];
    allOrgs = allOrgs.concat(orgs);
    orgSkip += orgs.length;
    if (orgs.length < orgPageLimit) break;
  }

  const organizations = { results: allOrgs };
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
  const [mappingsResult, customersResult] = await Promise.all([
    supabase.from('jump_cloud_mappings').select('*'),
    supabase.from('customers').select('*')
  ]);

  const mappings = mappingsResult.data || [];
  const customers = customersResult.data || [];

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

  return {
    success: true,
    data: matchedData,
    total_orgs: allOrgs.length,
    total_users: billingData.reduce((sum, b) => sum + b.user_count, 0)
  };
}
