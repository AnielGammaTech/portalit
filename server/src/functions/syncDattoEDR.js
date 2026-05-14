import { getServiceSupabase } from '../lib/supabase.js';

const DATTO_EDR_API_TOKEN = process.env.DATTO_EDR_API_TOKEN;
const DATTO_EDR_BASE_URL = process.env.DATTO_EDR_BASE_URL;

// Mask access tokens in URLs before logging
const maskUrl = (url) => url.replace(/access_token=[^&]+/, 'access_token=***');
const PAGE_SIZE = 100;
const ONLINE_WINDOW_MS = 24 * 60 * 60 * 1000;

function firstValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value;
  }
  return null;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseCollection(payload, keys = ['data', 'value', 'agents', 'hosts', 'alerts', 'targets']) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function isActiveStatus(value) {
  if (value === true) return true;
  if (value === false) return false;
  const text = String(value || '').toLowerCase();
  return ['active', 'online', 'connected', 'healthy', 'running', 'protected'].some(status => text.includes(status));
}

function targetMatchesAgent(agent, targetId) {
  const target = String(targetId);
  const candidates = [
    agent.locationId,
    agent.location_id,
    agent.targetId,
    agent.target_id,
    agent.organizationId,
    agent.organization_id,
    agent.tenantId,
    agent.tenant_id,
    agent.customerId,
    agent.customer_id,
    agent.target?.id,
    agent.location?.id,
    agent.organization?.id,
  ];
  return candidates.some(value => value !== undefined && value !== null && String(value) === target);
}

function normalizeHost(host, cutoffDate) {
  const lastSeenRaw = firstValue(
    host.heartbeat,
    host.lastSeen,
    host.last_seen,
    host.lastCheckIn,
    host.lastCheckin,
    host.lastContact,
    host.lastConnected,
    host.lastScannedOn,
    host.updatedAt
  );
  const lastSeen = normalizeDate(lastSeenRaw);
  const lastSeenTime = lastSeen ? new Date(lastSeen).getTime() : null;
  const online = lastSeenTime ? lastSeenTime > cutoffDate.getTime() : isActiveStatus(firstValue(host.active, host.online, host.status, host.agentStatus, host.state));

  return {
    id: firstValue(host.id, host.agentId, host.hostId, host.deviceId, host.uid),
    hostname: firstValue(host.hostname, host.hostName, host.computerName, host.deviceName, host.name, 'Unknown endpoint'),
    ip: firstValue(host.ip, host.ipstring, host.ipAddress, host.localIp, host.externalIp, host.address),
    os: firstValue(host.os, host.operatingSystem, host.osName, host.platform, 'Unknown OS'),
    online,
    lastSeen,
    status: firstValue(host.status, host.agentStatus, host.state, online ? 'Online' : 'Offline'),
    agentVersion: firstValue(host.agentVersion, host.version, host.sensorVersion, host.clientVersion),
    username: firstValue(host.lastUser, host.lastLoggedInUser, host.username, host.user, host.owner),
    group: firstValue(host.group, host.groupName, host.policyName, host.siteName),
    isolationStatus: firstValue(host.isolationStatus, host.networkIsolation, host.containmentStatus),
    threatStatus: firstValue(host.threatStatus, host.securityStatus, host.healthStatus),
  };
}

function normalizeAlert(alert) {
  const severity = String(firstValue(alert.severity, alert.priority, alert.level, alert.threatLevel, 'unknown')).toLowerCase();
  return {
    id: firstValue(alert.id, alert.alertId, alert.threatId, alert.incidentId),
    title: firstValue(alert.title, alert.name, alert.threatName, alert.description, 'Security alert'),
    severity,
    status: firstValue(alert.status, alert.state, alert.disposition, 'active'),
    endpoint: firstValue(alert.hostname, alert.hostName, alert.deviceName, alert.agentName, alert.endpoint),
    createdAt: normalizeDate(firstValue(alert.createdAt, alert.createdOn, alert.detectedAt, alert.firstSeen, alert.timestamp)),
    description: firstValue(alert.summary, alert.details, alert.message, alert.description),
  };
}

function summarizeOs(hosts) {
  const counts = new Map();
  for (const host of hosts) {
    const label = host.os || 'Unknown OS';
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
}

function buildEdrResponseData({ hosts, targetData, alerts, targetName }) {
  const cutoffDate = new Date(Date.now() - ONLINE_WINDOW_MS);
  const normalizedHosts = hosts.map(host => normalizeHost(host, cutoffDate));
  const normalizedAlerts = alerts.map(normalizeAlert);
  const targetStats = targetData ? {
    agentCount: toNumber(firstValue(targetData.agentCount, targetData.hostCount, targetData.endpointCount)),
    activeAgentCount: toNumber(firstValue(targetData.activeAgentCount, targetData.activeHostCount, targetData.onlineAgentCount)),
    alertCount: toNumber(firstValue(targetData.alertCount, targetData.activeAlertCount, targetData.alertsCount)),
    totalAddressCount: toNumber(targetData.totalAddressCount),
    lastScannedOn: normalizeDate(targetData.lastScannedOn),
    status: firstValue(targetData.status, targetData.state),
  } : null;

  const hostCount = normalizedHosts.length || targetStats?.agentCount || 0;
  const activeHostCount = normalizedHosts.length
    ? normalizedHosts.filter(host => host.online).length
    : targetStats?.activeAgentCount || 0;
  const alertCount = normalizedAlerts.length || targetStats?.alertCount || 0;
  const criticalAlerts = normalizedAlerts.filter(alert => ['critical', 'high'].includes(alert.severity)).length;
  const mediumAlerts = normalizedAlerts.filter(alert => alert.severity === 'medium').length;
  const lowAlerts = normalizedAlerts.filter(alert => ['low', 'info', 'informational'].includes(alert.severity)).length;

  return {
    hostCount,
    activeHostCount,
    offlineHostCount: Math.max(hostCount - activeHostCount, 0),
    coveragePercent: hostCount > 0 ? Math.round((activeHostCount / hostCount) * 100) : 0,
    hosts: normalizedHosts,
    alertCount,
    criticalAlerts,
    mediumAlerts,
    lowAlerts,
    alerts: normalizedAlerts.slice(0, 25),
    lastScannedOn: targetStats?.lastScannedOn,
    targetStats,
    osBreakdown: summarizeOs(normalizedHosts),
    generatedAt: new Date().toISOString(),
    targetName,
  };
}

export async function syncDattoEDR(body, user) {
  const supabase = getServiceSupabase();

  const { action, customer_id, report_name, report_type, start_date, end_date } = body;

  // Check if API token and base URL are configured
  if (!DATTO_EDR_BASE_URL || !DATTO_EDR_API_TOKEN) {
    return {
      success: false,
      error: 'Datto EDR not configured'
    };
  }

  // Datto EDR uses Authorization header for API token
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DATTO_EDR_API_TOKEN}`
  };

  async function fetchJson(url) {
    const response = await fetch(url, { headers }).catch(() => null);
    if (!response?.ok) return null;
    const raw = await response.text();
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('[DattoEDR] Non-critical error parsing API response:', error.message);
      return null;
    }
  }

  async function fetchPagedCollection(urlBuilder, label) {
    const rows = [];
    for (let skip = 0; ; skip += PAGE_SIZE) {
      const url = urlBuilder(skip);
      const payload = await fetchJson(url);
      if (!payload) break;
      const page = parseCollection(payload, ['data', 'value', 'agents', 'hosts']);
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    if (rows.length === 0 && label) {
      console.log(`[DattoEDR] ${label} returned 0 rows`);
    }
    return rows;
  }

  async function fetchTargetBundle(targetId, targetName) {
    const targetData = await fetchJson(`${DATTO_EDR_BASE_URL}/targets/${targetId}`);

    let hosts = await fetchPagedCollection(
      (skip) => `${DATTO_EDR_BASE_URL}/targets/${targetId}/agents?$count=true&$skip=${skip}&$top=${PAGE_SIZE}`,
      `target-scoped agents for ${targetId}`
    );

    if (hosts.length === 0) {
      const allAgents = await fetchPagedCollection(
        (skip) => `${DATTO_EDR_BASE_URL}/agents?$count=true&$skip=${skip}&$top=${PAGE_SIZE}`,
        'global agents fallback'
      );
      hosts = allAgents.filter(agent => targetMatchesAgent(agent, targetId));
    }

    const alertsPayload = await fetchJson(`${DATTO_EDR_BASE_URL}/targets/${targetId}/alerts`);
    const alerts = parseCollection(alertsPayload, ['data', 'value', 'alerts', 'incidents', 'threats']);

    console.log(`[DattoEDR] Found ${hosts.length} agents and ${alerts.length} alerts for targetId=${targetId}`);
    return buildEdrResponseData({ hosts, targetData, alerts, targetName });
  }

  // Action: Test connection
  if (action === 'test_connection') {
    try {
      const testRes = await fetch(`${DATTO_EDR_BASE_URL}/targets`, { headers });
      if (!testRes.ok) {
        return { success: false, error: `EDR API returned ${testRes.status}: ${testRes.statusText}` };
      }
      const data = await testRes.json();
      const targetsArray = parseCollection(data, ['data', 'targets', 'value']);
      return {
        success: true,
        message: `Connected to Datto EDR — ${targetsArray.length} tenants found`
      };
    } catch (error) {
      return { success: false, error: error.message || 'Failed to connect to Datto EDR API' };
    }
  }

  if (action === 'list_tenants') {
    const targetsRes = await fetch(`${DATTO_EDR_BASE_URL}/targets`, { headers });

    if (!targetsRes.ok) {
      const errorText = await targetsRes.text();
      console.error('EDR API error:', errorText);
      return { success: false, error: `Failed to fetch tenants: ${targetsRes.status}` };
    }

    const data = await targetsRes.json();
    const targetsArray = parseCollection(data, ['data', 'targets', 'value']);
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
        console.warn('[DattoEDR] Non-critical error reading cached data:', e.message);
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

    const responseData = await fetchTargetBundle(targetId, mapping.edr_tenant_name);

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
    const reportsUrl = `${DATTO_EDR_BASE_URL}/Reports`;
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
    const reportUrl = `${DATTO_EDR_BASE_URL}/Reports/${report_id}`;
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
      `${DATTO_EDR_BASE_URL}/Reports/${report_id}/download`,
      `${DATTO_EDR_BASE_URL}/Reports/${report_id}/file`,
      `${DATTO_EDR_BASE_URL}/reports/${report_id}/download`
    ];

    let pdfBuffer = null;
    let downloadError = null;

    for (const downloadUrl of downloadUrls) {
      console.log('Trying download URL:', maskUrl(downloadUrl));
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
        const presignedUrl = `${DATTO_EDR_BASE_URL}/Reports/${report_id}/presignedUrl`;
        const presignedRes = await fetch(presignedUrl, { headers }).catch(() => null);

        if (presignedRes?.ok) {
          const presignedData = await presignedRes.json();
          console.log('Presigned URL response: received', presignedData.url ? 'valid URL' : 'no URL');

          if (presignedData.url) {
            // Download from the presigned URL (do not log presignedData — may contain tokens)
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

    const reportUrl = `${DATTO_EDR_BASE_URL}/Reports/${report_id}`;
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

    const createRes = await fetch(`${DATTO_EDR_BASE_URL}/Reports`, {
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
    let failed = 0;

    for (const mapping of allMappings) {
      try {
        const targetId = mapping.edr_tenant_id;
        if (!targetId) { failed++; continue; }

        const responseData = await fetchTargetBundle(targetId, mapping.edr_tenant_name);

        await supabase.from('datto_edr_mappings').update({
          last_synced: new Date().toISOString(),
          cached_data: responseData
        }).eq('id', mapping.id);
        synced++;
        console.log(`EDR sync_all: synced ${mapping.customer_name} — ${responseData.hostCount} agents`);
      } catch (e) {
        console.error(`Failed to sync ${mapping.customer_name}:`, e);
        failed++;
      }
    }

    return { success: true, synced, failed, total: allMappings.length };
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
      fetch(`${DATTO_EDR_BASE_URL}/targets/${mapping.edr_tenant_id}/hosts`, { headers }),
      fetch(`${DATTO_EDR_BASE_URL}/targets/${mapping.edr_tenant_id}/alerts`, { headers }).catch(() => null)
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
