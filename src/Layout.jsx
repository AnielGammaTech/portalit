import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { client } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard,
  Building2,
  FileText,
  Settings,
  Cloud,
  ChevronDown,
  LogOut,
  Bell,
  Menu,
  CreditCard,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import FloatingAdminland from './components/admin/FloatingAdminland';
import FeedbackButton from './components/feedback/FeedbackButton';
import AwaitingAccess from './pages/AwaitingAccess';
import { isCustomerPortal } from '@/lib/portal-mode';

const DEFAULT_PRIMARY = '#7C3AED';

function getUserInitials(fullName, email) {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return 'U';
}

function NavItem({ item, isActive, primaryColor }) {
  const Icon = item.icon;
  return (
    <Link
      to={createPageUrl(item.page) + (item.query || '')}
      className={cn(
        "relative flex items-center gap-2 px-4 h-14 text-sm font-medium transition-colors",
        isActive
          ? "text-white"
          : "text-white/60 hover:text-white hover:bg-white/5"
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{item.name}</span>
      {isActive && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ backgroundColor: primaryColor }}
        />
      )}
    </Link>
  );
}

function MobileBottomTab({ item, isActive, primaryColor }) {
  const Icon = item.icon;
  return (
    <Link
      to={createPageUrl(item.page) + (item.query || '')}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[10px] font-medium transition-colors",
        isActive
          ? "text-slate-900"
          : "text-slate-400"
      )}
    >
      {isActive && (
        <span
          className="absolute top-0 left-2 right-2 h-0.5 rounded-full"
          style={{ backgroundColor: primaryColor }}
        />
      )}
      <Icon
        className="w-5 h-5"
        style={isActive ? { color: primaryColor } : undefined}
      />
      <span>{item.name}</span>
    </Link>
  );
}

function MobileDrawerNav({ navigation, currentPageName, primaryColor, user, isAdmin, customer, onClose }) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#1E1048' }}>
      {/* User info at top */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {getUserInitials(user?.full_name, user?.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">
              {user?.full_name || 'User'}
            </p>
            <p className="text-xs text-white/50 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <div className="mt-2">
          <span
            className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${primaryColor}20`,
              color: primaryColor,
            }}
          >
            {isAdmin ? 'Admin' : 'Customer'}
          </span>
        </div>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 p-3 space-y-1">
        {navigation.map((item) => {
          const isActive = currentPageName === item.page ||
            (item.page === 'CustomerDetail' && currentPageName === 'CustomerDetail');
          const Icon = item.icon;
          return (
            <SheetClose asChild key={item.page + (item.query || '')}>
              <Link
                to={createPageUrl(item.page) + (item.query || '')}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon
                  className="w-5 h-5"
                  style={isActive ? { color: primaryColor } : undefined}
                />
                <span>{item.name}</span>
                {isActive && (
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
              </Link>
            </SheetClose>
          );
        })}

        {/* Extra nav items in drawer for admin (hidden in customer portal mode) */}
        {isAdmin && !isCustomerPortal && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Management
              </p>
            </div>
            <SheetClose asChild>
              <Link
                to={createPageUrl('Billing')}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  currentPageName === 'Billing'
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                <CreditCard className="w-5 h-5" />
                <span>Billing</span>
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                to={createPageUrl('Settings')}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  currentPageName === 'Settings'
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Link>
            </SheetClose>
          </>
        )}
      </nav>

      {/* Sign out at bottom */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={() => client.auth.logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const { user, isLoadingAuth } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Fetch portal settings
  const { data: portalSettingsData = [] } = useQuery({
    queryKey: ['portal_settings'],
    queryFn: () => client.entities.PortalSettings.list(),
    staleTime: 1000 * 60 * 5,
  });

  const portalSettings = portalSettingsData[0] || {};
  const primaryColor = portalSettings.primary_color || DEFAULT_PRIMARY;

  // Fetch customer for non-admin users (uses stable customer_id from auth context)
  const { data: customer = null } = useQuery({
    queryKey: ['layout_customer', user?.customer_id],
    queryFn: async () => {
      const allCustomers = await client.entities.Customer.list();
      return allCustomers.find(c => c.id === user.customer_id) || null;
    },
    enabled: !!user && !isAdmin && !!user.customer_id,
    staleTime: 1000 * 60 * 10,
  });

  const isLoading = isLoadingAuth;

  // Navigation definitions
  const adminNavigation = useMemo(() => [
    { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
    { name: 'Customers', page: 'Customers', icon: Building2 },
    { name: 'Services', page: 'Services', icon: Cloud },
  ], []);

  const customerNavigation = useMemo(() => [
    {
      name: 'My Account',
      page: 'CustomerDetail',
      icon: FileText,
      query: user?.customer_id ? `?id=${user.customer_id}` : '',
    },
    { name: 'Settings', page: 'CustomerSettings', icon: Settings },
  ], [user?.customer_id]);

  // Admin mobile bottom tabs (5 items: 4 core + More)
  const adminBottomTabs = useMemo(() => [
    { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
    { name: 'Customers', page: 'Customers', icon: Building2 },
    { name: 'Services', page: 'Services', icon: Cloud },
    { name: 'Billing', page: 'Billing', icon: CreditCard },
  ], []);

  const navigation = (isAdmin && !isCustomerPortal) ? adminNavigation : customerNavigation;

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: primaryColor }}
        />
      </div>
    );
  }

  // Block access for non-admin users without customer_id
  if (user && !isAdmin && !user.customer_id) {
    return <AwaitingAccess user={user} />;
  }

  // For non-admin users, redirect Dashboard to CustomerDetail
  if (!isAdmin && user?.customer_id && currentPageName === 'Dashboard') {
    window.location.href = createPageUrl(`CustomerDetail?id=${user.customer_id}`);
    return null;
  }

  const userInitials = getUserInitials(user?.full_name, user?.email);

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        :root {
          --color-primary: ${primaryColor};
          --color-accent: ${primaryColor};
          --color-accent-hover: ${primaryColor};
        }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
      `}</style>

      {/* ─── Fixed Top Header ─── */}
      <header className="fixed top-0 left-0 right-0 h-14 text-white z-40" style={{ backgroundColor: '#1E1048' }}>
        <div className="flex items-center justify-between h-full px-4 sm:px-6 max-w-full">

          {/* Left: Mobile hamburger + Logo */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
              <SheetTrigger asChild>
                <button className="lg:hidden p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 border-0">
                <MobileDrawerNav
                  navigation={navigation}
                  currentPageName={currentPageName}
                  primaryColor={primaryColor}
                  user={user}
                  isAdmin={isAdmin}
                  customer={customer}
                  onClose={() => setMobileDrawerOpen(false)}
                />
              </SheetContent>
            </Sheet>

            {/* Logo / Portal name */}
            <Link to={createPageUrl((isAdmin && !isCustomerPortal) ? 'Dashboard' : 'CustomerDetail') + ((isAdmin && !isCustomerPortal) ? '' : `?id=${user?.customer_id || ''}`)} className="flex items-center gap-2.5">
              {portalSettings.logo_url ? (
                <img
                  src={portalSettings.logo_url}
                  alt={portalSettings.portal_name || 'Portal'}
                  className="h-7 object-contain max-w-[120px]"
                />
              ) : (
                <img
                  src="/favicon.svg"
                  alt="PortalIT"
                  className="h-7 w-7"
                />
              )}
              <span className="text-sm font-bold text-white hidden sm:block tracking-tight">
                {(isAdmin && !isCustomerPortal)
                  ? (portalSettings.portal_name || 'PortalIT')
                  : (customer?.name || 'Client Portal')}
              </span>
            </Link>
          </div>

          {/* Center: Desktop navigation */}
          <nav className="hidden lg:flex items-center h-full">
            {navigation.map((item) => {
              const isActive = currentPageName === item.page ||
                (item.page === 'CustomerDetail' && currentPageName === 'CustomerDetail');
              return (
                <NavItem
                  key={item.page + (item.query || '')}
                  item={item}
                  isActive={isActive}
                  primaryColor={primaryColor}
                />
              );
            })}
          </nav>

          {/* Right: Notifications + User dropdown */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button className="relative p-2 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition-colors">
              <Bell className="w-5 h-5" />
            </button>

            {/* User avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 pl-2 pr-1 py-1 rounded-lg hover:bg-white/5 transition-colors">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
                      isAdmin ? "text-white" : "bg-purple-100 text-purple-700"
                    )}
                    style={isAdmin ? { backgroundColor: primaryColor } : undefined}
                  >
                    {userInitials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-white leading-tight">
                      {user?.full_name || 'User'}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-white/40 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {/* User info header */}
                <div className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                        isAdmin ? "text-white" : "bg-purple-100 text-purple-700"
                      )}
                      style={isAdmin ? { backgroundColor: primaryColor } : undefined}
                    >
                      {userInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {user?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {user?.email}
                      </p>
                      <span
                        className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${primaryColor}15`,
                          color: primaryColor,
                        }}
                      >
                        {isAdmin ? 'Administrator' : 'Customer'}
                      </span>
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator />
                {!isCustomerPortal && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl('Settings')} className="cursor-pointer">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => client.auth.logout()}
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ─── Page Content ─── */}
      <main className="pt-14 pb-20 lg:pb-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* ─── Mobile Bottom Tab Bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 lg:hidden z-40">
        <div className="flex items-stretch h-14">
          {(isAdmin && !isCustomerPortal) ? (
            <>
              {adminBottomTabs.map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <MobileBottomTab
                    key={item.page}
                    item={item}
                    isActive={isActive}
                    primaryColor={primaryColor}
                  />
                );
              })}
              {/* More button opens drawer */}
              <button
                onClick={() => setMobileDrawerOpen(true)}
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[10px] font-medium text-slate-400"
              >
                <MoreHorizontal className="w-5 h-5" />
                <span>More</span>
              </button>
            </>
          ) : (
            customerNavigation.map((item) => {
              const isActive = currentPageName === item.page ||
                (item.page === 'CustomerDetail' && currentPageName === 'CustomerDetail');
              return (
                <MobileBottomTab
                  key={item.page + (item.query || '')}
                  item={item}
                  isActive={isActive}
                  primaryColor={primaryColor}
                />
              );
            })
          )}
        </div>
      </div>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-200 bg-white py-4 hidden lg:block">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs text-slate-400">
            {(isAdmin && !isCustomerPortal)
              ? `\u00A9 ${new Date().getFullYear()} ${portalSettings.portal_name || 'PortalIT'}`
              : 'Need help? Contact your IT provider.'}
          </p>
        </div>
      </footer>

      {/* ─── Floating Adminland Button (hidden in customer portal mode) ─── */}
      {!isCustomerPortal && <FloatingAdminland />}

      {/* ─── Feedback Button (non-admin only) ─── */}
      {!isAdmin && user && customer && (
        <FeedbackButton user={user} customer={customer} />
      )}
    </div>
  );
}
