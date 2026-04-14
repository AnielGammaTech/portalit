import { getServiceSupabase } from '../lib/supabase.js';
import { sendEmail } from '../lib/email.js';

export async function autoSuspendUnusedLicenses(body, user) {
  const supabase = getServiceSupabase();
  const daysThreshold = body?.days_threshold || 90;

  try {
    const { data: licenses, error: licErr } = await supabase
      .from('saas_licenses')
      .select('*')
      .eq('status', 'active');

    if (licErr) {
      console.error('[autoSuspend] Failed to fetch licenses:', licErr.message);
      return { success: false, error: licErr.message };
    }

    const suspended = [];
    const today = new Date();

    for (const license of (licenses || [])) {
      try {
        const { data: assignments } = await supabase
          .from('license_assignments')
          .select('*')
          .eq('license_id', license.id);

        const activeAssignments = (assignments || []).filter(a => a.status === 'active');

        if (activeAssignments.length === 0) {
          if (!license.created_date) continue;
          const createdDate = new Date(license.created_date);
          const daysSinceCreated = Math.ceil((today - createdDate) / (1000 * 60 * 60 * 24));

          if (daysSinceCreated >= daysThreshold) {
            const { error: updateErr } = await supabase
              .from('saas_licenses')
              .update({
                status: 'suspended',
                notes: `${license.notes || ''}\n[Auto-suspended on ${today.toISOString().split('T')[0]} - No assignments for ${daysSinceCreated} days]`.trim()
              })
              .eq('id', license.id);

            if (updateErr) {
              console.error(`[autoSuspend] Failed to suspend ${license.application_name}:`, updateErr.message);
              continue;
            }

            const { data: customers } = await supabase
              .from('customers')
              .select('*')
              .eq('id', license.customer_id);

            const customer = customers?.[0];

            if (customer?.email) {
              try {
                await sendEmail({
                  to: customer.email,
                  subject: `License Auto-Suspended: ${license.application_name}`,
                  body: `Hello,\n\nYour ${license.application_name} license has been automatically suspended due to no user assignments for ${daysSinceCreated} days.\n\nLicense Details:\n- Application: ${license.application_name}\n- Seats: ${license.quantity}\n- Monthly Cost: $${license.total_cost?.toFixed(2) || '0.00'}\n\nThis action was taken to help optimize your software spend. If you need to reactivate this license, please contact your IT provider.\n\nBest regards,\nYour IT Team`
                });
              } catch (emailErr) {
                console.error(`[autoSuspend] Failed to send email for ${license.application_name}:`, emailErr.message);
              }
            }

            suspended.push({
              license: license.application_name,
              customer: customer?.name,
              daysSinceCreated
            });
          }
        }
      } catch (innerErr) {
        console.error(`[autoSuspend] Error processing license ${license.id}:`, innerErr.message);
      }
    }

    return { success: true, licensesSuspended: suspended.length, details: suspended };
  } catch (err) {
    console.error('[autoSuspend] Unhandled error:', err.message);
    return { success: false, error: err.message };
  }
}
