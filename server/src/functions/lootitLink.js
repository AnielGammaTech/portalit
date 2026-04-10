import { getServiceSupabase } from '../lib/supabase.js';

// Map vendor keys to their report/mapping table and count field
const VENDOR_CONFIG = {
  inky: {
    table: 'inky_reports',
    buildRecord: (count, name) => ({ total_users: count, report_data: { total_users: count }, report_type: 'user_count' }),
  },
  bullphish: {
    table: 'bull_phish_id_reports',
    buildRecord: (count, name) => ({ total_emails_sent: count, report_data: { total_emails_sent: count, user_count: count }, report_type: 'extension_sync' }),
  },
  darkweb: {
    table: 'dark_web_id_reports',
    buildRecord: (count, name) => ({ domains_count: count, report_data: { domains_count: count }, report_type: 'extension_sync' }),
  },
  threecx: {
    table: 'threecx_reports',
    buildRecord: (count, name) => ({ user_extensions: count, total_extensions: count, report_data: { user_extensions: count, synced_from: 'lootit_link' } }),
  },
};

export async function lootitLink(params) {
  const { action } = params;
  const supabase = getServiceSupabase();

  if (action === 'sync') {
    const { vendor, team_results, total_count } = params;

    if (!vendor || !VENDOR_CONFIG[vendor]) {
      return { success: false, error: `Unknown vendor: ${vendor}. Supported: ${Object.keys(VENDOR_CONFIG).join(', ')}` };
    }

    if (!team_results || !Array.isArray(team_results)) {
      return { success: false, error: 'team_results array required' };
    }

    const config = VENDOR_CONFIG[vendor];
    const results = [];
    let synced = 0;
    let failed = 0;

    for (const team of team_results) {
      const { customer_id, customer_name, count, name } = team;
      if (!customer_id) { results.push({ teamName: name, error: 'no customer_id' }); continue; }

      try {
        const { data: existing } = await supabase
          .from(config.table)
          .select('id')
          .eq('customer_id', customer_id)
          .limit(1);

        const vendorFields = config.buildRecord(count, name);

        if (existing && existing.length > 0) {
          await supabase.from(config.table).update({
            ...vendorFields,
            report_date: new Date().toISOString().split('T')[0],
            updated_date: new Date().toISOString(),
          }).eq('id', existing[0].id);
        } else {
          const record = {
            customer_id,
            customer_name,
            ...vendorFields,
            report_date: new Date().toISOString().split('T')[0],
          };
          if (config.reportType) record.report_type = config.reportType;
          await supabase.from(config.table).insert(record);
        }

        synced++;
        results.push({ teamName: name, customer: { id: customer_id, name: customer_name }, userCount: count });
      } catch (err) {
        failed++;
        results.push({ teamName: name, error: err.message });
      }
    }

    return {
      success: true,
      vendor,
      synced,
      failed,
      unmatched: team_results.filter(t => !t.customer_id).length,
      total: team_results.length,
      totalCount: total_count,
      results,
    };
  }

  return { success: false, error: `Unknown action: ${action}` };
}
