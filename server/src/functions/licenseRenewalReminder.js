import { getServiceSupabase } from '../lib/supabase.js';
import { sendEmail } from '../lib/email.js';

export async function licenseRenewalReminder(body, user) {
  const supabase = getServiceSupabase();

  // Get all active licenses
  const { data: licenses } = await supabase
    .from('saas_licenses')
    .select('*')
    .eq('status', 'active');

  const today = new Date();
  const reminders = [];

  for (const license of (licenses || [])) {
    if (!license.renewal_date) continue;

    const renewalDate = new Date(license.renewal_date);
    const daysUntil = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));

    // Send reminder 30, 14, and 7 days before renewal
    if ([30, 14, 7].includes(daysUntil)) {
      // Get customer info
      const { data: customers } = await supabase
        .from('customers')
        .select('*')
        .eq('id', license.customer_id);

      const customer = customers?.[0];

      if (customer?.email) {
        await sendEmail({
          to: customer.email,
          subject: `License Renewal Reminder: ${license.application_name}`,
          body: `
Hello,

This is a reminder that your ${license.application_name} license is due for renewal in ${daysUntil} days.

License Details:
- Application: ${license.application_name}
- Vendor: ${license.vendor || 'N/A'}
- Seats: ${license.quantity}
- Monthly Cost: $${license.total_cost?.toFixed(2) || '0.00'}
- Renewal Date: ${license.renewal_date}

Please review your license utilization and contact your IT provider if you need to make any changes before renewal.

Best regards,
Your IT Team
          `
        });

        reminders.push({
          license: license.application_name,
          customer: customer.name,
          daysUntil
        });
      }
    }
  }

  return {
    success: true,
    remindersSent: reminders.length,
    details: reminders
  };
}
