import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DATTO_EDR_API_TOKEN = Deno.env.get("DATTO_EDR_API_TOKEN");
const DATTO_EDR_BASE_URL = "https://rmmcon69c80001.infocyte.com/api";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, customer_id } = await req.json();

    // Check if API token is configured
    if (!DATTO_EDR_API_TOKEN) {
      return Response.json({ 
        success: false, 
        error: 'Datto EDR API token not configured. Please set DATTO_EDR_API_TOKEN in settings.' 
      });
    }

    // Datto EDR uses accessToken as query parameter or in Authorization header
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Helper to add auth to URL
    const addAuth = (url) => {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}access_token=${DATTO_EDR_API_TOKEN}`;
    };

    if (action === 'list_tenants') {
      // List all EDR organizations/targets
      const response = await fetch(addAuth(`${DATTO_EDR_BASE_URL}/targets`), { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('EDR API error:', errorText);
        return Response.json({ success: false, error: `Failed to fetch tenants: ${response.status}` });
      }

      const data = await response.json();
      // Infocyte returns targets (organizations)
      const tenants = (data.data || data.targets || data || []).map(t => ({
        id: t.id || t.targetId,
        name: t.name || t.organizationName || t.targetName,
        deviceCount: t.hostCount || t.endpointCount || 0
      }));

      return Response.json({ success: true, tenants });
    }

    if (action === 'sync_customer') {
      // Sync a specific customer
      if (!customer_id) {
        return Response.json({ success: false, error: 'customer_id required' });
      }

      const mappings = await base44.entities.DattoEDRMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ success: false, error: 'Customer not mapped to EDR tenant' });
      }

      const mapping = mappings[0];

      // Fetch hosts/endpoints for this target
      const response = await fetch(addAuth(`${DATTO_EDR_BASE_URL}/targets/${mapping.edr_tenant_id}/hosts`), { headers });

      if (!response.ok) {
        return Response.json({ success: false, error: 'Failed to fetch endpoints' });
      }

      const data = await response.json();
      const endpoints = data.data || data.hosts || data || [];

      // Update mapping with last synced
      await base44.entities.DattoEDRMapping.update(mapping.id, {
        last_synced: new Date().toISOString()
      });

      return Response.json({ 
        success: true, 
        endpointCount: endpoints.length,
        endpoints: endpoints.slice(0, 50)
      });
    }

    if (action === 'sync_all') {
      // Sync all mapped customers
      const allMappings = await base44.entities.DattoEDRMapping.list();
      let synced = 0;

      for (const mapping of allMappings) {
        try {
          await base44.entities.DattoEDRMapping.update(mapping.id, {
            last_synced: new Date().toISOString()
          });
          synced++;
        } catch (e) {
          console.error(`Failed to sync ${mapping.customer_name}:`, e);
        }
      }

      return Response.json({ success: true, synced });
    }

    if (action === 'get_tenant_stats') {
      // Get stats for a specific tenant
      if (!customer_id) {
        return Response.json({ success: false, error: 'customer_id required' });
      }

      const mappings = await base44.entities.DattoEDRMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ success: false, error: 'Customer not mapped' });
      }

      const mapping = mappings[0];

      // Fetch tenant stats from Infocyte
      const [hostsRes, alertsRes] = await Promise.all([
        fetch(addAuth(`${DATTO_EDR_BASE_URL}/targets/${mapping.edr_tenant_id}/hosts`), { headers }),
        fetch(addAuth(`${DATTO_EDR_BASE_URL}/targets/${mapping.edr_tenant_id}/alerts`), { headers }).catch(() => null)
      ]);

      const hostsData = hostsRes.ok ? await hostsRes.json() : { data: [] };
      const alertsData = alertsRes?.ok ? await alertsRes.json() : { data: [] };

      const endpoints = hostsData.data || hostsData.hosts || [];
      const alerts = alertsData.data || alertsData.alerts || [];

      return Response.json({
        success: true,
        stats: {
          totalEndpoints: endpoints.length,
          protectedEndpoints: endpoints.filter(e => e.status === 'online' || e.agentStatus === 'active').length,
          alerts: alerts.length,
          criticalAlerts: alerts.filter(a => a.severity === 'critical' || a.severity === 'high' || a.threatScore >= 7).length
        },
        endpoints: endpoints.slice(0, 20),
        alerts: alerts.slice(0, 10)
      });
    }

    return Response.json({ success: false, error: 'Invalid action' });

  } catch (error) {
    console.error('Datto EDR sync error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});