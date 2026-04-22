import { getServiceSupabase } from '../lib/supabase.js';

const GRAPHUS_BASE_URL = process.env.GRAPHUS_API_URL || 'https://api.graph.us';

function getGraphusAuth() {
  const mspGuid = process.env.GRAPHUS_MSP_GUID;
  if (!mspGuid) throw new Error('GRAPHUS_MSP_GUID not configured — find it in Graphus portal > Integrations > MSP Information');
  return mspGuid;
}

async function graphusApiCall(endpoint, mspGuid) {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${GRAPHUS_BASE_URL}${endpoint}${separator}msp_guid=${mspGuid}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Graphus API ${response.status}: ${text}`);
  }

  return response.json();
}

export async function syncGraphus(body, user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;

  if (action === 'test_connection') {
    try {
      const mspGuid = getGraphusAuth();
      const data = await graphusApiCall('/v1/organizations', mspGuid);
      const orgs = data.organizations || data.data || data || [];
      return {
        success: true,
        message: `Connected to Graphus — ${Array.isArray(orgs) ? orgs.length : 0} organizations found`,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (action === 'list_organizations') {
    try {
      const mspGuid = getGraphusAuth();
      const data = await graphusApiCall('/v1/organizations', mspGuid);
      const orgs = (data.organizations || data.data || data || []).map((org) => ({
        id: String(org.id || org.organizationId || org.orgId),
        name: org.name || org.organizationName || org.orgName || '',
        userCount: org.userCount || org.protectedUsers || org.mailboxCount || 0,
        status: org.status || 'active',
      }));
      return { success: true, organizations: orgs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (action === 'automap') {
    try {
      const mspGuid = getGraphusAuth();
      const data = await graphusApiCall('/v1/organizations', mspGuid);
      const orgs = data.organizations || data.data || data || [];

      const { data: customers } = await supabase.from('customers').select('*');
      const { data: existingMappings } = await supabase.from('graphus_mappings').select('*');
      const existingOrgIds = new Set((existingMappings || []).map((m) => m.graphus_org_id));

      let mappedCount = 0;
      const mappedPairs = [];

      for (const org of orgs) {
        const orgId = String(org.id || org.organizationId || org.orgId);
        if (existingOrgIds.has(orgId)) continue;

        const orgName = (org.name || org.organizationName || '').toLowerCase().trim();
        const matched = (customers || []).find((c) => {
          const custName = (c.name || '').toLowerCase().trim();
          return custName === orgName || custName.includes(orgName) || orgName.includes(custName);
        });

        if (matched) {
          await supabase.from('graphus_mappings').insert({
            customer_id: matched.id,
            customer_name: matched.name,
            graphus_org_id: orgId,
            graphus_org_name: org.name || org.organizationName || '',
          });
          mappedCount++;
          mappedPairs.push({ org: org.name, customer: matched.name });
        }
      }

      return { success: true, mappedCount, mappedPairs, totalOrgs: orgs.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (action === 'sync_customer') {
    if (!customer_id) return { success: false, error: 'customer_id required' };

    const { data: mappings } = await supabase
      .from('graphus_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      return { success: false, error: 'Customer not mapped to Graphus org' };
    }

    const mapping = mappings[0];
    const mspGuid = getGraphusAuth();

    const orgData = await graphusApiCall(`/v1/organizations/${mapping.graphus_org_id}`, mspGuid);
    const org = orgData.organization || orgData.data || orgData || {};

    const usersData = await graphusApiCall(`/v1/organizations/${mapping.graphus_org_id}/users`, mspGuid).catch(() => null);
    const users = usersData?.users || usersData?.data || [];

    const userCount = org.userCount || org.protectedUsers || org.mailboxCount || users.length || 0;

    const cachedData = {
      protected_users: userCount,
      users: Array.isArray(users) ? users.slice(0, 500).map((u) => ({
        id: u.id,
        email: u.email || u.userPrincipalName,
        status: u.status || 'active',
      })) : [],
    };

    await supabase
      .from('graphus_mappings')
      .update({ cached_data: cachedData, last_synced: new Date().toISOString() })
      .eq('id', mapping.id);

    return { success: true, protectedUsers: userCount };
  }

  if (action === 'sync_all') {
    const { data: allMappings } = await supabase.from('graphus_mappings').select('*');
    if (!allMappings || allMappings.length === 0) {
      return { success: true, recordsSynced: 0, message: 'No Graphus mappings found' };
    }

    let mspGuid;
    try { mspGuid = getGraphusAuth(); } catch (e) {
      return { success: false, error: e.message };
    }

    let totalSynced = 0;
    const errors = [];

    for (const mapping of allMappings) {
      try {
        const orgData = await graphusApiCall(`/v1/organizations/${mapping.graphus_org_id}`, mspGuid);
        const org = orgData.organization || orgData.data || orgData || {};

        const usersData = await graphusApiCall(`/v1/organizations/${mapping.graphus_org_id}/users`, mspGuid).catch(() => null);
        const users = usersData?.users || usersData?.data || [];

        const userCount = org.userCount || org.protectedUsers || org.mailboxCount || users.length || 0;

        const cachedData = {
          protected_users: userCount,
          users: Array.isArray(users) ? users.slice(0, 500).map((u) => ({
            id: u.id,
            email: u.email || u.userPrincipalName,
            status: u.status || 'active',
          })) : [],
        };

        await supabase
          .from('graphus_mappings')
          .update({ cached_data: cachedData, last_synced: new Date().toISOString() })
          .eq('id', mapping.id);

        totalSynced++;
      } catch (err) {
        errors.push({ org: mapping.graphus_org_name, error: err.message });
      }
    }

    return { success: true, recordsSynced: totalSynced, errors: errors.length > 0 ? errors : undefined };
  }

  if (action === 'get_cached') {
    if (!customer_id) return { success: false, error: 'customer_id required' };

    const { data: mappings } = await supabase
      .from('graphus_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      return { success: false, error: 'Customer not mapped to Graphus org' };
    }

    return {
      success: true,
      cached: true,
      last_synced: mappings[0].last_synced,
      data: mappings[0].cached_data,
    };
  }

  return { success: false, error: `Unknown action: ${action}` };
}
