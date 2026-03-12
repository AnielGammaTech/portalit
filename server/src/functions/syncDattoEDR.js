import { getServiceSupabase } from '../lib/supabase.js';

const DATTO_EDR_API_TOKEN = process.env.DATTO_EDR_API_TOKEN;
const DATTO_EDR_BASE_URL = "https://rmmcon69c80001.infocyte.com/api";

export async function syncDattoEDR(body, user) {
  const supabase = getServiceSupabase();

  const { action, customer_id, report_name, report_type, start_date, end_date } = body;

  // Check if API token is configured
  if (!DATTO_EDR_API_TOKEN) {
    return {
      success: false,
      error: 'Datto EDR API token not configured. Please set DATTO_EDR_API_TOKEN in settings.'
    };
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

  // Action: Test connection
  if (action === 'test_connection') {
    try {
      const testRes = await fetch(addAuth(`${DATTO_EDR_BASE_URL}/targets`), { headers });
      if (!testRes.ok) {
        return { success: false, error: `EDR API returned ${testRes.status}: ${testRes.statusText}` };
      }
      const data = await testRes.json();
      const targetsArray = data.data || data.targets || data || [];
      return {
        success: true,
        message: `Connected to Datto EDR — ${targetsArray.length} tenants found`
      };
    } catch (error) {
      return { success: false, error: error.message || 'Failed to connect to Datto EDR API' };
    }
  }

  if (action === 'list_tenants') {
    const targetsRes = await fetch(addAuth(`${DATTO_EDR_BASE_URL}/targets`), { headers });

    if (!targetsRes.ok) {
      const errorText = await targetsRes.text();
      console.error('EDR API error:', errorText);
      return { success: false, error: `Failed to fetch tenants: ${targetsRes.status}` };
    }

    const data = await targetsRes.json();
    const targetsArray = data.data || data.targets || data || [];
    const tenants = targetsArray.map(t => ({
      id: t.id || t.targetId,
      name: t.name || t.organizationName || t.targetName,
      deviceCount: t.agentCount || t.hostCount || t.endpointCount || 0,
      activeCount: t.activeAgentCount || 0,
      alertCount: parseInt(t.alertCount) || 0
    }));

    return { success: true, tenants };
  }

  // Get cached data without calling external API
  if (action === 'get_cached') {
    if (!customer_id) {
      return { success: false, error: 'customer_id required' };
    }

    const { data: mappingsData } = await supabase.from('datto_edr_mappings').select('*').eq('customer_id', customer_id);
    const mappings = mappingsData || [];

    if (mappings.length === 0) {
      return { success: false, error: 'Customer not mapped to EDR tenant' };
    }

    const mapping = mappings[0];

    // Return cached data if available
    if (mapping.cached_data) {
      try {
        return {
          success: true,
          cached: true,
          last_synced: mapping.last_synced,
          data: mapping.cached_data
        };
      } catch (e) {
        // Cache invalid
      }
    }

    return {
      success: true,
      cached: true,
      last_synced: mapping.last_synced,
      data: null,
      message: 'No cached data available. Click Sync to fetch data.'
    };
  }

  if (action === 'sync_customer') {
    if (!customer_id) {
      return { success: false, error: 'customer_id required' };
    }

    const { data: mappingsData } = await supabase.from('datto_edr_mappings').select('*').eq('customer_id', customer_id);
    const mappings = mappingsData || [];

    if (mappings.length === 0) {
      return { success: false, error: 'Customer not mapped to EDR tenant' };
    }

    const mapping = mappings[0];
    const targetId = mapping.edr_tenant_id;

    console.log('Target ID:', targetId);

    const targetUrl = addAuth(`${DATTO_EDR_BASE_URL}/targets/${targetId}`);
    const targetRes = await fetch(targetUrl, { headers }).catch(e => null);

    let targetData = null;
    if (targetRes?.ok) {
      const raw = await targetRes.text();
      try { targetData = JSON.parse(raw); } catch(e) { console.log('Target parse err:', e); }
    }

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

    let hosts = allAgents.filter(a => a.locationId === targetId);
    console.log(`Found ${hosts.length} agents with locationId=${targetId} out of ${allAgents.length} total`);

    const targetStats = targetData ? {
      agentCount: targetData.agentCount || 0,
      activeAgentCount: targetData.activeAgentCount || 0,
      alertCount: parseInt(targetData.alertCount) || 0,
      totalAddressCount: targetData.totalAddressCount || 0,
      lastScannedOn: targetData.lastScannedOn
    } : null;

    const hostCount = hosts.length || targetStats?.agentCount || 0;

    // Determine online status based on heartbeat within last 24 hours
    // EDR console shows "Active" status for devices that checked in today
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeHosts = hosts.filter(h => {
      if (h.heartbeat) {
        const heartbeatDate = new Date(h.heartbeat);
        return heartbeatDate > twentyFourHoursAgo;
      }
      return h.active === true;
    });
    console.log(`Active filter: ${activeHosts.length} active out of ${hosts.length} total (cutoff: ${twentyFourHoursAgo.toISOString()})`);
    const activeCount = activeHosts.length || targetStats?.activeAgentCount || 0;
    const alertCount = targetStats?.alertCount || 0;

    const responseData = {
      hostCount: hostCount,
      activeHostCount: activeCount,
      hosts: hosts.slice(0, 100).map(h => {
        const heartbeatDate = h.heartbeat ? new Date(h.heartbeat) : null;
        const isOnline = heartbeatDate ? heartbeatDate > twentyFourHoursAgo : h.active === true;
        return {
          id: h.id,
          hostname: h.hostname || h.name,
          ip: h.ip || h.ipstring,
          os: h.os,
          online: isOnline,
          lastSeen: h.heartbeat
        };
      }),
      alertCount: alertCount,
      criticalAlerts: 0,
      mediumAlerts: 0,
      lowAlerts: 0,
      lastScannedOn: targetStats?.lastScannedOn,
      targetStats
    };

    // Cache the data for future quick loads
    await supabase.from('datto_edr_mappings').update({
      last_synced: new Date().toISOString(),
      cached_data: responseData
    }).eq('id', mapping.id);

    return {
      success: true,
      data: responseData
    };
  }

  if (action === 'get_reports') {
    const reportsUrl = addAuth(`${DATTO_EDR_BASE_URL}/Reports`);
    const reportsRes = await fetch(reportsUrl, { headers });

    if (!reportsRes.ok) {
      return { success: false, error: `Failed to fetch reports: ${reportsRes.status}` };
    }

    const allReports = await reportsRes.json();
    const reportsArray = Array.isArray(allReports) ? allReports : allReports?.data || [];

    return {
      success: true,
      reports: reportsArray
    };
  }

  if (action === 'download_report') {
    const { report_id } = body;
    if (!report_id) {
      return { success: false, error: 'report_id required' };
    }

    // Get report details to check status
    const reportUrl = addAuth(`${DATTO_EDR_BASE_URL}/Reports/${report_id}`);
    const reportRes = await fetch(reportUrl, { headers });

    if (!reportRes.ok) {
      return { success: false, error: `Report not found: ${reportRes.status}` };
    }

    const report = await reportRes.json();

    if (report.status !== 'complete') {
      return {
        success: false,
        error: `Report is not ready yet. Status: ${report.status || 'pending'}`,
        status: report.status || 'pending'
      };
    }

    // Try multiple download URL patterns
    const downloadUrls = [
      addAuth(`${DATTO_EDR_BASE_URL}/Reports/${report_id}/download`),
      addAuth(`${DATTO_EDR_BASE_URL}/Reports/${report_id}/file`),
      addAuth(`${DATTO_EDR_BASE_URL}/reports/${report_id}/download`)
    ];

    let pdfBuffer = null;
    let downloadError = null;

    for (const downloadUrl of downloadUrls) {
      console.log('Trying download URL:', downloadUrl.replace(DATTO_EDR_API_TOKEN, '***'));
      const downloadRes = await fetch(downloadUrl, { headers });

      if (downloadRes.ok) {
        const contentType = downloadRes.headers.get('content-type');
        console.log('Content-Type:', contentType);
        if (contentType?.includes('application/pdf') || contentType?.includes('octet-stream')) {
          pdfBuffer = Buffer.from(await downloadRes.arrayBuffer());
          break;
        }
      }
      downloadError = `${downloadRes.status}`;
      const errText = await downloadRes.text().catch(() => '');
      console.log('Download failed:', downloadRes.status, errText.substring(0, 200));
    }

    if (!pdfBuffer) {
      // If direct download fails, check if report has a data.filename - try to get presigned URL
      if (report.data?.bucket && report.data?.filename) {
        console.log('Report has S3 data, trying presigned URL:', report.data);

        // Try to get a presigned URL from the API
        const presignedUrl = addAuth(`${DATTO_EDR_BASE_URL}/Reports/${report_id}/presignedUrl`);
        const presignedRes = await fetch(presignedUrl, { headers }).catch(() => null);

        if (presignedRes?.ok) {
          const presignedData = await presignedRes.json();
          console.log('Presigned URL response:', presignedData);

          if (presignedData.url) {
            // Download from the presigned URL
            const s3Res = await fetch(presignedData.url);
            if (s3Res.ok) {
              pdfBuffer = Buffer.from(await s3Res.arrayBuffer());
            }
          }
        }

        if (!pdfBuffer) {
          return {
            success: false,
            error: 'Direct download not available. Report available in Datto EDR console.',
            s3Info: report.data
          };
        }
      } else {
        return { success: false, error: `Failed to download: ${downloadError}` };
      }
    }

    return {
      _binary: true,
      buffer: pdfBuffer,
      contentType: 'application/pdf',
      filename: `${report.name || 'EDR-Report'}.pdf`
    };
  }

  if (action === 'check_report_status') {
    const { report_id } = body;
    if (!report_id) {
      return { success: false, error: 'report_id required' };
    }

    const reportUrl = addAuth(`${DATTO_EDR_BASE_URL}/Reports/${report_id}`);
    const reportRes = await fetch(reportUrl, { headers });

    if (!reportRes.ok) {
      return { success: false, error: `Report not found: ${reportRes.status}` };
    }

    const report = await reportRes.json();
    return { success: true, report };
  }

  if (action === 'generate_report') {
    if (!customer_id) {
      return { success: false, error: 'customer_id required' };
    }

    const { data: mappingsData } = await supabase.from('datto_edr_mappings').select('*').eq('customer_id', customer_id);
    const mappings = mappingsData || [];

    if (mappings.length === 0) {
      return { success: false, error: 'Customer not mapped to EDR tenant' };
    }

    const mapping = mappings[0];
    const targetId = mapping.edr_tenant_id;

    // Calculate date range - default to last 3 months
    const endDt = end_date ? new Date(end_date) : new Date();
    const startDt = start_date ? new Date(start_date) : new Date(endDt.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Create report request payload for Infocyte
    const reportPayload = {
      name: report_name || `${mapping.edr_tenant_name || 'Customer'} - EDR Report`,
      type: report_type || 'executiveThreat',
      format: 'pdf',
      targetId: targetId,
      startDate: startDt.toISOString(),
      endDate: endDt.toISOString()
    };

    console.log('Creating report with payload:', JSON.stringify(reportPayload));

    const createRes = await fetch(addAuth(`${DATTO_EDR_BASE_URL}/Reports`), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(reportPayload)
    });

    const responseText = await createRes.text();
    console.log('Report creation response:', createRes.status, responseText);

    if (!createRes.ok) {
      return { success: false, error: `Failed to create report: ${createRes.status} - ${responseText}` };
    }

    let report;
    try {
      report = JSON.parse(responseText);
    } catch (e) {
      report = { raw: responseText };
    }

    return { success: true, report };
  }

  if (action === 'sync_all') {
    const { data: allMappingsData } = await supabase.from('datto_edr_mappings').select('*');
    const allMappings = allMappingsData || [];
    let synced = 0;

    for (const mapping of allMappings) {
      try {
        await supabase.from('datto_edr_mappings').update({
          last_synced: new Date().toISOString()
        }).eq('id', mapping.id);
        synced++;
      } catch (e) {
        console.error(`Failed to sync ${mapping.customer_name}:`, e);
      }
    }

    return { success: true, synced };
  }

  if (action === 'get_tenant_stats') {
    if (!customer_id) {
      return { success: false, error: 'customer_id required' };
    }

    const { data: mappingsData } = await supabase.from('datto_edr_mappings').select('*').eq('customer_id', customer_id);
    const mappings = mappingsData || [];

    if (mappings.length === 0) {
      return { success: false, error: 'Customer not mapped' };
    }

    const mapping = mappings[0];

    const [hostsRes, alertsRes] = await Promise.all([
      fetch(addAuth(`${DATTO_EDR_BASE_URL}/targets/${mapping.edr_tenant_id}/hosts`), { headers }),
      fetch(addAuth(`${DATTO_EDR_BASE_URL}/targets/${mapping.edr_tenant_id}/alerts`), { headers }).catch(() => null)
    ]);

    const hostsData = hostsRes.ok ? await hostsRes.json() : { data: [] };
    const alertsData = alertsRes?.ok ? await alertsRes.json() : { data: [] };

    const endpoints = hostsData.data || hostsData.hosts || [];
    const alerts = alertsData.data || alertsData.alerts || [];

    return {
      success: true,
      stats: {
        totalEndpoints: endpoints.length,
        protectedEndpoints: endpoints.filter(e => e.status === 'online' || e.agentStatus === 'active').length,
        alerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical' || a.severity === 'high' || a.threatScore >= 7).length
      },
      endpoints: endpoints.slice(0, 20),
      alerts: alerts.slice(0, 10)
    };
  }

  return { success: false, error: 'Invalid action' };
}
