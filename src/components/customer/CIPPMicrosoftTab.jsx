import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import {
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Globe2,
  KeyRound,
  Layers3,
  LogIn,
  Mail,
  MapPin,
  Monitor,
  Phone,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  UserCheck,
  UserRound,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  PortalMetricCard,
  PortalSection,
  PortalStatusPill,
} from '@/components/ui/portal-primitives';

const VIEW_TABS = [
  { key: 'users', label: 'Users', icon: Users },
  { key: 'licenses', label: 'Licenses', icon: KeyRound },
  { key: 'mailboxes', label: 'Mailboxes', icon: Mail },
  { key: 'groups', label: 'Groups', icon: Shield },
];

const USER_FILTERS = [
  { key: 'all', label: 'All users' },
  { key: 'active', label: 'Active' },
  { key: 'disabled', label: 'Disabled' },
  { key: 'licensed', label: 'Licensed' },
  { key: 'unlicensed', label: 'Unlicensed' },
  { key: 'guest', label: 'Guests' },
  { key: 'hybrid', label: 'Hybrid synced' },
  { key: 'stale', label: 'No recent sign-in' },
  { key: 'mfa_enabled', label: 'MFA known' },
  { key: 'mfa_missing', label: 'MFA not shown' },
];

const LICENSE_ALIASES = {
  O365_BUSINESS_PREMIUM: 'Microsoft 365 Business Premium',
  SPB: 'Microsoft 365 Business Premium',
  O365_BUSINESS_ESSENTIALS: 'Microsoft 365 Business Basic',
  O365_BUSINESS: 'Microsoft 365 Apps for Business',
  O365_BUSINESS_STANDARD: 'Microsoft 365 Business Standard',
  EXCHANGESTANDARD: 'Exchange Online Plan 1',
  EXCHANGEENTERPRISE: 'Exchange Online Plan 2',
  SPE_E3: 'Microsoft 365 E3',
  SPE_E5: 'Microsoft 365 E5',
  ENTERPRISEPACK: 'Office 365 E3',
  ENTERPRISEPREMIUM: 'Office 365 E5',
  VISIOCLIENT: 'Visio Plan 2',
  PROJECTPROFESSIONAL: 'Project Plan 3',
};

const GROUP_TYPE_STYLES = {
  'Distribution List': 'blue',
  distributionList: 'blue',
  'M365 Group': 'violet',
  microsoft365: 'violet',
  Unified: 'violet',
  'Mail-Enabled Security': 'amber',
  mailEnabledSecurity: 'amber',
  Security: 'slate',
  security: 'slate',
};

function parseCachedData(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [value].filter(Boolean);
}

function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatLicenseName(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const sku = value.includes(':') ? value.split(':').pop() : value;
  if (LICENSE_ALIASES[sku]) return LICENSE_ALIASES[sku];
  return sku
    .replace(/^Microsoft\s+/i, 'Microsoft ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLicenseNames(user) {
  const cd = parseCachedData(user.cached_data);
  const fromCache = asArray(cd.license_names || cd.licenses)
    .map(formatLicenseName)
    .filter(Boolean);

  if (fromCache.length > 0) return [...new Set(fromCache)];

  return asArray(user.assigned_licenses)
    .map(license => {
      if (typeof license === 'string') return formatLicenseName(license);
      return formatLicenseName(
        license?.skuName ||
        license?.SkuName ||
        license?.displayName ||
        license?.skuPartNumber ||
        license?.SkuPartNumber ||
        license?.skuId ||
        license?.SkuId
      );
    })
    .filter(Boolean);
}

function getMfaConfig(status) {
  const value = String(status || '').toLowerCase();
  if (
    value.includes('enforced') ||
    value.includes('enabled') ||
    value.includes('registered') ||
    value.includes('capable') ||
    value.includes('conditional access') ||
    value.includes('security default')
  ) {
    return { label: 'MFA shown', tone: 'emerald', icon: ShieldCheck, enabled: true };
  }
  if (value.includes('disabled') || value.includes('not')) {
    return { label: 'MFA not shown', tone: 'amber', icon: ShieldX, enabled: false };
  }
  return { label: 'MFA unknown', tone: 'slate', icon: ShieldAlert, enabled: false };
}

function getUserRoles(user) {
  const cd = parseCachedData(user.cached_data);
  return asArray(
    cd.roles ||
    cd.admin_roles ||
    cd.adminRoles ||
    cd.directory_roles ||
    cd.directoryRoles ||
    cd.assigned_roles ||
    cd.assignedRoles
  )
    .map(role => (typeof role === 'string' ? role : role?.displayName || role?.name || role?.roleName))
    .filter(Boolean);
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(value) {
  const date = safeDate(value);
  return date ? format(date, 'MMM d, yyyy') : 'Not available';
}

function formatDateTime(value) {
  const date = safeDate(value);
  return date ? format(date, 'MMM d, yyyy h:mm a') : 'Not available';
}

function formatRelativeDate(value) {
  const date = safeDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : 'No recent sign-in';
}

function hasRecentSignIn(value, days = 30) {
  const date = safeDate(value);
  if (!date) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function formatMailboxType(type) {
  return String(type || 'Mailbox')
    .replace(/Mailbox$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^User$/i, 'User mailbox')
    .trim();
}

function formatGroupType(type) {
  return String(type || 'Group')
    .replace(/microsoft365/i, 'Microsoft 365')
    .replace(/distributionList/i, 'Distribution List')
    .replace(/mailEnabledSecurity/i, 'Mail-Enabled Security');
}

function buildLicenseSummary(users, mappings) {
  const userCounts = new Map();
  for (const user of users) {
    for (const license of getLicenseNames(user)) {
      userCounts.set(license, (userCounts.get(license) || 0) + 1);
    }
  }

  const rows = [];
  for (const mapping of mappings) {
    const cd = parseCachedData(mapping.cached_data);
    const licenses = asArray(cd.licenses || cd.license_summary);
    for (const license of licenses) {
      if (typeof license === 'string') {
        rows.push({ name: formatLicenseName(license), assigned: userCounts.get(formatLicenseName(license)) || 0 });
        continue;
      }
      const name = formatLicenseName(license?.name || license?.displayName || license?.skuName || license?.skuPartNumber);
      if (!name) continue;
      const assigned = asNumber(license?.assigned ?? license?.consumed ?? license?.consumedUnits) ?? userCounts.get(name) ?? 0;
      const total = asNumber(license?.total ?? license?.enabled ?? license?.purchased ?? license?.activeUnits);
      rows.push({
        name,
        skuId: license?.sku_id || license?.skuId || null,
        assigned,
        total,
        available: asNumber(license?.available) ?? (total === null ? null : Math.max(total - assigned, 0)),
      });
    }
  }

  const byName = new Map();
  for (const row of rows) {
    const existing = byName.get(row.name);
    if (!existing || (row.total ?? 0) > (existing.total ?? 0)) {
      byName.set(row.name, row);
    }
  }

  for (const [name, assigned] of userCounts.entries()) {
    if (!byName.has(name)) {
      byName.set(name, { name, assigned, total: null, available: null });
    }
  }

  return [...byName.values()].sort((a, b) => (b.assigned || 0) - (a.assigned || 0));
}

function DetailItem({ icon: Icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="break-words text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function UserDetailDrawer({ user, onClose }) {
  if (!user) return null;

  const cd = parseCachedData(user.cached_data);
  const licenses = getLicenseNames(user);
  const mfa = getMfaConfig(cd.mfa_status);
  const roles = getUserRoles(user);
  const signIn = cd.last_sign_in_details || {};
  const MfaIcon = mfa.icon;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/25"
        aria-label="Close Microsoft 365 user details"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-slate-50 shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold',
                user.account_enabled ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
              )}>
                {(user.display_name || user.user_principal_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-slate-950">{user.display_name || 'Microsoft 365 user'}</h3>
                <p className="truncate text-sm text-slate-500">{user.mail || user.user_principal_name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <PortalStatusPill
                    label={user.account_enabled ? 'Active sign-in' : 'Sign-in disabled'}
                    tone={user.account_enabled ? 'emerald' : 'amber'}
                    icon={user.account_enabled ? UserCheck : UserX}
                  />
                  <PortalStatusPill label={mfa.label} tone={mfa.tone} icon={MfaIcon} />
                  {user.user_type === 'Guest' && <PortalStatusPill label="Guest" tone="violet" icon={UserRound} />}
                  {user.on_premises_sync_enabled && <PortalStatusPill label="Hybrid synced" tone="blue" icon={Monitor} />}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <PortalSection
            title="Account Snapshot"
            description="Profile, access state, and the most recent sign-in data available from Microsoft 365."
            bodyClassName="grid gap-3 p-4 sm:grid-cols-2"
          >
            <DetailItem icon={KeyRound} label="Assigned licenses" value={licenses.length ? `${licenses.length} license${licenses.length !== 1 ? 's' : ''}` : 'No license assigned'} />
            <DetailItem icon={LogIn} label="Last sign-in" value={formatRelativeDate(user.last_sign_in)} />
            <DetailItem icon={Briefcase} label="Title" value={user.job_title} />
            <DetailItem icon={Building2} label="Department" value={user.department} />
            <DetailItem icon={Building2} label="Company" value={cd.company_name} />
            <DetailItem icon={MapPin} label="Office" value={cd.office_location} />
          </PortalSection>

          <PortalSection title="Licensing" bodyClassName="p-4">
            {licenses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {licenses.map(license => (
                  <span key={license} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                    {license}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This user is active in Microsoft 365 but no license is shown in the current CIPP sync.
              </div>
            )}
          </PortalSection>

          <PortalSection title="Security And Sign-In" bodyClassName="grid gap-3 p-4 sm:grid-cols-2">
            <DetailItem icon={MfaIcon} label="MFA status" value={mfa.label} />
            <DetailItem icon={Clock} label="Last sign-in time" value={formatDateTime(user.last_sign_in)} />
            <DetailItem icon={Monitor} label="Last app" value={signIn.app} />
            <DetailItem icon={Globe2} label="IP / location" value={[signIn.ip, signIn.location].filter(Boolean).join(' - ')} />
            {signIn.status && (
              <DetailItem
                icon={signIn.status === 'success' ? CheckCircle2 : AlertCircle}
                label="Sign-in result"
                value={signIn.status === 'success' ? 'Success' : signIn.status === 'inactive' ? 'No recent sign-in' : signIn.error || 'Failed'}
              />
            )}
            {asArray(cd.mfa_methods).length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">MFA methods</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {asArray(cd.mfa_methods).map((method, index) => (
                    <span key={`${method}-${index}`} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {typeof method === 'string' ? method : method?.methodType || method?.['@odata.type']?.replace('#microsoft.graph.', '') || 'Method'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </PortalSection>

          <PortalSection title="Directory Details" bodyClassName="grid gap-3 p-4 sm:grid-cols-2">
            <DetailItem icon={UserRound} label="User type" value={user.user_type || 'Member'} />
            <DetailItem icon={Clock} label="Created" value={formatShortDate(user.created_date_time || cd.created)} />
            <DetailItem icon={Phone} label="Mobile" value={cd.mobile_phone} />
            <DetailItem icon={Phone} label="Business phone" value={asArray(cd.business_phones).join(', ')} />
            <DetailItem icon={Globe2} label="Usage location" value={cd.usage_location} />
            <DetailItem icon={Globe2} label="Location" value={[cd.city, cd.state, cd.country].filter(Boolean).join(', ')} />
            <DetailItem icon={Monitor} label="Directory source" value={user.on_premises_sync_enabled ? 'Hybrid / on-prem synced' : 'Cloud'} />
            <DetailItem icon={Clock} label="Last AD sync" value={formatDateTime(cd.on_premises_last_sync)} />
            {roles.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Directory roles</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {roles.map(role => (
                    <span key={role} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {asArray(cd.aliases).length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Aliases</p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {asArray(cd.aliases).map(alias => (
                    <span key={alias} className="truncate text-sm text-slate-700">{alias}</span>
                  ))}
                </div>
              </div>
            )}
          </PortalSection>
        </div>
      </aside>
    </div>
  );
}

function SelectFilter({ label, value, onChange, children, className }) {
  return (
    <label className={cn('flex min-w-[150px] flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500', className)}>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-700 shadow-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        {children}
      </select>
    </label>
  );
}

function ViewTabs({ activeView, setActiveView }) {
  return (
    <div className="flex w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {VIEW_TABS.map(tab => {
        const Icon = tab.icon;
        const active = activeView === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveView(tab.key)}
            className={cn(
              'flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
              active ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CIPPMicrosoftTab({ customerId }) {
  const [activeView, setActiveView] = useState('users');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [licenseFilter, setLicenseFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [mailboxTypeFilter, setMailboxTypeFilter] = useState('all');
  const [groupTypeFilter, setGroupTypeFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);

  const { data: mappingsRaw = [], isLoading: loadingMappings } = useQuery({
    queryKey: ['cipp-mapping-detail', customerId],
    queryFn: () => client.entities.CIPPMapping.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });
  const mappings = mappingsRaw ?? [];

  const { data: usersRaw = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['cipp-users', customerId],
    queryFn: () => client.entities.CIPPUser.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });
  const users = usersRaw ?? [];

  const { data: mailboxesRaw = [], isLoading: loadingMailboxes } = useQuery({
    queryKey: ['cipp-mailboxes', customerId],
    queryFn: () => client.entities.CIPPMailbox.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });
  const mailboxes = mailboxesRaw ?? [];

  const { data: groupsRaw = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['cipp-groups', customerId],
    queryFn: () => client.entities.CIPPGroup.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });
  const groups = groupsRaw ?? [];

  const licenseSummary = useMemo(() => buildLicenseSummary(users, mappings), [users, mappings]);

  const stats = useMemo(() => {
    const licensedUsers = users.filter(user => getLicenseNames(user).length > 0);
    const activeUsers = users.filter(user => user.account_enabled === true);
    const disabledUsers = users.filter(user => user.account_enabled === false);
    const sharedMailboxes = mailboxes.filter(mb => String(mb.mailbox_type || '').toLowerCase().includes('shared'));
    const mfaShown = users.filter(user => getMfaConfig(parseCachedData(user.cached_data).mfa_status).enabled);
    const hybridUsers = users.filter(user => user.on_premises_sync_enabled);
    const staleUsers = users.filter(user => user.account_enabled === true && !hasRecentSignIn(user.last_sign_in, 30));
    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      disabledUsers: disabledUsers.length,
      licensedUsers: licensedUsers.length,
      unlicensedUsers: Math.max(users.length - licensedUsers.length, 0),
      guestUsers: users.filter(user => user.user_type === 'Guest').length,
      hybridUsers: hybridUsers.length,
      staleUsers: staleUsers.length,
      mfaShown: mfaShown.length,
      mailboxes: mailboxes.length,
      sharedMailboxes: sharedMailboxes.length,
      groups: groups.length,
    };
  }, [users, mailboxes, groups]);

  const tenantName = mappings[0]?.cipp_tenant_name || mappings[0]?.cipp_default_domain || 'Microsoft 365 tenant';
  const lastSynced = mappings
    .map(mapping => safeDate(mapping.last_synced))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const departmentOptions = useMemo(() => {
    return [...new Set(users.map(user => user.department).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }, [users]);

  const licenseOptions = useMemo(() => licenseSummary.map(license => license.name), [licenseSummary]);
  const mailboxTypeOptions = useMemo(() => {
    return [...new Set(mailboxes.map(mb => mb.mailbox_type || 'Mailbox'))].sort((a, b) => a.localeCompare(b));
  }, [mailboxes]);
  const groupTypeOptions = useMemo(() => {
    return [...new Set(groups.map(group => group.group_type || 'Group'))].sort((a, b) => a.localeCompare(b));
  }, [groups]);

  const searchLower = search.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        const cd = parseCachedData(user.cached_data);
        const licenses = getLicenseNames(user);
        const mfa = getMfaConfig(cd.mfa_status);
        const searchable = [
          user.display_name,
          user.mail,
          user.user_principal_name,
          user.department,
          user.job_title,
          cd.company_name,
          cd.office_location,
          ...licenses,
        ].filter(Boolean).join(' ').toLowerCase();

        const statusMatches = statusFilter === 'all'
          || (statusFilter === 'active' && user.account_enabled === true)
          || (statusFilter === 'disabled' && user.account_enabled === false)
          || (statusFilter === 'licensed' && licenses.length > 0)
          || (statusFilter === 'unlicensed' && licenses.length === 0)
          || (statusFilter === 'guest' && user.user_type === 'Guest')
          || (statusFilter === 'hybrid' && user.on_premises_sync_enabled)
          || (statusFilter === 'stale' && user.account_enabled === true && !hasRecentSignIn(user.last_sign_in, 30))
          || (statusFilter === 'mfa_enabled' && mfa.enabled)
          || (statusFilter === 'mfa_missing' && !mfa.enabled);

        const licenseMatches = licenseFilter === 'all' || licenses.includes(licenseFilter);
        const departmentMatches = departmentFilter === 'all' || user.department === departmentFilter;
        const searchMatches = !searchLower || searchable.includes(searchLower);
        return statusMatches && licenseMatches && departmentMatches && searchMatches;
      })
      .sort((a, b) => (a.display_name || a.user_principal_name || '').localeCompare(b.display_name || b.user_principal_name || ''));
  }, [users, statusFilter, licenseFilter, departmentFilter, searchLower]);

  const filteredMailboxes = useMemo(() => {
    return mailboxes.filter(mailbox => {
      const searchable = [mailbox.display_name, mailbox.primary_smtp_address, mailbox.user_principal_name, mailbox.mailbox_type]
        .filter(Boolean).join(' ').toLowerCase();
      const searchMatches = !searchLower || searchable.includes(searchLower);
      const typeMatches = mailboxTypeFilter === 'all' || mailbox.mailbox_type === mailboxTypeFilter;
      return searchMatches && typeMatches;
    });
  }, [mailboxes, searchLower, mailboxTypeFilter]);

  const filteredGroups = useMemo(() => {
    return groups.filter(group => {
      const cd = parseCachedData(group.cached_data);
      const searchable = [group.display_name, group.mail, group.description, group.group_type, ...asArray(cd.members)]
        .filter(Boolean).join(' ').toLowerCase();
      const searchMatches = !searchLower || searchable.includes(searchLower);
      const typeMatches = groupTypeFilter === 'all' || group.group_type === groupTypeFilter;
      return searchMatches && typeMatches;
    });
  }, [groups, searchLower, groupTypeFilter]);

  const filteredLicenseSummary = useMemo(() => {
    return licenseSummary.filter(license => {
      const searchable = [license.name, license.skuId, license.sku_id]
        .filter(Boolean).join(' ').toLowerCase();
      return !searchLower || searchable.includes(searchLower);
    });
  }, [licenseSummary, searchLower]);

  const isLoading = loadingMappings || loadingUsers || loadingMailboxes || loadingGroups;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
              <Monitor className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-950">Microsoft 365 Directory</h2>
              <p className="truncate text-sm text-slate-500">
                {tenantName}{lastSynced ? ` · Synced ${formatDistanceToNow(lastSynced, { addSuffix: true })}` : ''}
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <PortalStatusPill label={`${stats.licensedUsers} licensed`} tone="blue" icon={KeyRound} />
          <PortalStatusPill label={`${stats.sharedMailboxes} shared mailboxes`} tone="violet" icon={Mail} />
          <PortalStatusPill label={`${stats.groups} groups`} tone="slate" icon={Shield} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <PortalMetricCard
          icon={Users}
          label="Users"
          value={stats.totalUsers}
          detail={`${stats.activeUsers} active`}
          tone="blue"
          onClick={() => { setActiveView('users'); setStatusFilter('all'); }}
        />
        <PortalMetricCard
          icon={KeyRound}
          label="Licensed"
          value={stats.licensedUsers}
          detail={`${stats.unlicensedUsers} without a license`}
          tone="emerald"
          onClick={() => { setActiveView('users'); setStatusFilter('licensed'); }}
        />
        <PortalMetricCard
          icon={UserX}
          label="Sign-in Disabled"
          value={stats.disabledUsers}
          detail="Accounts that cannot sign in"
          tone={stats.disabledUsers > 0 ? 'amber' : 'slate'}
          onClick={() => { setActiveView('users'); setStatusFilter('disabled'); }}
        />
        <PortalMetricCard
          icon={ShieldCheck}
          label="MFA Shown"
          value={stats.mfaShown}
          detail={`${stats.totalUsers ? Math.round((stats.mfaShown / stats.totalUsers) * 100) : 0}% of users`}
          tone="violet"
          onClick={() => { setActiveView('users'); setStatusFilter('mfa_enabled'); }}
        />
        <PortalMetricCard
          icon={Clock}
          label="No Recent Sign-In"
          value={stats.staleUsers}
          detail="Active users over 30 days"
          tone={stats.staleUsers > 0 ? 'amber' : 'slate'}
          onClick={() => { setActiveView('users'); setStatusFilter('stale'); }}
        />
      </div>

      <ViewTabs activeView={activeView} setActiveView={(view) => { setActiveView(view); setSearch(''); }} />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm xl:flex-row xl:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Search
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, department, license, mailbox, or group"
              className="h-10 pl-9"
            />
          </div>
        </label>

        {activeView === 'users' && (
          <>
            <SelectFilter label="Status" value={statusFilter} onChange={setStatusFilter}>
              {USER_FILTERS.map(filter => <option key={filter.key} value={filter.key}>{filter.label}</option>)}
            </SelectFilter>
            <SelectFilter label="License" value={licenseFilter} onChange={setLicenseFilter} className="xl:min-w-[220px]">
              <option value="all">All licenses</option>
              {licenseOptions.map(license => <option key={license} value={license}>{license}</option>)}
            </SelectFilter>
            <SelectFilter label="Department" value={departmentFilter} onChange={setDepartmentFilter} className="xl:min-w-[190px]">
              <option value="all">All departments</option>
              {departmentOptions.map(department => <option key={department} value={department}>{department}</option>)}
            </SelectFilter>
          </>
        )}

        {activeView === 'mailboxes' && (
          <SelectFilter label="Mailbox Type" value={mailboxTypeFilter} onChange={setMailboxTypeFilter}>
            <option value="all">All mailboxes</option>
            {mailboxTypeOptions.map(type => <option key={type} value={type}>{formatMailboxType(type)}</option>)}
          </SelectFilter>
        )}

        {activeView === 'groups' && (
          <SelectFilter label="Group Type" value={groupTypeFilter} onChange={setGroupTypeFilter}>
            <option value="all">All groups</option>
            {groupTypeOptions.map(type => <option key={type} value={type}>{formatGroupType(type)}</option>)}
          </SelectFilter>
        )}
      </div>

      {activeView === 'licenses' && (
        <PortalSection
          title="License Utilization"
          description="CIPP license totals when available, with user assignment counts as the fallback."
          badge={<PortalStatusPill label={`${filteredLicenseSummary.length} products`} tone="blue" />}
          bodyClassName="divide-y divide-slate-100"
        >
          {filteredLicenseSummary.length === 0 ? (
            <EmptyState icon={KeyRound} title="No license data synced" description="License details will appear after the next CIPP sync." />
          ) : (
            filteredLicenseSummary.map(license => {
              const total = asNumber(license.total);
              const assigned = asNumber(license.assigned) || 0;
              const percent = total && total > 0 ? Math.min(Math.round((assigned / total) * 100), 100) : null;
              const available = total === null ? null : Math.max(total - assigned, 0);
              return (
                <div key={license.name} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-950">{license.name}</p>
                      {available === 0 && total !== null && (
                        <PortalStatusPill label="Fully assigned" tone="amber" icon={AlertCircle} />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {total !== null ? `${assigned} assigned of ${total} purchased` : `${assigned} assigned users`}
                      {available !== null ? ` · ${available} available` : ''}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn('h-full rounded-full', available === 0 && total !== null ? 'bg-amber-500' : 'bg-blue-500')}
                        style={{ width: `${percent ?? 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 text-center">
                    <div className="px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Assigned</p>
                      <p className="text-lg font-bold tabular-nums text-slate-950">{assigned}</p>
                    </div>
                    <div className="border-x border-slate-200 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
                      <p className="text-lg font-bold tabular-nums text-slate-950">{total ?? '-'}</p>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Open</p>
                      <p className="text-lg font-bold tabular-nums text-slate-950">{available ?? '-'}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </PortalSection>
      )}

      {activeView === 'users' && (
        <PortalSection
          title="User Inventory"
          description={`Showing ${filteredUsers.length} of ${users.length} Microsoft 365 users.`}
          badge={<PortalStatusPill label={`${stats.unlicensedUsers} unlicensed`} tone={stats.unlicensedUsers > 0 ? 'amber' : 'slate'} />}
          bodyClassName="overflow-x-auto"
        >
          {filteredUsers.length === 0 ? (
            <EmptyState icon={Users} title="No users match this view" description="Adjust the search or filters to see more users." />
          ) : (
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Licenses</th>
                  <th className="px-4 py-3 font-semibold">Department / Role</th>
                  <th className="px-4 py-3 font-semibold">Last Sign-In</th>
                  <th className="px-5 py-3 text-right font-semibold">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(user => {
                  const cd = parseCachedData(user.cached_data);
                  const licenses = getLicenseNames(user);
                  const mfa = getMfaConfig(cd.mfa_status);
                  const MfaIcon = mfa.icon;
                  return (
                    <tr
                      key={user.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                      onClick={() => setSelectedUser(user)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                            user.account_enabled ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                          )}>
                            {(user.display_name || user.user_principal_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">{user.display_name || user.user_principal_name}</p>
                            <p className="truncate text-xs text-slate-500">{user.mail || user.user_principal_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <PortalStatusPill
                            label={user.account_enabled ? 'Active' : 'Disabled'}
                            tone={user.account_enabled ? 'emerald' : 'amber'}
                            icon={user.account_enabled ? UserCheck : UserX}
                            className="px-2 py-0.5"
                          />
                          <PortalStatusPill label={mfa.label} tone={mfa.tone} icon={MfaIcon} className="px-2 py-0.5" />
                          {user.user_type === 'Guest' && <PortalStatusPill label="Guest" tone="violet" className="px-2 py-0.5" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {licenses.length > 0 ? (
                          <div className="max-w-[260px]">
                            <p className="truncate text-xs font-semibold text-blue-700">{licenses[0]}</p>
                            {licenses.length > 1 && <p className="text-[11px] text-slate-500">+{licenses.length - 1} more</p>}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-amber-700">No license</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate font-medium text-slate-800">{user.department || 'No department'}</p>
                        <p className="truncate text-xs text-slate-500">{user.job_title || 'No title shown'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{formatRelativeDate(user.last_sign_in)}</p>
                        <p className="text-xs text-slate-500">{formatShortDate(user.last_sign_in)}</p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <PortalStatusPill
                          label={user.on_premises_sync_enabled ? 'Hybrid' : 'Cloud'}
                          tone={user.on_premises_sync_enabled ? 'blue' : 'slate'}
                          icon={Monitor}
                          className="justify-center px-2 py-0.5"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </PortalSection>
      )}

      {activeView === 'mailboxes' && (
        <PortalSection
          title="Mailbox Inventory"
          description={`Showing ${filteredMailboxes.length} of ${mailboxes.length} mailboxes from CIPP.`}
          bodyClassName="overflow-x-auto"
        >
          {filteredMailboxes.length === 0 ? (
            <EmptyState icon={Mail} title="No mailboxes match this view" description="Adjust the search or mailbox type filter." />
          ) : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Mailbox</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Primary Address</th>
                  <th className="px-5 py-3 font-semibold">User Principal Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMailboxes.map(mailbox => (
                  <tr key={mailbox.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                          <Mail className="h-4 w-4" />
                        </div>
                        <p className="font-semibold text-slate-950">{mailbox.display_name || 'Mailbox'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <PortalStatusPill label={formatMailboxType(mailbox.mailbox_type)} tone={String(mailbox.mailbox_type || '').toLowerCase().includes('shared') ? 'violet' : 'slate'} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{mailbox.primary_smtp_address || '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{mailbox.user_principal_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PortalSection>
      )}

      {activeView === 'groups' && (
        <PortalSection
          title="Groups And Distribution"
          description={`Showing ${filteredGroups.length} of ${groups.length} Microsoft 365 groups and lists.`}
          bodyClassName="divide-y divide-slate-100"
        >
          {filteredGroups.length === 0 ? (
            <EmptyState icon={Shield} title="No groups match this view" description="Adjust the search or group type filter." />
          ) : (
            filteredGroups.map(group => {
              const cd = parseCachedData(group.cached_data);
              const members = asArray(cd.members);
              const isExpanded = expandedGroup === group.id;
              const tone = GROUP_TYPE_STYLES[group.group_type] || 'slate';
              return (
                <div key={group.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                    className="grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_170px_110px_32px] md:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Shield className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{group.display_name || 'Group'}</p>
                        <p className="truncate text-xs text-slate-500">{group.mail || group.description || 'No email address shown'}</p>
                      </div>
                    </div>
                    <PortalStatusPill label={formatGroupType(group.group_type)} tone={tone} className="justify-center" />
                    <div className="text-left md:text-right">
                      <p className="text-sm font-bold tabular-nums text-slate-950">{group.member_count ?? members.length}</p>
                      <p className="text-xs text-slate-500">members</p>
                    </div>
                    <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        {group.description && <p className="mb-3 text-sm text-slate-600">{group.description}</p>}
                        <div className="flex flex-wrap gap-2">
                          {cd.teams_enabled && <PortalStatusPill label="Teams enabled" tone="violet" icon={Layers3} />}
                          {cd.dynamic && <PortalStatusPill label="Dynamic membership" tone="blue" icon={CheckCircle2} />}
                          {cd.on_premises_sync && <PortalStatusPill label="Hybrid synced" tone="blue" icon={Monitor} />}
                        </div>
                        <div className="mt-4">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Members</p>
                          {members.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-500">No members shown in the current CIPP sync.</p>
                          ) : (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {members.slice(0, 60).map((member, index) => (
                                <div key={`${member}-${index}`} className="truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
                                  {member}
                                </div>
                              ))}
                              {members.length > 60 && (
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500">
                                  +{members.length - 60} more
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </PortalSection>
      )}

      {selectedUser && <UserDetailDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  );
}
