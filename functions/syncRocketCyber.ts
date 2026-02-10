import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ROCKETCYBER_API_TOKEN = Deno.env.get('ROCKETCYBER_API_TOKEN');
// RocketCyber API uses v2 for most endpoints
const API_BASE_URL = 'https://api-us.rocketcyber.com/v2';

async function rocketCyberApiCall(endpoint, params = {}) {
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
  // RocketCyber uses priority levels
  if (!priority) return 'medium';
  const p = String(priority).toLowerCase();
  if (p === 'critical' || p === '1') return 'critical';
  if (p === 'high' || p === '2') return 'high';
  if (p === 'medium' || p === '3') return 'medium';
  if (p === 'low' || p === '4') return 'low';
  return 'informational';
}

function mapStatus(status) {
  if (!status) return 'closed';
  const s = String(status).toLowerCase();
  // Only 'open' or 'new' count as open - must be exact match
  if (s === 'open' || s === 'new') return 'open';
  // Everything else (suppressed, in_progress, investigating, resolved, closed, etc.) is closed
  return 'closed';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, customer_id, account_id, scheduled } = body;

    // For scheduled runs, skip user auth check
    if (!scheduled) {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    }

    if (!ROCKETCYBER_API_TOKEN) {
      return Response.json({ error: 'RocketCyber API token not configured' }, { status: 400 });
    }

    // Action: Test connection and get account info
    if (action === 'test_connection') {
      // Try to get the account info - we need the MSP account ID
      // If user provides account_id, use it, otherwise try to discover
      if (account_id) {
        const accountData = await rocketCyberApiCall(`/account/${account_id}`);
        return Response.json({
          success: true,
          account: accountData
        });
      }
      
      return Response.json({
        success: true,
        message: 'API token is valid. Please provide your MSP account ID to list customers.'
      });
    }

    // Action: List all RocketCyber accounts/customers under MSP
    if (action === 'list_accounts') {
      const { msp_account_id } = body;
      if (!msp_account_id) {
        return Response.json({ error: 'msp_account_id is required' }, { status: 400 });
      }

      try {
        const accountData = await rocketCyberApiCall(`/account/${msp_account_id}`);
        const customerIds = accountData.customers || [];
        
        // Fetch details for each customer (limit to avoid timeout)
        const customers = [];
        const batchSize = 20;
        const idsToFetch = customerIds.slice(0, 100); // Limit to first 100 for performance
        
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

        return Response.json({
          success: true,
          mspAccount: {
            id: msp_account_id,
            name: accountData.name
          },
          customers,
          totalCustomerIds: customerIds.length
        });
      } catch (err) {
        console.error('Error listing accounts:', err.message);
        return Response.json({ 
          error: `Failed to list accounts: ${err.message}. Make sure you're using your Provider account ID from RocketCyber Settings.` 
        }, { status: 400 });
      }
    }

    // Action: Get account details
    if (action === 'get_account') {
      if (!account_id) {
        return Response.json({ error: 'account_id is required' }, { status: 400 });
      }

      const accountData = await rocketCyberApiCall(`/account/${account_id}`);
      return Response.json({ success: true, account: accountData });
    }

    // Action: Get incidents/events for an account (RocketCyber calls them 'events' in v2)
    if (action === 'get_incidents') {
      if (!account_id) {
        return Response.json({ error: 'account_id is required' }, { status: 400 });
      }

      const { page = 1, pageSize = 100, status: incidentStatus } = body;
      
      const params = { page, pageSize };
      if (incidentStatus) {
        params.status = incidentStatus;
      }

      // Try incidents endpoint first, fall back to events if not available
      try {
        const incidentsData = await rocketCyberApiCall(`/account/${account_id}/incidents`, params);
        return Response.json({
          success: true,
          incidents: incidentsData.data || incidentsData,
          totalCount: incidentsData.totalCount,
          currentPage: incidentsData.currentPage,
          totalPages: incidentsData.totalPages
        });
      } catch (err) {
        // Try events endpoint as fallback
        const eventsData = await rocketCyberApiCall(`/account/${account_id}/events`, params);
        return Response.json({
          success: true,
          incidents: eventsData.data || eventsData,
          totalCount: eventsData.totalCount,
          currentPage: eventsData.currentPage,
          totalPages: eventsData.totalPages
        });
      }
    }

    // Action: Get agents/devices for an account
    if (action === 'get_agents') {
      if (!account_id) {
        return Response.json({ error: 'account_id is required' }, { status: 400 });
      }

      const agentsData = await rocketCyberApiCall(`/account/${account_id}/agents`);
      return Response.json({
        success: true,
        agents: agentsData.data || agentsData,
        totalCount: agentsData.totalCount
      });
    }

    // Action: Get apps/detection modules for an account
    if (action === 'get_apps') {
      if (!account_id) {
        return Response.json({ error: 'account_id is required' }, { status: 400 });
      }

      const appsData = await rocketCyberApiCall(`/account/${account_id}/apps`);
      return Response.json({
        success: true,
        apps: appsData.data || appsData,
        totalCount: appsData.totalCount
      });
    }

    // Action: Sync incidents for a specific customer
    if (action === 'sync_incidents') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      // Get mapping for this customer
      const mappings = await base44.asServiceRole.entities.RocketCyberMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ error: 'No RocketCyber account mapped to this customer' }, { status: 400 });
      }

      const mapping = mappings[0];
      const rcAccountId = mapping.rocketcyber_account_id;

      // Fetch ALL incidents from RocketCyber to get accurate status
      let allIncidents = [];
      let page = 1;
      const pageSize = 100;

      // Try incidents endpoint first, fall back to events
      let endpoint = `/account/${rcAccountId}/incidents`;
      try {
        await rocketCyberApiCall(endpoint, { page: 1, pageSize: 1 });
      } catch (err) {
        endpoint = `/account/${rcAccountId}/events`;
      }

      // Fetch all incidents (no status filter) to get current status of all incidents
      while (true) {
        const incidentsData = await rocketCyberApiCall(endpoint, { page, pageSize });
        const pageIncidents = incidentsData.data || [];
        
        if (!pageIncidents || pageIncidents.length === 0) break;
        allIncidents = allIncidents.concat(pageIncidents);
        
        if (pageIncidents.length < pageSize || page >= (incidentsData.totalPages || 1)) break;
        page++;
        if (page > 50) break; // Safety limit - increased to get more data
      }

      console.log(`Found ${allIncidents.length} incidents for account ${rcAccountId}`);

      // Get existing incidents for this customer
      const existingIncidents = await base44.asServiceRole.entities.RocketCyberIncident.filter({ customer_id });
      const existingByIncidentId = {};
      existingIncidents.forEach(i => { existingByIncidentId[i.incident_id] = i; });

      let synced = 0;
      let closed = 0;
      const rcIncidentIds = new Set();

      for (const incident of allIncidents) {
        const incidentId = String(incident.id);
        rcIncidentIds.add(incidentId);
        const existing = existingByIncidentId[incidentId];

        // If resolvedAt exists, consider it closed regardless of status field
        const hasResolved = incident.resolvedAt != null;
        const incidentData = {
          customer_id,
          incident_id: incidentId,
          title: incident.title || incident.description || 'Security Incident',
          description: incident.details || incident.description || '',
          severity: mapSeverity(incident.priority || incident.severity),
          status: hasResolved ? 'closed' : mapStatus(incident.status),
          category: incident.category || incident.eventType || '',
          app_name: incident.appName || incident.app?.name || '',
          hostname: incident.hostname || incident.agent?.hostname || '',
          detected_at: incident.createdAt || incident.eventTime,
          resolved_at: incident.resolvedAt || null,
          raw_data: JSON.stringify(incident)
        };

        if (existing) {
          // Only update if status actually changed to avoid rate limiting
          if (existing.status !== incidentData.status) {
            await base44.asServiceRole.entities.RocketCyberIncident.update(existing.id, { status: incidentData.status, resolved_at: incidentData.resolved_at });
            synced++;
            if (incidentData.status !== 'open') closed++;
          }
        } else {
          await base44.asServiceRole.entities.RocketCyberIncident.create(incidentData);
          synced++;
        }
      }

      // Mark any existing incidents NOT in RC response as closed (they were resolved/deleted in RocketCyber)
      for (const existing of existingIncidents) {
        if (!rcIncidentIds.has(existing.incident_id) && existing.status === 'open') {
          await base44.asServiceRole.entities.RocketCyberIncident.update(existing.id, { status: 'closed' });
          closed++;
          synced++;
        }
      }

      // Update mapping last_synced
      await base44.asServiceRole.entities.RocketCyberMapping.update(mapping.id, {
        last_synced: new Date().toISOString()
      });

      return Response.json({
        success: true,
        recordsSynced: synced,
        closedIncidents: closed,
        totalIncidents: allIncidents.length
      });
    }

    // Action: Sync all mapped customers
    if (action === 'sync_all') {
      const allMappings = await base44.asServiceRole.entities.RocketCyberMapping.list();
      
      if (!allMappings || allMappings.length === 0) {
        return Response.json({ success: true, recordsSynced: 0, message: 'No mappings found' });
      }

      let totalSynced = 0;
      const errors = [];

      for (const mapping of allMappings) {
        try {
          const rcAccountId = mapping.rocketcyber_account_id;
          
          // Determine correct endpoint
          let endpoint = `/account/${rcAccountId}/incidents`;
          try {
            await rocketCyberApiCall(endpoint, { page: 1, pageSize: 1 });
          } catch (err) {
            endpoint = `/account/${rcAccountId}/events`;
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
            if (page > 20) break;
          }

          const existingIncidents = await base44.asServiceRole.entities.RocketCyberIncident.filter({ 
            customer_id: mapping.customer_id 
          });
          const existingByIncidentId = {};
          existingIncidents.forEach(i => { existingByIncidentId[i.incident_id] = i; });

          for (const incident of allIncidents) {
            const incidentId = String(incident.id);
            const existing = existingByIncidentId[incidentId];

            // If resolvedAt exists, consider it closed regardless of status field
            const hasResolved = incident.resolvedAt != null;
            const incidentData = {
              customer_id: mapping.customer_id,
              incident_id: incidentId,
              title: incident.title || incident.description || 'Security Incident',
              description: incident.details || incident.description || '',
              severity: mapSeverity(incident.priority || incident.severity),
              status: hasResolved ? 'closed' : mapStatus(incident.status),
              category: incident.category || incident.eventType || '',
              app_name: incident.appName || incident.app?.name || '',
              hostname: incident.hostname || incident.agent?.hostname || '',
              detected_at: incident.createdAt || incident.eventTime,
              resolved_at: incident.resolvedAt || null,
              raw_data: JSON.stringify(incident)
            };

            if (existing) {
              if (existing.status !== incidentData.status) {
                await base44.asServiceRole.entities.RocketCyberIncident.update(existing.id, incidentData);
                totalSynced++;
              }
            } else {
              await base44.asServiceRole.entities.RocketCyberIncident.create(incidentData);
              totalSynced++;
            }
          }

          await base44.asServiceRole.entities.RocketCyberMapping.update(mapping.id, {
            last_synced: new Date().toISOString()
          });

        } catch (err) {
          console.error(`Error syncing account ${mapping.rocketcyber_account_id}:`, err.message);
          errors.push({ account: mapping.rocketcyber_account_name, error: err.message });
        }
      }

      return Response.json({
        success: true,
        recordsSynced: totalSynced,
        errors: errors.length > 0 ? errors : undefined
      });
    }

    // Action: Get summary/stats for a customer
    if (action === 'get_summary') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      const incidents = await base44.asServiceRole.entities.RocketCyberIncident.filter({ customer_id });
      
      const summary = {
        totalIncidents: incidents.length,
        openIncidents: incidents.filter(i => i.status === 'open' || i.status === 'investigating').length,
        resolvedIncidents: incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length,
        bySeverity: {
          critical: incidents.filter(i => i.severity === 'critical').length,
          high: incidents.filter(i => i.severity === 'high').length,
          medium: incidents.filter(i => i.severity === 'medium').length,
          low: incidents.filter(i => i.severity === 'low').length,
          informational: incidents.filter(i => i.severity === 'informational').length
        },
        recentIncidents: incidents
          .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at))
          .slice(0, 10)
      };

      return Response.json({ success: true, summary });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('RocketCyber sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});