/**
 * Role-based permissions configuration.
 *
 * Roles:
 *   admin  — full access to everything
 *   sales  — customer-facing features, no LootIT, no integrations admin
 *   user   — customer portal only (own data, read-only except SaaS apps)
 */

// Pages each role can access in the full (admin) portal
export const ROLE_ALLOWED_PAGES = {
  admin: new Set([
    'Adminland',
    'Analytics',
    'Billing',
    'Contracts',
    'CustomerDetail',
    'CustomerPortalPreview',
    'CustomerSettings',
    'Customers',
    'Dashboard',
    'Integrations',
    'LicenseDetail',
    'LootIT',
    'SaaSReports',
    'Services',
    'Settings',
    'SpendAnalysis',
  ]),
  sales: new Set([
    'Analytics',
    'Billing',
    'Contracts',
    'CustomerDetail',
    'CustomerPortalPreview',
    'Customers',
    'Dashboard',
    'LicenseDetail',
    'SaaSReports',
    'Services',
    'SpendAnalysis',
  ]),
};

// Navigation items per role (full portal)
export const ROLE_NAV_CONFIG = {
  admin: {
    topNav: ['Dashboard', 'Customers', 'LootIT'],
    mobileBottomTabs: ['Dashboard', 'Customers', 'LootIT', 'Billing'],
    drawerExtras: ['Billing', 'Settings'],
  },
  sales: {
    topNav: ['Dashboard', 'Customers'],
    mobileBottomTabs: ['Dashboard', 'Customers', 'Billing'],
    drawerExtras: ['Billing'],
  },
};

// Feature flags per role
export const ROLE_FEATURES = {
  admin: {
    canSync: true,
    canManageIntegrations: true,
    canManageUsers: true,
    canAccessLootIT: true,
    canEditCustomers: true,
    canInviteUsers: true,
    canViewAdminland: true,
  },
  sales: {
    canSync: false,
    canManageIntegrations: false,
    canManageUsers: false,
    canAccessLootIT: false,
    canEditCustomers: false,
    canInviteUsers: false,
    canViewAdminland: false,
  },
  user: {
    canSync: false,
    canManageIntegrations: false,
    canManageUsers: false,
    canAccessLootIT: false,
    canEditCustomers: false,
    canInviteUsers: false,
    canViewAdminland: false,
  },
};

/**
 * Check if a role can access a given page.
 */
export function canAccessPage(role, pageName) {
  if (role === 'admin') return true;
  const allowed = ROLE_ALLOWED_PAGES[role];
  return allowed ? allowed.has(pageName) : false;
}

/**
 * Get feature flags for a role.
 */
export function getFeatures(role) {
  return ROLE_FEATURES[role] || ROLE_FEATURES.user;
}
