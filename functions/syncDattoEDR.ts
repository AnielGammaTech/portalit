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

      console.log('Target ID:', targetId);
      
      // Fetch target details AND all hosts from global endpoint
      const targetUrl = addAuth(`${DATTO_EDR_BASE_URL}/targets/${targetId}`);
      const allHostsUrl = addAuth(`${DATTO_EDR_BASE_URL}/hosts?filter[targetId]=${targetId}`);
      
      console.log('Fetching hosts URL:', allHostsUrl.replace(DATTO_EDR_API_TOKEN, '***'));
      
      const [targetRes, allHostsRes] = await Promise.all([
        fetch(targetUrl, { headers }).catch(e => null),
        fetch(allHostsUrl, { headers }).catch(e => null)
      ]);
      
      let targetData = null;
      let allHostsData = [];
      
      if (targetRes?.ok) {
        const raw = await targetRes.text();
        try { targetData = JSON.parse(raw); } catch(e) { console.log('Target parse err:', e); }
      }
      
      console.log('All hosts response status:', allHostsRes?.status);
      
      if (allHostsRes?.ok) {
        const raw = await allHostsRes.text();
        console.log('Hosts response sample:', raw.slice(0, 2000));
        try { 
          const parsed = JSON.parse(raw);
          allHostsData = Array.isArray(parsed) ? parsed : parsed?.data || parsed?.hosts || [];
        } catch(e) { console.log('Hosts parse err:', e); }
      } else if (allHostsRes) {
        console.log('Hosts error:', await allHostsRes.text().catch(() => ''));
      }
      
      // Filter hosts for this specific target if needed
      const hosts = allHostsData.filter(h => !h.targetId || h.targetId === targetId);
      console.log(`Found ${hosts.length} hosts for target ${targetId}`);
      
      // Use target-level stats
      const targetStats = targetData ? {
        agentCount: targetData.agentCount || 0,
        activeAgentCount: targetData.activeAgentCount || 0,
        alertCount: parseInt(targetData.alertCount) || 0,
        totalAddressCount: targetData.totalAddressCount || 0,
        lastScannedOn: targetData.lastScannedOn
      } : null;

      // Use actual hosts list if available, otherwise fall back to target stats
      const hostCount = hosts.length || targetStats?.agentCount || 0;
      const activeHosts = hosts.filter(h => h.online || h.connectionStatus === 'connected' || h.agentStatus === 'Active');
      const activeCount = activeHosts.length || targetStats?.activeAgentCount || 0;
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
          hosts: hosts.slice(0, 100).map(h => ({
            id: h.id,
            hostname: h.hostname || h.name || h.computerName,
            ip: h.ip || h.ipAddress || h.managementIp,
            os: h.os || h.operatingSystem || h.osVersion,
            online: h.online || h.connectionStatus === 'connected' || h.agentStatus === 'Active',
            lastSeen: h.lastSeen || h.updatedOn || h.lastConnected
          })),
          alertCount: alertCount,
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