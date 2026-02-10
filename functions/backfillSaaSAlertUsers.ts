import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const { customer_id } = await req.json();
    
    if (!customer_id) {
      return Response.json({ error: 'customer_id required' }, { status: 400 });
    }
    
    // Get all alerts for this customer
    const alerts = await base44.asServiceRole.entities.SaaSAlert.filter({ customer_id });
    
    let updated = 0;
    for (const alert of alerts) {
      // Skip if already has user_email
      if (alert.user_email) continue;
      
      // Try to extract from raw_data
      if (alert.raw_data) {
        try {
          const rawData = JSON.parse(alert.raw_data);
          const userEmail = rawData.userPrincipalName || rawData.user?.name || rawData.email || '';
          const application = rawData.product?.name || rawData.applicationType || rawData.application || '';
          
          if (userEmail || application) {
            await base44.asServiceRole.entities.SaaSAlert.update(alert.id, {
              user_email: userEmail,
              application: application || alert.application
            });
            updated++;
          }
        } catch (e) {
          console.log('Could not parse raw_data for alert:', alert.id);
        }
      }
    }
    
    return Response.json({ 
      success: true, 
      totalAlerts: alerts.length,
      updated 
    });
    
  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});