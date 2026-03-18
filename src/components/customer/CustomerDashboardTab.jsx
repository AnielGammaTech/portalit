import React, { useMemo } from 'react';
import {
  Building2,
  Users,
  Monitor,
  Shield,
  DollarSign,
  FileText,
  HelpCircle,
  Cloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Laptop,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Wifi,
  Globe,
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, differenceInDays, parseISO } from 'date-fns';

// ── Stat Card ──────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, subtitle, color, bg, trend, className }) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow", className)}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bg)}>
          <Icon className={cn("w-4.5 h-4.5", color)} />
        </div>
        {trend && (
          <div className={cn(
            "ml-auto flex items-center gap-0.5 text-[11px] font-medium rounded-full px-2 py-0.5",
            trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
          )}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {subtitle && <p className="text-[10px] text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ── Progress Ring (tiny) ───────────────────────────────────────────
function MiniProgress({ value, max, color = 'stroke-emerald-500', size = 28 }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={3} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className={color} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round" />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function CustomerDashboardTab({
  customer,
  contacts,
  devices,
  contracts,
  tickets,
  invoices,
  lineItems,
  recurringBills,
  licenses,
  serviceTags,
}) {
  // ── Financial stats ────────────────────────────────────────────

  // Only sum line items from active recurring bills (exclude expired/inactive)
  const activeBillIds = useMemo(() => {
    const now = new Date();
    return new Set(
      (recurringBills || [])
        .filter(b => {
          if ((b.status || '').toLowerCase() === 'inactive') return false;
          if (b.end_date) {
            const end = new Date(b.end_date);
            // Ignore far-future placeholder dates (e.g. 2099)
            if (end.getFullYear() < 2090 && end < now) return false;
          }
          return true;
        })
        .map(b => b.id)
    );
  }, [recurringBills]);

  const activeLineItems = useMemo(
    () => lineItems.filter(li => activeBillIds.has(li.recurring_bill_id)),
    [lineItems, activeBillIds]
  );

  const monthlyCost = useMemo(
    () => activeLineItems.reduce((sum, item) => sum + (item.net_amount || 0), 0),
    [activeLineItems]
  );

  const activeContracts = useMemo(
    () => contracts.filter(c => c.status === 'active'),
    [contracts]
  );

  const contractValue = useMemo(
    () => activeContracts.reduce((sum, c) => sum + (c.value || 0), 0),
    [activeContracts]
  );

  // ── Invoice stats ──────────────────────────────────────────────
  const invoiceStats = useMemo(() => {
    const paid = invoices.filter(i => (i.status || '').toLowerCase() === 'paid');
    const pending = invoices.filter(i => ['pending', 'sent', 'open', 'unpaid'].includes((i.status || '').toLowerCase()));
    const overdue = invoices.filter(i => (i.status || '').toLowerCase() === 'overdue');
    const paidAmount = paid.reduce((s, i) => s + (i.total || i.amount || 0), 0);
    const pendingAmount = pending.reduce((s, i) => s + (i.total || i.amount || 0), 0);
    const overdueAmount = overdue.reduce((s, i) => s + (i.total || i.amount || 0), 0);
    return { paid: paid.length, pending: pending.length, overdue: overdue.length, paidAmount, pendingAmount, overdueAmount };
  }, [invoices]);

  // ── Ticket stats ───────────────────────────────────────────────
  const ticketStats = useMemo(() => {
    const open = tickets.filter(t => ['open', 'new', 'in_progress', 'pending', 'active'].includes((t.status || '').toLowerCase()));
    const closed = tickets.filter(t => ['closed', 'resolved', 'completed'].includes((t.status || '').toLowerCase()));
    const recent = tickets.filter(t => {
      if (!t.created_date) return false;
      return differenceInDays(new Date(), new Date(t.created_date)) <= 30;
    });
    return { open: open.length, closed: closed.length, total: tickets.length, recent: recent.length };
  }, [tickets]);

  // ── Device stats ───────────────────────────────────────────────
  const deviceStats = useMemo(() => {
    const online = devices.filter(d => (d.status || '').toLowerCase() === 'online');
    const offline = devices.filter(d => (d.status || '').toLowerCase() === 'offline');
    const servers = devices.filter(d => (d.device_type || '').toLowerCase().includes('server'));
    const workstations = devices.filter(d => !((d.device_type || '').toLowerCase().includes('server')));
    return { total: devices.length, online: online.length, offline: offline.length, servers: servers.length, workstations: workstations.length };
  }, [devices]);

  // ── Contact stats ──────────────────────────────────────────────
  const contactStats = useMemo(() => {
    const primary = contacts.filter(c => c.is_primary);
    const withEmail = contacts.filter(c => c.email);
    return { total: contacts.length, primary: primary.length, withEmail: withEmail.length };
  }, [contacts]);

  // ── Contract health ────────────────────────────────────────────
  const contractHealth = useMemo(() => {
    const expiringSoon = activeContracts.filter(c => {
      if (!c.end_date) return false;
      const daysLeft = differenceInDays(new Date(c.end_date), new Date());
      return daysLeft >= 0 && daysLeft <= 60;
    });
    return { expiringSoon: expiringSoon.length, active: activeContracts.length };
  }, [activeContracts]);

  // ── Customer age ───────────────────────────────────────────────
  const customerAge = useMemo(() => {
    if (!customer?.created_date) return null;
    const days = differenceInDays(new Date(), new Date(customer.created_date));
    if (days < 30) return `${days}d`;
    if (days < 365) return `${Math.floor(days / 30)}mo`;
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return months > 0 ? `${years}y ${months}mo` : `${years}y`;
  }, [customer?.created_date]);

  return (
    <div className="space-y-5">

      {/* Row 1 — Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={DollarSign}
          label="Monthly Recurring"
          value={`$${monthlyCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle={`${activeLineItems.length} line item${activeLineItems.length !== 1 ? 's' : ''} (active)`}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatCard
          icon={Users}
          label="Team Members"
          value={contactStats.total}
          subtitle={contactStats.primary > 0 ? `${contactStats.primary} primary contact${contactStats.primary !== 1 ? 's' : ''}` : null}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          icon={Monitor}
          label="Devices"
          value={deviceStats.total}
          subtitle={deviceStats.total > 0
            ? `${deviceStats.servers} server${deviceStats.servers !== 1 ? 's' : ''} · ${deviceStats.workstations} workstation${deviceStats.workstations !== 1 ? 's' : ''}`
            : null}
          color="text-violet-600"
          bg="bg-violet-50"
        />
        <StatCard
          icon={HelpCircle}
          label="Open Tickets"
          value={ticketStats.open}
          subtitle={ticketStats.recent > 0 ? `${ticketStats.recent} in last 30 days` : `${ticketStats.total} total`}
          color="text-orange-600"
          bg="bg-orange-50"
        />
      </div>

      {/* Row 2 — Financial + Contract Health side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Invoice Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Invoice Summary</h4>
            <span className="text-xs text-gray-400">{invoices.length} total invoices</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs text-gray-500">Pending</span>
              </div>
              <p className={cn("text-lg font-bold", invoiceStats.pending > 0 ? "text-amber-600" : "text-gray-900")}>{invoiceStats.pending}</p>
              <p className="text-[10px] text-gray-400">${invoiceStats.pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs text-gray-500">Overdue</span>
              </div>
              <p className={cn("text-lg font-bold", invoiceStats.overdue > 0 ? "text-red-600" : "text-gray-900")}>{invoiceStats.overdue}</p>
              <p className="text-[10px] text-gray-400">${invoiceStats.overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          {/* Bar */}
          {invoices.length > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden mt-4 bg-gray-100">
              {invoiceStats.paid > 0 && (
                <div className="bg-emerald-500 transition-all" style={{ width: `${(invoiceStats.paid / invoices.length) * 100}%` }} />
              )}
              {invoiceStats.pending > 0 && (
                <div className="bg-amber-400 transition-all" style={{ width: `${(invoiceStats.pending / invoices.length) * 100}%` }} />
              )}
              {invoiceStats.overdue > 0 && (
                <div className="bg-red-500 transition-all" style={{ width: `${(invoiceStats.overdue / invoices.length) * 100}%` }} />
              )}
            </div>
          )}
        </div>

        {/* Contracts & Services */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Contracts & Services</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-lg font-bold text-gray-900">{contractHealth.active}</p>
              <p className="text-xs text-gray-500">Active Contracts</p>
              {contractValue > 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5">${contractValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} total value</p>
              )}
            </div>
            <div>
              <p className={cn("text-lg font-bold", contractHealth.expiringSoon > 0 ? "text-amber-600" : "text-gray-900")}>
                {contractHealth.expiringSoon}
              </p>
              <p className="text-xs text-gray-500">Expiring in 60 days</p>
            </div>
          </div>

          {/* Active Integrations */}
          {serviceTags.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Active Integrations</p>
              <div className="flex flex-wrap gap-1.5">
                {serviceTags.map(tag => (
                  <span
                    key={tag.key}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium",
                      "bg-gray-50 border border-gray-200",
                      tag.text
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full", tag.dot)} />
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3 — Device Health + Ticket Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Device Health */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Device Health</h4>
          {deviceStats.total === 0 ? (
            <p className="text-sm text-gray-400">No devices synced</p>
          ) : (
            <div className="flex items-center gap-4">
              <MiniProgress
                value={deviceStats.online}
                max={deviceStats.total}
                color="stroke-emerald-500"
                size={52}
              />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Online
                  </span>
                  <span className="text-xs font-bold text-gray-900">{deviceStats.online}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" /> Offline
                  </span>
                  <span className="text-xs font-bold text-gray-900">{deviceStats.offline}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-300" /> Unknown
                  </span>
                  <span className="text-xs font-bold text-gray-900">{deviceStats.total - deviceStats.online - deviceStats.offline}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ticket Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Tickets</h4>
          {ticketStats.total === 0 ? (
            <p className="text-sm text-gray-400">No tickets found</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-500" /> Open
                </span>
                <span className="text-sm font-bold text-gray-900">{ticketStats.open}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Resolved
                </span>
                <span className="text-sm font-bold text-gray-900">{ticketStats.closed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" /> Last 30 days
                </span>
                <span className="text-sm font-bold text-gray-900">{ticketStats.recent}</span>
              </div>
              {/* Resolution rate */}
              {ticketStats.total > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-400">Resolution Rate</span>
                    <span className="text-[10px] font-medium text-gray-600">
                      {Math.round((ticketStats.closed / ticketStats.total) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${(ticketStats.closed / ticketStats.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SaaS / Apps overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">SaaS & Apps</h4>
          {licenses.length === 0 ? (
            <p className="text-sm text-gray-400">No applications tracked</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-violet-500" /> Applications
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {[...new Set(licenses.map(l => l.application_name))].length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" /> Licenses
                </span>
                <span className="text-sm font-bold text-gray-900">{licenses.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Monthly Cost
                </span>
                <span className="text-sm font-bold text-gray-900">
                  ${licenses.filter(l => l.status === 'active').reduce((s, l) => s + (l.total_cost || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 4 — Company Info card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Company Information</h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {customer.email && (
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</p>
              <a href={`mailto:${customer.email}`} className="text-sm text-blue-600 hover:underline truncate block">{customer.email}</a>
            </div>
          )}
          {customer.phone && (
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</p>
              <a href={`tel:${customer.phone}`} className="text-sm text-gray-900">{customer.phone}</a>
            </div>
          )}
          {customer.address && (
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</p>
              <p className="text-sm text-gray-900">{customer.address}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> Customer Since</p>
            <p className="text-sm text-gray-900">
              {customer.created_date
                ? format(new Date(customer.created_date), 'MMM d, yyyy')
                : '—'}
              {customerAge && <span className="text-gray-400 ml-1">({customerAge})</span>}
            </p>
          </div>
          {customer.source && (
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><Globe className="w-3 h-3" /> Source</p>
              <Badge variant="outline" className="text-xs capitalize">{customer.source}</Badge>
            </div>
          )}
          {customer.primary_contact && (
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><Users className="w-3 h-3" /> Primary Contact</p>
              <p className="text-sm text-gray-900">{customer.primary_contact}</p>
            </div>
          )}
        </div>
        {customer.notes && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
