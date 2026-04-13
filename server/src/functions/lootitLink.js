import { getServiceSupabase } from '../lib/supabase.js';

// Local date helper (avoids UTC offset showing yesterday)
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const VENDOR_CONFIG = {
  inky: {
    table: 'inky_reports',
    buildRecord: (team) => ({ total_users: team.count, report_data: { total_users: team.count }, report_type: 'user_count' }),
  },
  bullphish: {
    table: 'bull_phish_id_reports',
    buildRecord: (team) => ({ total_emails_sent: team.count, report_data: { total_emails_sent: team.count, user_count: team.count }, report_type: 'extension_sync' }),
  },
  darkweb: {
    table: 'dark_web_id_reports',
    buildRecord: (team) => ({ domains_count: team.count, report_data: { domains_count: team.count }, report_type: 'extension_sync' }),
  },
  threecx: {
    table: 'threecx_reports',
    buildRecord: (team) => ({
      user_extensions: team.count,
      total_extensions: team.count,
      extensions_detail: team.extensions ? JSON.stringify(team.extensions) : null,
      report_data: { user_extensions: team.count, synced_from: 'lootit_link' },
    }),
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
    const today = localDate();
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

        const vendorFields = config.buildRecord(team);

        if (existing && existing.length > 0) {
          await supabase.from(config.table).update({
            ...vendorFields,
            report_date: today,
            updated_date: new Date().toISOString(),
          }).eq('id', existing[0].id);
        } else {
          await supabase.from(config.table).insert({
            customer_id,
            customer_name,
            ...vendorFields,
            report_date: today,
          });
        }

        synced++;
        results.push({ teamName: name, customer: { id: customer_id, name: customer_name }, userCount: count });
      } catch (err) {
        failed++;
        results.push({ teamName: name, error: err.message });
      }
    }

    return { success: true, vendor, synced, failed, total: team_results.length, totalCount: total_count, results };
  }

  return { success: false, error: `Unknown action: ${action}` };
}
