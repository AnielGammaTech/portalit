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
      // List all EDR organizations/targets - use embedded stats from targets endpoint
      const targetsRes = await fetch(addAuth(`${DATTO_EDR_BASE_URL}/targets`), { headers });

      if (!targetsRes.ok) {
        const errorText = await targetsRes.text();
        console.error('EDR API error:', errorText);
        return Response.json({ success: false, error: `Failed to fetch tenants: ${targetsRes.status}` });
      }

      const data = await targetsRes.json();
      
      // Infocyte returns targets (organizations) with embedded agent counts
      const targetsArray = data.data || data.targets || data || [];
      const tenants = targetsArray.map(t => ({
        id: t.id || t.targetId,
        name: t.name || t.organizationName || t.targetName,
        deviceCount: t.agentCount || t.hostCount || t.endpointCount || 0,
        activeCount: t.activeAgentCount || 0,
        alertCount: parseInt(t.alertCount) || 0
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

      console.log('Target ID:', targetId);
      
      // Fetch target details 
      const targetUrl = addAuth(`${DATTO_EDR_BASE_URL}/targets/${targetId}`);
      const targetRes = await fetch(targetUrl, { headers }).catch(e => null);
      
      let targetData = null;
      if (targetRes?.ok) {
        const raw = await targetRes.text();
        try { targetData = JSON.parse(raw); } catch(e) { console.log('Target parse err:', e); }
      }
      
      // Fetch agents - the API uses /api/agents endpoint and agents have locationId field
      // The target ID might map to locationId in the agents table
      const agentsUrl = addAuth(`${DATTO_EDR_BASE_URL}/agents`);
      const agentsRes = await fetch(agentsUrl, { headers }).catch(() => null);
      
      let allAgents = [];
      if (agentsRes?.ok) {
        const raw = await agentsRes.text();
        try { 
          allAgents = JSON.parse(raw);
          if (!Array.isArray(allAgents)) {
            allAgents = allAgents?.data || [];
          }
        } catch(e) {}
      }
      
      // Filter agents by locationId matching targetId
      let hosts = allAgents.filter(a => a.locationId === targetId);
      console.log(`Found ${hosts.length} agents with locationId=${targetId} out of ${allAgents.length} total`);
      
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
      const activeHosts = hosts.filter(h => h.active === true);
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
            hostname: h.hostname || h.name,
            ip: h.ip || h.ipstring,
            os: h.os,
            online: h.active === true,
            lastSeen: h.heartbeat
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

    if (action === 'get_reports') {
      // Fetch reports from Datto EDR API
      if (!customer_id) {
        return Response.json({ success: false, error: 'customer_id required' });
      }

      const mappings = await base44.entities.DattoEDRMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ success: false, error: 'Customer not mapped to EDR tenant' });
      }

      const mapping = mappings[0];
      const targetId = mapping.edr_tenant_id;

      // Fetch reports for this target
      const reportsUrl = addAuth(`${DATTO_EDR_BASE_URL}/Reports`);
      const reportsRes = await fetch(reportsUrl, { headers });
      
      if (!reportsRes.ok) {
        return Response.json({ success: false, error: `Failed to fetch reports: ${reportsRes.status}` });
      }

      const allReports = await reportsRes.json();
      const reportsArray = Array.isArray(allReports) ? allReports : allReports?.data || [];
      
      // Filter reports for this target/location
      const targetReports = reportsArray.filter(r => r.targetId === targetId || r.locationId === targetId);
      
      console.log(`Found ${targetReports.length} reports for target ${targetId} out of ${reportsArray.length} total`);

      return Response.json({ 
        success: true, 
        reports: targetReports,
        allReports: reportsArray.slice(0, 5) // Sample for debugging
      });
    }

    if (action === 'generate_report') {
      // Create a new report via POST /api/Reports
      if (!customer_id) {
        return Response.json({ success: false, error: 'customer_id required' });
      }

      const mappings = await base44.entities.DattoEDRMapping.filter({ customer_id });
      if (mappings.length === 0) {
        return Response.json({ success: false, error: 'Customer not mapped to EDR tenant' });
      }

      const mapping = mappings[0];
      const targetId = mapping.edr_tenant_id;

      const { report_type, start_date, end_date } = await req.json().catch(() => ({}));

      // Create report request
      const reportPayload = {
        targetId: targetId,
        type: report_type || 'summary',
        startDate: start_date,
        endDate: end_date
      };

      const createRes = await fetch(addAuth(`${DATTO_EDR_BASE_URL}/Reports`), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(reportPayload)
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.log('Report creation error:', errText);
        return Response.json({ success: false, error: `Failed to create report: ${createRes.status}` });
      }

      const report = await createRes.json();
      return Response.json({ success: true, report });
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