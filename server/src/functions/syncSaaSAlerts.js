import { getServiceSupabase } from '../lib/supabase.js';

// SaaS Alerts production API — Google Cloud Function (from official Swagger spec)
const SAAS_ALERTS_BASE = 'https://us-central1-the-byway-248217.cloudfunctions.net/reportApi/api/v1';

async function saasAlertsApiCall(endpoint, { method = 'GET', body } = {}) {
  const apiKey = process.env.SAAS_ALERTS_API_KEY;
  if (!apiKey) throw new Error('SaaS Alerts API key not configured');

  const options = {
    method,
    headers: {
      'api_key': apiKey,              // SaaS Alerts uses api_key header (NOT Bearer)
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  if (body) options.body = JSON.stringify(body);

  const url = `${SAAS_ALERTS_BASE}${endpoint}`;
  console.log(`[SaaSAlerts] ${method} ${url}`);

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SaaS Alerts API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

function categorizeSeverity(events) {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  for (const event of events) {
    const severity = (event.severity || event.alert_severity || '').toLowerCase();
    if (severity === 'critical') summary.critical++;
    else if (severity === 'high') summary.high++;
    else if (severity === 'medium') summary.medium++;
    else if (severity === 'low') summary.low++;
    else summary.info++;
  }

  return summary;
}

function formatEvent(event) {
  return {
    id: event.id || event.event_id || null,
    timestamp: event.timestamp || event.created_at || event.date || null,
    user: event.user || event.user_email || event.username || 'Unknown',
    event_type: event.event_type || event.type || event.alert_type || 'Unknown',
    description: event.description || event.message || event.details || '',
    severity: event.severity || event.alert_severity || 'info',
    product: event.product || event.application || event.app_name || 'Unknown',
    ip_address: event.ip_address || event.source_ip || null,
    country: event.country || event.location || null
  };
}

export async function syncSaaSAlerts(body, _user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;

  // Test connection
  if (action === 'test_connection') {
    try {
      // Use the /customers endpoint (from Swagger spec)
      const data = await saasAlertsApiCall('/customers');
      const customers = Array.isArray(data) ? data : (data.customers || data.tenants || data.data || []);
      return {
        success: true,
        message: `Connected! Found ${customers.length} customers.`,
        totalCustomers: customers.length
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // List SaaS Alerts customers/tenants for mapping
  if (action === 'list_customers') {
    try {
      const data = await saasAlertsApiCall('/customers');
      const customers = Array.isArray(data) ? data : (data.customers || data.tenants || data.data || []);

      return {
        success: true,
        customers: customers.map(c => ({
          id: c.id || c.customer_id || c.tenant_id || c._id,
          name: c.name || c.customer_name || c.tenant_name || c.customerName || 'Unknown',
          email: c.email || c.admin_email || c.adminEmail || '',
          status: c.status || 'active'
        }))
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Get cached data
  if (action === 'get_cached') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: mappings } = await supabase
      .from('saas_alerts_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      return { success: false, error: 'No SaaS Alerts mapping found' };
    }

    const mapping = mappings[0];
    if (mapping.cached_data) {
      return {
        success: true,
        cached: true,
        last_synced: mapping.last_synced,
        ...mapping.cached_data
      };
    }

    return {
      success: true,
      cached: true,
      last_synced: mapping.last_synced,
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      recent_events: [],
      message: 'No cached data available. Click Sync to fetch data.'
    };
  }

  // Sync alerts for a specific customer
  if (action === 'sync_alerts') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: mappings } = await supabase
      .from('saas_alerts_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      const err = new Error('No SaaS Alerts mapping found for this customer');
      err.statusCode = 400;
      throw err;
    }

    const mapping = mappings[0];

    try {
      // Query events for this customer (last 7 days)
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      let events = [];
      try {
        // Use /reports/events/query POST endpoint (from Swagger spec)
        const eventsData = await saasAlertsApiCall('/reports/events/query', {
          method: 'POST',
          body: {
            customerId: mapping.saas_alerts_customer_id,
            start: sevenDaysAgo.toISOString(),
            end: now.toISOString(),
            size: 500,
            timeSort: 'desc'
          }
        });
        events = Array.isArray(eventsData)
          ? eventsData
          : (eventsData.events || eventsData.data || eventsData.results || eventsData.hits || []);
      } catch (queryErr) {
        console.error('[SaaSAlerts] POST /reports/events/query failed:', queryErr.message);
        // Fallback: try GET /reports/events endpoint
        try {
          const fallbackData = await saasAlertsApiCall(
            `/reports/events?customerId=${mapping.saas_alerts_customer_id}&start=${sevenDaysAgo.toISOString()}&end=${now.toISOString()}&size=500&timeSort=desc`
          );
          events = Array.isArray(fallbackData)
            ? fallbackData
            : (fallbackData.events || fallbackData.data || fallbackData.hits || []);
        } catch (fallbackErr) {
          console.error('[SaaSAlerts] GET /reports/events also failed:', fallbackErr.message);
          events = [];
        }
      }

      const summary = categorizeSeverity(events);
      const recentEvents = events
        .sort((a, b) => new Date(b.timestamp || b.date || 0) - new Date(a.timestamp || a.date || 0))
        .slice(0, 100)
        .map(formatEvent);

      // Detect monitored apps from events
      const monitoredApps = [...new Set(events.map(e =>
        e.product || e.application || e.app_name
      ).filter(Boolean))];

      const cacheData = {
        success: true,
        summary,
        total_events: events.length,
        recent_events: recentEvents,
        monitored_apps: monitoredApps,
        period: '7 days'
      };

      // Save to mapping (raw object, not stringified — JSONB column)
      await supabase
        .from('saas_alerts_mappings')
        .update({
          cached_data: cacheData,
          last_synced: new Date().toISOString()
        })
        .eq('id', mapping.id);

      return cacheData;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Sync all mapped customers
  if (action === 'sync_all') {
    const { data: allMappings } = await supabase
      .from('saas_alerts_mappings')
      .select('*');

    let synced = 0;
    let errors = 0;

    for (const mapping of (allMappings || [])) {
      try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        let events = [];
        try {
          const eventsData = await saasAlertsApiCall('/reports/events/query', {
            method: 'POST',
            body: {
              customerId: mapping.saas_alerts_customer_id,
              start: sevenDaysAgo.toISOString(),
              end: now.toISOString(),
              size: 500,
              timeSort: 'desc'
            }
          });
          events = Array.isArray(eventsData)
            ? eventsData
            : (eventsData.events || eventsData.data || eventsData.results || eventsData.hits || []);
        } catch {
          events = [];
        }

        const summary = categorizeSeverity(events);
        const recentEvents = events
          .sort((a, b) => new Date(b.timestamp || b.date || 0) - new Date(a.timestamp || a.date || 0))
          .slice(0, 100)
          .map(formatEvent);

        const monitoredApps = [...new Set(events.map(e =>
          e.product || e.application || e.app_name
        ).filter(Boolean))];

        const cacheData = {
          success: true,
          summary,
          total_events: events.length,
          recent_events: recentEvents,
          monitored_apps: monitoredApps,
          period: '7 days'
        };

        await supabase
          .from('saas_alerts_mappings')
          .update({
            cached_data: cacheData,
            last_synced: new Date().toISOString()
          })
          .eq('id', mapping.id);

        synced++;
      } catch (e) {
        console.error(`[SaaSAlerts] Failed to sync mapping ${mapping.id}:`, e.message);
        errors++;
      }
    }

    return { success: true, synced, errors };
  }

  const err = new Error('Invalid action');
  err.statusCode = 400;
  throw err;
}
