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
      console.log('Targets raw response sample:', JSON.stringify(data).slice(0, 2000));
      
      // Infocyte returns targets (organizations)
      const targetsArray = data.data || data.targets || data || [];
      const tenants = targetsArray.map(t => ({
        id: t.id || t.targetId,
        name: t.name || t.organizationName || t.targetName,
        deviceCount: t.hostCount || t.endpointCount || 0
      }));

      return Response.json({ success: true, tenants, rawSample: targetsArray.slice(0, 2) });
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

      // Infocyte/Datto EDR API - use Loopback filter syntax
      // Hosts are queried via /hosts with targetId filter in Loopback format
      console.log('Target ID:', targetId);
      
      const hostsFilter = JSON.stringify({ where: { targetId: targetId } });
      const hostsUrl = addAuth(`${DATTO_EDR_BASE_URL}/hosts?filter=${encodeURIComponent(hostsFilter)}`);
      const alertsFilter = JSON.stringify({ where: { targetId: targetId } });
      const alertsUrl = addAuth(`${DATTO_EDR_BASE_URL}/AlertInboxItems?filter=${encodeURIComponent(alertsFilter)}`);
      const scansFilter = JSON.stringify({ where: { targetId: targetId }, limit: 20 });
      const scansUrl = addAuth(`${DATTO_EDR_BASE_URL}/scans?filter=${encodeURIComponent(scansFilter)}`);
      
      console.log('Hosts URL pattern:', hostsUrl.replace(DATTO_EDR_API_TOKEN, '***'));
      
      const [hostsRes, alertsRes, scansRes] = await Promise.all([
        fetch(hostsUrl, { headers }).catch(e => { console.log('Hosts error:', e); return null; }),
        fetch(alertsUrl, { headers }).catch(e => { console.log('Alerts error:', e); return null; }),
        fetch(scansUrl, { headers }).catch(e => { console.log('Scans error:', e); return null; })
      ]);
      
      console.log('Hosts status:', hostsRes?.status);
      console.log('Alerts status:', alertsRes?.status);
      console.log('Scans status:', scansRes?.status);
      
      let hostsData = [];
      let alertsData = [];
      let scansData = [];
      
      if (hostsRes?.ok) {
        const raw = await hostsRes.text();
        console.log('Hosts response length:', raw.length);
        console.log('Hosts sample:', raw.slice(0, 1500));
        try { hostsData = JSON.parse(raw); } catch(e) { console.log('Parse err:', e); }
      } else if (hostsRes) {
        const errText = await hostsRes.text().catch(() => '');
        console.log('Hosts error body:', errText.slice(0, 500));
      }
      
      if (alertsRes?.ok) {
        const raw = await alertsRes.text();
        console.log('Alerts response length:', raw.length);
        console.log('Alerts sample:', raw.slice(0, 1000));
        try { alertsData = JSON.parse(raw); } catch(e) { console.log('Parse err:', e); }
      } else if (alertsRes) {
        const errText = await alertsRes.text().catch(() => '');
        console.log('Alerts error body:', errText.slice(0, 500));
      }
      
      if (scansRes?.ok) {
        const raw = await scansRes.text();
        console.log('Scans response length:', raw.length);
        try { scansData = JSON.parse(raw); } catch(e) {}
      }

      // Extract arrays from response
      const hosts = Array.isArray(hostsData) ? hostsData : hostsData?.data || hostsData?.hosts || [];
      const alerts = Array.isArray(alertsData) ? alertsData : alertsData?.data || alertsData?.alerts || [];
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
            alertsFound: alerts.length,
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