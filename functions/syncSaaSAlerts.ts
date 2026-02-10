import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const API_BASE = 'https://us-central1-the-byway-248217.cloudfunctions.net/reportApi/api/v1';

async function saasAlertsApiCall(endpoint, method = 'GET', body = null) {
  const apiKey = Deno.env.get('SAAS_ALERTS_API_KEY');
  const apiUser = Deno.env.get('SAAS_ALERTS_API_USER');
  const partnerId = Deno.env.get('SAAS_ALERTS_PARTNER_ID');
  
  console.log('API Call to:', endpoint);
  console.log('API Key present:', !!apiKey, 'length:', apiKey?.length);
  console.log('API User present:', !!apiUser);
  console.log('Partner ID present:', !!partnerId);
  
  // Try multiple auth approaches
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'x-api-key': apiKey,
    'apikey': apiKey,
    'Content-Type': 'application/json'
  };
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const url = `${API_BASE}${endpoint}`;
  console.log('Full URL:', url);
  
  const response = await fetch(url, options);
  
  const responseText = await response.text();
  console.log('Response status:', response.status);
  console.log('Response body preview:', responseText.substring(0, 500));
  
  if (!response.ok) {
    throw new Error(`SaaS Alerts API error: ${response.status} - ${responseText}`);
  }
  
  return responseText ? JSON.parse(responseText) : {};
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action, customer_id, days = 7 } = await req.json();
    
    // Skip auth check for scheduled runs
    if (action !== 'scheduled_sync') {
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    // Test connection
    if (action === 'test_connection') {
      const profile = await saasAlertsApiCall('/reports/partners/profile');
      return Response.json({ success: true, partner: profile });
    }
    
    // List all organizations/customers from SaaS Alerts
    if (action === 'list_organizations') {
      const customers = await saasAlertsApiCall('/reports/customers');
      return Response.json({ success: true, organizations: customers });
    }
    
    // Get billing details
    if (action === 'get_billing') {
      const billing = await saasAlertsApiCall('/reports/billing-details');
      return Response.json({ success: true, billing });
    }
    
    // Get users for an organization
    if (action === 'get_users') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id required' }, { status: 400 });
      }
      
      const mapping = await base44.asServiceRole.entities.SaaSAlertsMapping.filter({ customer_id });
      if (!mapping.length) {
        return Response.json({ error: 'No SaaS Alerts mapping found for this customer' }, { status: 404 });
      }
      
      const orgId = mapping[0].saas_alerts_org_id;
      const users = await saasAlertsApiCall(`/reports/users?organizationId=${orgId}`);
      return Response.json({ success: true, users });
    }
    
    // Get events/alerts for an organization
    if (action === 'get_events') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id required' }, { status: 400 });
      }
      
      const mapping = await base44.asServiceRole.entities.SaaSAlertsMapping.filter({ customer_id });
      if (!mapping.length) {
        return Response.json({ error: 'No SaaS Alerts mapping found for this customer' }, { status: 404 });
      }
      
      const orgId = mapping[0].saas_alerts_org_id;
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      
      const events = await saasAlertsApiCall(`/reports/events?organizationId=${orgId}&fromUtc=${fromDate.toISOString()}&size=100`);
      return Response.json({ success: true, events });
    }
    
    // Sync events for a customer
    if (action === 'sync_events') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id required' }, { status: 400 });
      }
      
      const mapping = await base44.asServiceRole.entities.SaaSAlertsMapping.filter({ customer_id });
      if (!mapping.length) {
        return Response.json({ error: 'No SaaS Alerts mapping found for this customer' }, { status: 404 });
      }
      
      const orgId = mapping[0].saas_alerts_org_id;
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      
      const eventsResponse = await saasAlertsApiCall(`/reports/events?organizationId=${orgId}&fromUtc=${fromDate.toISOString()}&size=500`);
      const events = eventsResponse?.hits?.hits || eventsResponse || [];
      
      console.log(`Found ${Array.isArray(events) ? events.length : 0} events for org ${orgId}`);
      
      // Get existing alerts
      const existingAlerts = await base44.asServiceRole.entities.SaaSAlert.filter({ customer_id });
      const existingIds = new Set(existingAlerts.map(a => a.alert_id));
      
      let synced = 0;
      let skipped = 0;
      for (const event of (Array.isArray(events) ? events : [])) {
        const source = event._source || event;
        const alertId = event._id || source.id || `${source.timestamp}-${source.jointType}`;
        
        if (existingIds.has(alertId)) continue;
        
        // Skip non-Fortify alerts (ignore Unify/Datto device alerts)
        const productType = source.product?.type || '';
        if (productType === 'DATTO_RMM' || productType === 'UNIFY' || source.jointType?.startsWith('unify.')) {
          continue;
        }
        
        // IMPORTANT: Only sync alerts that actually belong to this organization
        // The API sometimes returns events from other orgs even with organizationId filter
        const eventOrgId = source.customer?.id;
        if (eventOrgId && eventOrgId !== orgId) {
          skipped++;
          continue;
        }
        
        // Extract user info - SaaS Alerts uses user.name (email) and user.fullName
        const userEmail = source.userPrincipalName || source.user?.name || source.email || '';
        
        const alertData = {
          customer_id,
          alert_id: alertId,
          event_type: source.jointType || source.eventType || 'unknown',
          description: source.jointDesc || source.description || '',
          severity: source.alertStatus || 'medium',
          status: 'open',
          user_email: userEmail,
          application: source.applicationType || source.application || source.product?.name || '',
          ip_address: source.ip || source.ipAddress || '',
          location: source.location ? `${source.location.city || ''}, ${source.location.country || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, '') : '',
          detected_at: source.time || source.timestamp || source.createdAt || new Date().toISOString(),
          raw_data: JSON.stringify(source)
        };
        
        await base44.asServiceRole.entities.SaaSAlert.create(alertData);
        synced++;
      }
      
      // Update mapping last_synced
      await base44.asServiceRole.entities.SaaSAlertsMapping.update(mapping[0].id, {
        last_synced: new Date().toISOString()
      });
      
      return Response.json({ 
        success: true, 
        alertsSynced: synced,
        skippedWrongOrg: skipped,
        totalEvents: Array.isArray(events) ? events.length : 0
      });
    }
    
    // Get summary for a customer
    if (action === 'get_summary') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id required' }, { status: 400 });
      }
      
      const alerts = await base44.asServiceRole.entities.SaaSAlert.filter({ customer_id });
      const openAlerts = alerts.filter(a => a.status === 'open');
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      
      // Group by event type
      const byType = {};
      for (const alert of alerts) {
        byType[alert.event_type] = (byType[alert.event_type] || 0) + 1;
      }
      
      // Group by application
      const byApp = {};
      for (const alert of alerts) {
        if (alert.application) {
          byApp[alert.application] = (byApp[alert.application] || 0) + 1;
        }
      }
      
      return Response.json({
        success: true,
        summary: {
          total: alerts.length,
          open: openAlerts.length,
          critical: criticalAlerts.length,
          byEventType: byType,
          byApplication: byApp
        }
      });
    }
    
    // Get Fortify data (secure score, licenses, connections) for an organization
    if (action === 'get_fortify') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id required' }, { status: 400 });
      }
      
      const mapping = await base44.asServiceRole.entities.SaaSAlertsMapping.filter({ customer_id });
      if (!mapping.length) {
        return Response.json({ error: 'No SaaS Alerts mapping found for this customer' }, { status: 404 });
      }
      
      const orgId = mapping[0].saas_alerts_org_id;
      
      // Fetch licenses/subscriptions
      let licenses = [];
      try {
        const licensesData = await saasAlertsApiCall(`/reports/licenses?organizationId=${orgId}`);
        licenses = Array.isArray(licensesData) ? licensesData : licensesData?.licenses || [];
      } catch (e) {
        console.log('Could not fetch licenses:', e.message);
      }
      
      // Fetch connections/integrations
      let connections = [];
      try {
        const connectionsData = await saasAlertsApiCall(`/reports/connections?organizationId=${orgId}`);
        connections = Array.isArray(connectionsData) ? connectionsData : connectionsData?.connections || [];
      } catch (e) {
        console.log('Could not fetch connections:', e.message);
      }
      
      // Fetch secure score / benchmark
      let secureScore = null;
      try {
        const scoreData = await saasAlertsApiCall(`/reports/secure-score?organizationId=${orgId}`);
        secureScore = scoreData;
      } catch (e) {
        console.log('Could not fetch secure score:', e.message);
      }
      
      // Fetch customer details for additional info
      let customerInfo = null;
      try {
        const customersData = await saasAlertsApiCall('/reports/customers');
        const customers = Array.isArray(customersData) ? customersData : [];
        customerInfo = customers.find(c => c.id === orgId || c.organizationId === orgId);
      } catch (e) {
        console.log('Could not fetch customer info:', e.message);
      }
      
      return Response.json({
        success: true,
        fortify: {
          licenses,
          connections,
          secureScore,
          customerInfo
        }
      });
    }
    
    return Response.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('SaaS Alerts sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});