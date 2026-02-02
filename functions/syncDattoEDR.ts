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
      // Sync a specific customer - get full EDR report data
      if (!customer_id) {
        return Response.json({ success: false, error: 'customer_id required' });
      }

      const mappings = await base44.entities.DattoEDRMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ success: false, error: 'Customer not mapped to EDR tenant' });
      }

      const mapping = mappings[0];
      const targetId = mapping.edr_tenant_id;

      // Infocyte/Datto EDR API - try different endpoint patterns
      // The API may use different endpoint naming
      const hostsUrl1 = addAuth(`${DATTO_EDR_BASE_URL}/targets/${targetId}/hosts`);
      const hostsUrl2 = addAuth(`${DATTO_EDR_BASE_URL}/hosts?targetId=${targetId}`);
      const alertsUrl1 = addAuth(`${DATTO_EDR_BASE_URL}/AlertInboxItems`);
      const alertsUrl2 = addAuth(`${DATTO_EDR_BASE_URL}/alerts`);
      const scansUrl = addAuth(`${DATTO_EDR_BASE_URL}/scans`);
      const endpointsUrl = addAuth(`${DATTO_EDR_BASE_URL}/endpoints?targetId=${targetId}`);
      
      console.log('Target ID:', targetId);
      console.log('Trying hosts endpoint 1...');
      
      // Try multiple endpoint patterns to find the right one
      let hostsRes = await fetch(hostsUrl1, { headers }).catch(e => null);
      console.log('Hosts endpoint 1 status:', hostsRes?.status);
      
      if (!hostsRes?.ok) {
        console.log('Trying hosts endpoint 2...');
        hostsRes = await fetch(hostsUrl2, { headers }).catch(e => null);
        console.log('Hosts endpoint 2 status:', hostsRes?.status);
      }
      
      if (!hostsRes?.ok) {
        console.log('Trying endpoints endpoint...');
        hostsRes = await fetch(endpointsUrl, { headers }).catch(e => null);
        console.log('Endpoints status:', hostsRes?.status);
      }

      let alertsRes = await fetch(alertsUrl1, { headers }).catch(e => null);
      console.log('Alerts endpoint 1 status:', alertsRes?.status);
      
      if (!alertsRes?.ok) {
        alertsRes = await fetch(alertsUrl2, { headers }).catch(e => null);
        console.log('Alerts endpoint 2 status:', alertsRes?.status);
      }
      
      const scansRes = await fetch(scansUrl, { headers }).catch(e => null);
      console.log('Scans status:', scansRes?.status);
      
      let hostsData = [];
      let alertsData = [];
      let scansData = [];
      
      if (hostsRes?.ok) {
        const raw = await hostsRes.text();
        console.log('Hosts raw response length:', raw.length);
        console.log('Hosts raw response preview:', raw.slice(0, 1500));
        try { hostsData = JSON.parse(raw); } catch(e) { console.log('Hosts parse error:', e); }
      } else if (hostsRes) {
        console.log('Hosts error response:', await hostsRes.text().catch(() => 'no body'));
      }
      
      if (alertsRes?.ok) {
        const raw = await alertsRes.text();
        console.log('Alerts raw response length:', raw.length);
        console.log('Alerts raw response preview:', raw.slice(0, 1000));
        try { alertsData = JSON.parse(raw); } catch(e) { console.log('Alerts parse error:', e); }
      } else if (alertsRes) {
        console.log('Alerts error response:', await alertsRes.text().catch(() => 'no body'));
      }
      
      if (scansRes?.ok) {
        const raw = await scansRes.text();
        console.log('Scans raw response length:', raw.length);
        try { scansData = JSON.parse(raw); } catch(e) {}
      }

      // Extract arrays from response (Infocyte may return {data: [...]} or just [...])
      const hosts = Array.isArray(hostsData) ? hostsData : hostsData?.data || hostsData?.hosts || hostsData?.endpoints || [];
      const allAlerts = Array.isArray(alertsData) ? alertsData : alertsData?.data || alertsData?.alerts || [];
      // Filter alerts for this target
      const alerts = allAlerts.filter(a => a.targetId === targetId);
      const scans = Array.isArray(scansData) ? scansData : scansData?.data || [];
      const flaggedItems = [];

      // Count alerts by severity
      const criticalAlerts = alerts.filter(a => a.threatScore >= 7 || a.severity === 'critical' || a.severity === 'high').length;
      const mediumAlerts = alerts.filter(a => (a.threatScore >= 4 && a.threatScore < 7) || a.severity === 'medium').length;
      const lowAlerts = alerts.filter(a => (a.threatScore < 4 && a.threatScore > 0) || a.severity === 'low').length;

      // Update mapping with last synced
      await base44.entities.DattoEDRMapping.update(mapping.id, {
        last_synced: new Date().toISOString()
      });

      return Response.json({ 
        success: true, 
        data: {
          hostCount: hosts.length,
          hosts: hosts.slice(0, 50).map(h => ({
            id: h.id,
            hostname: h.hostname || h.name,
            ip: h.ip || h.ipAddress,
            os: h.os || h.operatingSystem,
            online: h.online || h.connectionStatus === 'connected',
            lastSeen: h.lastSeen || h.updatedOn
          })),
          alertCount: alerts.length,
          alerts: alerts.slice(0, 20).map(a => ({
            id: a.id,
            name: a.name || a.type || a.title,
            severity: a.severity || (a.threatScore >= 7 ? 'critical' : a.threatScore >= 4 ? 'medium' : 'low'),
            threatScore: a.threatScore,
            hostname: a.hostname,
            createdOn: a.createdOn || a.created_date,
            status: a.status
          })),
          criticalAlerts,
          mediumAlerts, 
          lowAlerts,
          flaggedItemCount: flaggedItems.length,
          flaggedItems: flaggedItems.slice(0, 20).map(f => ({
            id: f.id,
            name: f.name || f.friendlyName || f.sha256?.slice(0, 12),
            type: f.type || f.flagType,
            hostname: f.hostname,
            flagName: f.flagName,
            createdOn: f.createdOn
          })),
          recentScans: scans.slice(0, 5).map(s => ({
            id: s.id,
            type: s.type || s.scanType,
            status: s.status,
            createdOn: s.createdOn,
            completedOn: s.completedOn
          })),
          debug: {
            hostsFound: hosts.length,
            alertsTotal: allAlerts.length,
            alertsForTarget: alerts.length,
            flaggedFound: flaggedItems.length,
            scansFound: scans.length
          }
        }
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