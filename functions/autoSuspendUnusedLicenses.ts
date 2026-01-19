import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const daysThreshold = body.days_threshold || 90; // Default 90 days

    // Get all active licenses
    const licenses = await base44.asServiceRole.entities.SaaSLicense.filter({ status: 'active' });
    const suspended = [];
    const today = new Date();

    for (const license of licenses) {
      // Get assignments for this license
      const assignments = await base44.asServiceRole.entities.LicenseAssignment.filter({ 
        license_id: license.id 
      });
      
      const activeAssignments = assignments.filter(a => a.status === 'active');
      
      // If no active assignments
      if (activeAssignments.length === 0) {
        // Check license creation date
        const createdDate = new Date(license.created_date);
        const daysSinceCreated = Math.ceil((today - createdDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceCreated >= daysThreshold) {
          // Suspend the license
          await base44.asServiceRole.entities.SaaSLicense.update(license.id, { 
            status: 'suspended',
            notes: `${license.notes || ''}\n[Auto-suspended on ${today.toISOString().split('T')[0]} - No assignments for ${daysSinceCreated} days]`.trim()
          });
          
          // Get customer for notification
          const customers = await base44.asServiceRole.entities.Customer.filter({ id: license.customer_id });
          const customer = customers[0];
          
          if (customer?.email) {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: customer.email,
              subject: `License Auto-Suspended: ${license.application_name}`,
              body: `
Hello,

Your ${license.application_name} license has been automatically suspended due to no user assignments for ${daysSinceCreated} days.

License Details:
- Application: ${license.application_name}
- Seats: ${license.quantity}
- Monthly Cost: $${license.total_cost?.toFixed(2) || '0.00'}

This action was taken to help optimize your software spend. If you need to reactivate this license, please contact your IT provider.

Best regards,
Your IT Team
              `
            });
          }
          
          suspended.push({
            license: license.application_name,
            customer: customer?.name,
            daysSinceCreated
          });
        }
      }
    }

    return Response.json({ 
      success: true, 
      licensesSuspended: suspended.length,
      details: suspended 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});