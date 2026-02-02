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
      // List all EDR organizations/targets with their host counts
      const [targetsRes, hostsRes] = await Promise.all([
        fetch(addAuth(`${DATTO_EDR_BASE_URL}/targets`), { headers }),
        fetch(addAuth(`${DATTO_EDR_BASE_URL}/hosts`), { headers }).catch(() => null)
      ]);

      if (!targetsRes.ok) {
        const errorText = await targetsRes.text();
        console.error('EDR API error:', errorText);
        return Response.json({ success: false, error: `Failed to fetch tenants: ${targetsRes.status}` });
      }

      const data = await targetsRes.json();
      const hostsData = hostsRes?.ok ? await hostsRes.json() : [];
      const allHosts = Array.isArray(hostsData) ? hostsData : hostsData?.data || [];
      
      console.log('Total hosts in system:', allHosts.length);
      console.log('Sample host:', JSON.stringify(allHosts[0] || {}).slice(0, 500));
      
      // Count hosts per target
      const hostCountByTarget = {};
      for (const host of allHosts) {
        const tid = host.targetId;
        if (tid) {
          hostCountByTarget[tid] = (hostCountByTarget[tid] || 0) + 1;
        }
      }
      
      // Infocyte returns targets (organizations)
      const targetsArray = data.data || data.targets || data || [];
      const tenants = targetsArray.map(t => ({
        id: t.id || t.targetId,
        name: t.name || t.organizationName || t.targetName,
        deviceCount: hostCountByTarget[t.id || t.targetId] || t.hostCount || t.endpointCount || 0
      }));

      return Response.json({ success: true, tenants, totalHosts: allHosts.length });
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

      // Infocyte/Datto EDR API - Get target details which contains agent counts
      // Also fetch the hosts via the targets/{id} endpoint relation
      console.log('Target ID:', targetId);
      
      // First get target details - this has agentCount, alertCount embedded
      const targetUrl = addAuth(`${DATTO_EDR_BASE_URL}/targets/${targetId}`);
      // Try to get hosts via target relation endpoint pattern
      const hostsUrl = addAuth(`${DATTO_EDR_BASE_URL}/targets/${targetId}/hosts`);
      
      console.log('Fetching target details and hosts...');
      
      const [targetRes, hostsRes] = await Promise.all([
        fetch(targetUrl, { headers }).catch(e => null),
        fetch(hostsUrl, { headers }).catch(e => null)
      ]);
      
      console.log('Target details status:', targetRes?.status);
      console.log('Hosts relation status:', hostsRes?.status);
      
      let targetData = null;
      let hostsData = [];
      
      if (targetRes?.ok) {
        const raw = await targetRes.text();
        console.log('Target details:', raw.slice(0, 1500));
        try { targetData = JSON.parse(raw); } catch(e) { console.log('Parse err:', e); }
      } else if (targetRes) {
        console.log('Target error:', await targetRes.text().catch(() => ''));
      }
      
      if (hostsRes?.ok) {
        const raw = await hostsRes.text();
        console.log('Hosts response length:', raw.length);
        console.log('Hosts sample:', raw.slice(0, 1500));
        try { hostsData = JSON.parse(raw); } catch(e) { console.log('Parse err:', e); }
      } else if (hostsRes) {
        console.log('Hosts error:', await hostsRes.text().catch(() => ''));
      }

      // Extract arrays from response
      const hosts = Array.isArray(hostsData) ? hostsData : hostsData?.data || hostsData?.hosts || [];
      // Get stats from target object if hosts list is empty
      const alerts = [];
      const scans = [];
      const flaggedItems = [];
      
      // Use target-level stats when detailed host list not available
      const targetStats = targetData ? {
        agentCount: targetData.agentCount || 0,
        activeAgentCount: targetData.activeAgentCount || 0,
        alertCount: parseInt(targetData.alertCount) || 0,
        totalAddressCount: targetData.totalAddressCount || 0,
        lastScannedOn: targetData.lastScannedOn
      } : null;
      
      console.log('Target stats:', JSON.stringify(targetStats));

      // Use target stats for counts, with host details if available
      const hostCount = hosts.length || targetStats?.agentCount || 0;
      const activeCount = targetStats?.activeAgentCount || hosts.filter(h => h.online || h.connectionStatus === 'connected').length;
      const alertCount = targetStats?.alertCount || 0;
      
      // Update mapping with last synced
      await base44.entities.DattoEDRMapping.update(mapping.id, {
        last_synced: new Date().toISOString()
      });

      return Response.json({ 
        success: true, 
        data: {
          hostCount: hostCount,
          activeHostCount: activeCount,
          hosts: hosts.slice(0, 50).map(h => ({
            id: h.id,
            hostname: h.hostname || h.name,
            ip: h.ip || h.ipAddress,
            os: h.os || h.operatingSystem,
            online: h.online || h.connectionStatus === 'connected',
            lastSeen: h.lastSeen || h.updatedOn
          })),
          alertCount: alertCount,
          alerts: alerts.slice(0, 20).map(a => ({
            id: a.id,
            name: a.name || a.type || a.title,
            severity: a.severity || (a.threatScore >= 7 ? 'critical' : a.threatScore >= 4 ? 'medium' : 'low'),
            threatScore: a.threatScore,
            hostname: a.hostname,
            createdOn: a.createdOn || a.created_date,
            status: a.status
          })),
          criticalAlerts: 0,
          mediumAlerts: 0, 
          lowAlerts: 0,
          lastScannedOn: targetStats?.lastScannedOn,
          targetStats
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