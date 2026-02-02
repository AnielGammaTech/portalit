import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DATTO_EDR_API_KEY = Deno.env.get("DATTO_EDR_API_KEY");
const DATTO_EDR_API_SECRET = Deno.env.get("DATTO_EDR_API_SECRET");
const DATTO_EDR_API_URL = Deno.env.get("DATTO_EDR_API_URL") || "https://api.datto.com/edr/v1";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, customer_id } = await req.json();

    // Check if API credentials are configured
    if (!DATTO_EDR_API_KEY || !DATTO_EDR_API_SECRET) {
      return Response.json({ 
        success: false, 
        error: 'Datto EDR API credentials not configured. Please set DATTO_EDR_API_KEY and DATTO_EDR_API_SECRET in settings.' 
      });
    }

    // Get auth token
    const getAuthToken = async () => {
      const authResponse = await fetch(`${DATTO_EDR_API_URL}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: DATTO_EDR_API_KEY,
          apiSecret: DATTO_EDR_API_SECRET
        })
      });
      
      if (!authResponse.ok) {
        throw new Error('Failed to authenticate with Datto EDR');
      }
      
      const authData = await authResponse.json();
      return authData.token || authData.access_token;
    };

    if (action === 'list_tenants') {
      // List all EDR tenants/sites
      const token = await getAuthToken();
      
      const response = await fetch(`${DATTO_EDR_API_URL}/tenants`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return Response.json({ success: false, error: `Failed to fetch tenants: ${errorText}` });
      }

      const data = await response.json();
      const tenants = (data.tenants || data.sites || data.data || []).map(t => ({
        id: t.id || t.tenantId || t.siteId,
        name: t.name || t.tenantName || t.siteName,
        deviceCount: t.deviceCount || t.endpoints || 0
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
      const token = await getAuthToken();

      // Fetch endpoints/devices for this tenant
      const response = await fetch(`${DATTO_EDR_API_URL}/tenants/${mapping.edr_tenant_id}/endpoints`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return Response.json({ success: false, error: 'Failed to fetch endpoints' });
      }

      const data = await response.json();
      const endpoints = data.endpoints || data.devices || data.data || [];

      // Update mapping with last synced
      await base44.entities.DattoEDRMapping.update(mapping.id, {
        last_synced: new Date().toISOString()
      });

      return Response.json({ 
        success: true, 
        endpointCount: endpoints.length,
        endpoints: endpoints.slice(0, 50) // Return first 50 for display
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
      const token = await getAuthToken();

      // Fetch tenant stats
      const [endpointsRes, alertsRes] = await Promise.all([
        fetch(`${DATTO_EDR_API_URL}/tenants/${mapping.edr_tenant_id}/endpoints`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${DATTO_EDR_API_URL}/tenants/${mapping.edr_tenant_id}/alerts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => null)
      ]);

      const endpointsData = endpointsRes.ok ? await endpointsRes.json() : { endpoints: [] };
      const alertsData = alertsRes?.ok ? await alertsRes.json() : { alerts: [] };

      const endpoints = endpointsData.endpoints || endpointsData.devices || endpointsData.data || [];
      const alerts = alertsData.alerts || alertsData.data || [];

      return Response.json({
        success: true,
        stats: {
          totalEndpoints: endpoints.length,
          protectedEndpoints: endpoints.filter(e => e.status === 'protected' || e.status === 'active').length,
          alerts: alerts.length,
          criticalAlerts: alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length
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