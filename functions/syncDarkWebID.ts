import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DARKWEB_BASE_URL = 'https://secure.darkwebid.com';

async function getDarkWebIDAuth() {
  const username = Deno.env.get('DARKWEBID_USERNAME');
  const password = Deno.env.get('DARKWEBID_PASSWORD');
  
  if (!username || !password) {
    throw new Error('Dark Web ID credentials not configured');
  }
  
  return 'Basic ' + btoa(`${username}:${password}`);
}

async function fetchCompromises(organizationUuid, authHeader) {
  const response = await fetch(
    `${DARKWEB_BASE_URL}/api/compromises/organization/${organizationUuid}.json`,
    {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dark Web ID API error: ${response.status} - ${text}`);
  }
  
  return response.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { action, customer_id, organization_uuid } = await req.json();
    const authHeader = await getDarkWebIDAuth();
    
    if (action === 'test_connection') {
      // First get our outgoing IP
      let outgoingIP = 'unknown';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        outgoingIP = ipData.ip;
      } catch (e) {
        // ignore
      }

      // Test the API connection
      try {
        const response = await fetch(`${DARKWEB_BASE_URL}/api/organizations.json`, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        });
        
        const text = await response.text();
        
        if (!response.ok) {
          return Response.json({ 
            success: false, 
            error: `API returned ${response.status}`,
            outgoing_ip: outgoingIP,
            hint: 'Make sure this IP is whitelisted in Dark Web ID settings'
          });
        }
        
        try {
          const data = JSON.parse(text);
          return Response.json({ 
            success: true, 
            organizations: data,
            outgoing_ip: outgoingIP
          });
        } catch (parseError) {
          // Include first 500 chars of response to help debug
          const preview = text.substring(0, 500);
          return Response.json({ 
            success: false, 
            error: 'Received HTML instead of JSON - likely not authenticated',
            outgoing_ip: outgoingIP,
            response_preview: preview,
            hint: 'Make sure this IP is whitelisted in Dark Web ID settings and API access is enabled for your user'
          });
        }
      } catch (error) {
        return Response.json({ 
          success: false, 
          error: error.message,
          outgoing_ip: outgoingIP
        });
      }
    }
    
    if (action === 'list_organizations') {
      // List all organizations from Dark Web ID
      const response = await fetch(`${DARKWEB_BASE_URL}/api/organizations.json`, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch organizations: ${response.status}`);
      }
      
      const organizations = await response.json();
      return Response.json({ success: true, organizations });
    }
    
    if (action === 'sync_customer') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id required' }, { status: 400 });
      }
      
      // Get the mapping for this customer
      const mappings = await base44.asServiceRole.entities.DarkWebIDMapping.filter({ 
        customer_id 
      });
      
      if (mappings.length === 0) {
        return Response.json({ 
          error: 'No Dark Web ID mapping found for this customer' 
        }, { status: 404 });
      }
      
      const mapping = mappings[0];
      const compromises = await fetchCompromises(mapping.darkweb_organization_uuid, authHeader);
      
      // Get existing compromises for this customer
      const existingCompromises = await base44.asServiceRole.entities.DarkWebCompromise.filter({
        customer_id
      });
      const existingIds = new Set(existingCompromises.map(c => c.darkweb_id));
      
      let synced = 0;
      let skipped = 0;
      
      // Process each compromise
      const compromiseList = Array.isArray(compromises) ? compromises : (compromises.compromises || []);
      
      for (const compromise of compromiseList) {
        const compromiseId = compromise.id || compromise.uuid || `${compromise.email}-${compromise.source}`;
        
        if (existingIds.has(compromiseId)) {
          skipped++;
          continue;
        }
        
        await base44.asServiceRole.entities.DarkWebCompromise.create({
          customer_id,
          darkweb_id: compromiseId,
          email: compromise.email || compromise.username,
          domain: compromise.domain,
          password: compromise.password,
          source: compromise.source || compromise.breach_name,
          breach_date: compromise.breach_date || compromise.published_date,
          discovered_date: compromise.discovered_date || new Date().toISOString().split('T')[0],
          status: 'new',
          severity: compromise.severity || 'medium'
        });
        synced++;
      }
      
      // Update last sync time
      await base44.asServiceRole.entities.DarkWebIDMapping.update(mapping.id, {
        last_sync: new Date().toISOString()
      });
      
      return Response.json({ 
        success: true, 
        synced,
        skipped,
        total: compromiseList.length
      });
    }
    
    return Response.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});