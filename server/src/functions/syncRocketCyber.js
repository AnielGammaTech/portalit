import { getServiceSupabase } from '../lib/supabase.js';

const API_BASE_URL = 'https://api-us.rocketcyber.com/v2';

async function rocketCyberApiCall(endpoint, params = {}) {
  const ROCKETCYBER_API_TOKEN = process.env.ROCKETCYBER_API_TOKEN;
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${ROCKETCYBER_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RocketCyber API error: ${response.status} - ${error}`);
  }

  return response.json();
}

function mapSeverity(priority) {
  if (!priority) return 'medium';
  const p = String(priority).toLowerCase();
  if (p === 'critical' || p === '1') return 'critical';
  if (p === 'high' || p === '2') return 'high';
  if (p === 'medium' || p === '3') return 'medium';
  if (p === 'low' || p === '4') return 'low';
  return 'informational';
}

function mapStatus(status) {
  if (!status) return 'open';
  const s = String(status).toLowerCase();
  if (s.includes('open') || s.includes('new')) return 'open';
  if (s.includes('progress') || s.includes('investigating')) return 'investigating';
  if (s.includes('resolved')) return 'resolved';
  if (s.includes('closed') || s.includes('suppressed')) return 'closed';
  return 'open';
}

function buildIncidentData(incident, customerId) {
  return {
    customer_id: customerId,
    incident_id: String(incident.id),
    title: incident.title || incident.description || 'Security Incident',
    description: incident.details || incident.description || '',
    severity: mapSeverity(incident.priority || incident.severity),
    status: mapStatus(incident.status),
    category: incident.category || incident.eventType || '',
    app_name: incident.appName || incident.app?.name || '',
    hostname: incident.hostname || incident.agent?.hostname || '',
    detected_at: incident.createdAt || incident.eventTime,
    resolved_at: incident.resolvedAt || null,
    raw_data: incident
  };
}

async function fetchAgentCount(rcAccountId) {
  let totalAgents = 0;
  let page = 1;
  const pageSize = 100;

  while (true) {
    const data = await rocketCyberApiCall(`/account/${rcAccountId}/agents`, { page, pageSize });
    const agents = data.data || [];
    totalAgents += agents.length;

    if (agents.length < pageSize || page >= (data.totalPages || 1)) break;
    page++;
    if (page > 50) break; // Safety limit
  }

  return totalAgents;
}

// Cache endpoint probe results to avoid redundant API calls per account
const endpointCache = new Map();

async function fetchOpenIncidents(rcAccountId) {
  // Determine correct endpoint (cached per account)
  let endpoint = endpointCache.get(rcAccountId);
  if (!endpoint) {
    endpoint = `/account/${rcAccountId}/incidents`;
    try {
      await rocketCyberApiCall(endpoint, { page: 1, pageSize: 1 });
    } catch (err) {
      endpoint = `/account/${rcAccountId}/events`;
    }
    endpointCache.set(rcAccountId, endpoint);
  }

  let allIncidents = [];
  let page = 1;
  const pageSize = 100;

  // Only sync open incidents
  while (true) {
    const incidentsData = await rocketCyberApiCall(endpoint, { page, pageSize, status: 'open' });
    const pageIncidents = incidentsData.data || [];

    if (!pageIncidents || pageIncidents.length === 0) break;
    allIncidents = allIncidents.concat(pageIncidents);

    if (pageIncidents.length < pageSize || page >= (incidentsData.totalPages || 1)) break;
    page++;
    if (page > 20) break; // Safety limit
  }

  return allIncidents;
}

export async function syncRocketCyber(body, user) {
  const supabase = getServiceSupabase();
  const { action, customer_id, account_id } = body;

  if (!process.env.ROCKETCYBER_API_TOKEN) {
    const err = new Error('RocketCyber API token not configured');
    err.statusCode = 400;
    throw err;
  }

  // Action: Test connection and get account info
  if (action === 'test_connection') {
    if (account_id) {
      const accountData = await rocketCyberApiCall(`/account/${account_id}`);
      return { success: true, account: accountData };
    }

    return {
      success: true,
      message: 'API token is valid. Please provide your MSP account ID to list customers.'
    };
  }

  // Action: List all RocketCyber accounts/customers under MSP
  if (action === 'list_accounts') {
    const { msp_account_id } = body;
    if (!msp_account_id) {
      const err = new Error('msp_account_id is required');
      err.statusCode = 400;
      throw err;
    }

    try {
      const accountData = await rocketCyberApiCall(`/account/${msp_account_id}`);
      const customerIds = accountData.customers || [];

      const customers = [];
      const batchSize = 20;
      const idsToFetch = customerIds.slice(0, 100);

      for (let i = 0; i < idsToFetch.length; i += batchSize) {
        const batch = idsToFetch.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (customerId) => {
            try {
              const customerData = await rocketCyberApiCall(`/account/${customerId}`);
              return {
                id: customerId,
                name: customerData.name,
                status: customerData.status,
                type: customerData.type
              };
            } catch (err) {
              console.error(`Error fetching customer ${customerId}:`, err.message);
              return null;
            }
          })
        );
        customers.push(...batchResults.filter(Boolean));
      }

      return {
        success: true,
        mspAccount: {
          id: msp_account_id,
          name: accountData.name
        },
        customers,
        totalCustomerIds: customerIds.length
      };
    } catch (err) {
      console.error('Error listing accounts:', err.message);
      const error = new Error(`Failed to list accounts: ${err.message}. Make sure you're using your Provider account ID from RocketCyber Settings.`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Action: Get account details
  if (action === 'get_account') {
    if (!account_id) {
      const err = new Error('account_id is required');
      err.statusCode = 400;
      throw err;
    }

    const accountData = await rocketCyberApiCall(`/account/${account_id}`);
    return { success: true, account: accountData };
  }

  // Action: Get incidents/events for an account
  if (action === 'get_incidents') {
    if (!account_id) {
      const err = new Error('account_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { page = 1, pageSize = 100, status: incidentStatus } = body;

    const params = { page, pageSize };
    if (incidentStatus) {
      params.status = incidentStatus;
    }

    try {
      const incidentsData = await rocketCyberApiCall(`/account/${account_id}/incidents`, params);
      return {
        success: true,
        incidents: incidentsData.data || incidentsData,
        totalCount: incidentsData.totalCount,
        currentPage: incidentsData.currentPage,
        totalPages: incidentsData.totalPages
      };
    } catch (err) {
      // Try events endpoint as fallback
      const eventsData = await rocketCyberApiCall(`/account/${account_id}/events`, params);
      return {
        success: true,
        incidents: eventsData.data || eventsData,
        totalCount: eventsData.totalCount,
        currentPage: eventsData.currentPage,
        totalPages: eventsData.totalPages
      };
    }
  }

  // Action: Get agents/devices for an account
  if (action === 'get_agents') {
    if (!account_id) {
      const err = new Error('account_id is required');
      err.statusCode = 400;
      throw err;
    }

    const agentsData = await rocketCyberApiCall(`/account/${account_id}/agents`);
    return {
      success: true,
      agents: agentsData.data || agentsData,
      totalCount: agentsData.totalCount
    };
  }

  // Action: Get apps/detection modules for an account
  if (action === 'get_apps') {
    if (!account_id) {
      const err = new Error('account_id is required');
      err.statusCode = 400;
      throw err;
    }

    const appsData = await rocketCyberApiCall(`/account/${account_id}/apps`);
    return {
      success: true,
      apps: appsData.data || appsData,
      totalCount: appsData.totalCount
    };
  }

  // Action: Sync incidents for a specific customer
  if (action === 'sync_incidents') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: mappings } = await supabase
      .from('rocket_cyber_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      const err = new Error('No RocketCyber account mapped to this customer');
      err.statusCode = 400;
      throw err;
    }

    const mapping = mappings[0];
    const rcAccountId = mapping.rc_account_id;

    const allIncidents = await fetchOpenIncidents(rcAccountId);
    console.log(`Found ${allIncidents.length} incidents for account ${rcAccountId}`);

    // Get existing incidents for this customer
    const { data: existingIncidents } = await supabase
      .from('rocket_cyber_incidents')
      .select('*')
      .eq('customer_id', customer_id);

    const existingByIncidentId = {};
    (existingIncidents || []).forEach(i => { existingByIncidentId[i.incident_id] = i; });

    let syncedCount = 0;

    for (const incident of allIncidents) {
      const incidentId = String(incident.id);
      const existing = existingByIncidentId[incidentId];
      const incidentData = buildIncidentData(incident, customer_id);

      if (existing) {
        // Skip update if manually closed
        if (existing.manually_closed) {
          continue;
        }
        if (existing.status !== incidentData.status || existing.resolved_at !== incidentData.resolved_at) {
          await supabase
            .from('rocket_cyber_incidents')
            .update(incidentData)
            .eq('id', existing.id);
          syncedCount++;
        }
      } else {
        const { data: created, error } = await supabase
          .from('rocket_cyber_incidents')
          .insert(incidentData)
          .select()
          .single();
        if (error) {
          console.error(`Failed to create incident ${incidentId}:`, error.message);
        }
        syncedCount++;
      }
    }

    // Fetch agent/device count from RocketCyber API
    let totalAgents = 0;
    try {
      totalAgents = await fetchAgentCount(rcAccountId);
    } catch (err) {
      console.error(`Failed to fetch agent count for account ${rcAccountId}:`, err.message);
    }

    // Build cached_data summary for fast frontend reads
    const allDbIncidents = await supabase
      .from('rocket_cyber_incidents')
      .select('*')
      .eq('customer_id', customer_id);
    const allCustomerIncidents = allDbIncidents.data || [];

    const cachedData = {
      total_agents: totalAgents,
      totalIncidents: allCustomerIncidents.length,
      openIncidents: allCustomerIncidents.filter(i => i.status === 'open' || i.status === 'investigating').length,
      resolvedIncidents: allCustomerIncidents.filter(i => i.status === 'resolved' || i.status === 'closed').length,
      bySeverity: {
        critical: allCustomerIncidents.filter(i => i.severity === 'critical').length,
        high: allCustomerIncidents.filter(i => i.severity === 'high').length,
        medium: allCustomerIncidents.filter(i => i.severity === 'medium').length,
        low: allCustomerIncidents.filter(i => i.severity === 'low').length,
        informational: allCustomerIncidents.filter(i => i.severity === 'informational').length,
      }
    };

    // Update mapping last_synced + cached_data
    await supabase
      .from('rocket_cyber_mappings')
      .update({ last_synced: new Date().toISOString(), cached_data: cachedData })
      .eq('id', mapping.id);

    return {
      success: true,
      recordsSynced: syncedCount,
      totalIncidents: allIncidents.length,
      totalAgents
    };
  }

  // Action: Sync all mapped customers
  if (action === 'sync_all') {
    const { data: allMappings } = await supabase
      .from('rocket_cyber_mappings')
      .select('*');

    if (!allMappings || allMappings.length === 0) {
      return { success: true, recordsSynced: 0, message: 'No mappings found' };
    }

    let totalSynced = 0;
    const errors = [];

    for (const mapping of allMappings) {
      try {
        const rcAccountId = mapping.rc_account_id;
        const allIncidents = await fetchOpenIncidents(rcAccountId);

        const { data: existingIncidents } = await supabase
          .from('rocket_cyber_incidents')
          .select('*')
          .eq('customer_id', mapping.customer_id);

        const existingByIncidentId = {};
        (existingIncidents || []).forEach(i => { existingByIncidentId[i.incident_id] = i; });

        for (const incident of allIncidents) {
          const incidentId = String(incident.id);
          const existing = existingByIncidentId[incidentId];
          const incidentData = buildIncidentData(incident, mapping.customer_id);

          if (existing) {
            if (existing.manually_closed) {
              continue;
            }
            if (existing.status !== incidentData.status) {
              await supabase
                .from('rocket_cyber_incidents')
                .update(incidentData)
                .eq('id', existing.id);
              totalSynced++;
            }
          } else {
            await supabase
              .from('rocket_cyber_incidents')
              .insert(incidentData);
            totalSynced++;
          }
        }

        // Fetch agent/device count from RocketCyber API (all statuses: online + offline + isolated)
        let totalAgents = 0;
        try {
          totalAgents = await fetchAgentCount(rcAccountId);
        } catch (err) {
          console.error(`Failed to fetch agent count for account ${rcAccountId}:`, err.message);
        }

        // Build cached_data summary
        const allDbIncidents = await supabase
          .from('rocket_cyber_incidents')
          .select('*')
          .eq('customer_id', mapping.customer_id);
        const allCustomerIncidents = allDbIncidents.data || [];

        const cachedData = {
          total_agents: totalAgents,
          totalIncidents: allCustomerIncidents.length,
          openIncidents: allCustomerIncidents.filter(i => i.status === 'open' || i.status === 'investigating').length,
          resolvedIncidents: allCustomerIncidents.filter(i => i.status === 'resolved' || i.status === 'closed').length,
          bySeverity: {
            critical: allCustomerIncidents.filter(i => i.severity === 'critical').length,
            high: allCustomerIncidents.filter(i => i.severity === 'high').length,
            medium: allCustomerIncidents.filter(i => i.severity === 'medium').length,
            low: allCustomerIncidents.filter(i => i.severity === 'low').length,
            informational: allCustomerIncidents.filter(i => i.severity === 'informational').length,
          }
        };

        await supabase
          .from('rocket_cyber_mappings')
          .update({ last_synced: new Date().toISOString(), cached_data: cachedData })
          .eq('id', mapping.id);

      } catch (err) {
        console.error(`Error syncing account ${mapping.rc_account_id}:`, err.message);
        errors.push({ account: mapping.rc_account_name, error: err.message });
      }
    }

    return {
      success: true,
      recordsSynced: totalSynced,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // Action: Get summary/stats for a customer
  if (action === 'get_summary') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: incidents } = await supabase
      .from('rocket_cyber_incidents')
      .select('*')
      .eq('customer_id', customer_id);

    const incidentList = incidents || [];

    const summary = {
      totalIncidents: incidentList.length,
      openIncidents: incidentList.filter(i => i.status === 'open' || i.status === 'investigating').length,
      resolvedIncidents: incidentList.filter(i => i.status === 'resolved' || i.status === 'closed').length,
      bySeverity: {
        critical: incidentList.filter(i => i.severity === 'critical').length,
        high: incidentList.filter(i => i.severity === 'high').length,
        medium: incidentList.filter(i => i.severity === 'medium').length,
        low: incidentList.filter(i => i.severity === 'low').length,
        informational: incidentList.filter(i => i.severity === 'informational').length
      },
      recentIncidents: incidentList
        .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at))
        .slice(0, 10)
    };

    return { success: true, summary };
  }

  const err = new Error('Invalid action');
  err.statusCode = 400;
  throw err;
}
