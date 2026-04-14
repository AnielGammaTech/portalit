import { getServiceSupabase } from '../lib/supabase.js';
import { sendEmail } from '../lib/email.js';

export async function autoSuspendUnusedLicenses(body, user) {
  const supabase = getServiceSupabase();
  const daysThreshold = body.days_threshold || 90; // Default 90 days

  // Get all active licenses
  const { data: licenses } = await supabase
    .from('saas_licenses')
    .select('*')
    .eq('status', 'active');

  const suspended = [];
  const today = new Date();

  for (const license of (licenses || [])) {
    // Get assignments for this license
    const { data: assignments } = await supabase
      .from('license_assignments')
      .select('*')
      .eq('license_id', license.id);

    const activeAssignments = (assignments || []).filter(a => a.status === 'active');

    // If no active assignments
    if (activeAssignments.length === 0) {
      if (!license.created_date) continue;
      const createdDate = new Date(license.created_date);
      const daysSinceCreated = Math.ceil((today - createdDate) / (1000 * 60 * 60 * 24));

      if (daysSinceCreated >= daysThreshold) {
        // Suspend the license
        await supabase
          .from('saas_licenses')
          .update({
            status: 'suspended',
            notes: `${license.notes || ''}\n[Auto-suspended on ${today.toISOString().split('T')[0]} - No assignments for ${daysSinceCreated} days]`.trim()
          })
          .eq('id', license.id);

        // Get customer for notification
        const { data: customers } = await supabase
          .from('customers')
          .select('*')
          .eq('id', license.customer_id);

        const customer = customers?.[0];

        if (customer?.email) {
          await sendEmail({
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

  return {
    success: true,
    licensesSuspended: suspended.length,
    details: suspended
  };
}
