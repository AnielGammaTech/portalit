import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { 
  LayoutDashboard, 
  Building2,
  FileText, 
  HelpCircle,
  Settings, 
  Cloud,
  ChevronDown,
  LogOut,
  Bell,
  Users,
  DollarSign
} from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import FloatingAdminland from './components/admin/FloatingAdminland';
import AwaitingAccess from './pages/AwaitingAccess';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch portal settings
  const { data: portalSettingsData = [] } = useQuery({
    queryKey: ['portal_settings'],
    queryFn: () => base44.entities.PortalSettings.list(),
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });
  
  const portalSettings = portalSettingsData[0] || {};

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setIsAdmin(currentUser?.role === 'admin');
        
        // For non-admin users, use customer_id from user profile
        if (currentUser?.role !== 'admin' && currentUser?.customer_id) {
          const allCustomers = await base44.entities.Customer.list();
          const userCustomer = allCustomers.find(c => c.id === currentUser.customer_id);
          if (userCustomer) {
            setCustomer(userCustomer);
          }
        }
      } catch (error) {
        console.error('Failed to load data', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Block access for non-admin users without customer_id
  if (user && !isAdmin && !user.customer_id) {
    return <AwaitingAccess user={user} />;
  }

  // Admin navigation (MSP view)
      const adminNavigation = [
                { name: 'Loot', page: 'Loot', icon: DollarSign },
                { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
                { name: 'Customers', page: 'Customers', icon: Building2 },
                { name: 'Services', page: 'Services', icon: Cloud },
              ];

  // Customer navigation (end-user view) - uses customer_id from user profile
  // Goes directly to CustomerDetail with their customer ID
  const customerNavigation = [
    { name: 'My Account', page: 'CustomerDetail', icon: FileText, query: user?.customer_id ? `?id=${user.customer_id}` : '' },
  ];

  // For non-admin users, redirect Dashboard to CustomerDetail
  if (!isAdmin && user?.customer_id && currentPageName === 'Dashboard') {
    window.location.href = createPageUrl(`CustomerDetail?id=${user.customer_id}`);
    return null;
  }

  const navigation = isAdmin ? adminNavigation : customerNavigation;

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        :root {
          --color-primary: ${portalSettings.primary_color || '#8b5cf6'};
          --color-accent: ${portalSettings.primary_color || '#8b5cf6'};
          --color-accent-hover: ${portalSettings.primary_color || '#7c3aed'};
        }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between h-16 px-6 max-w-7xl mx-auto">
          {/* Logo & Company */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {portalSettings.show_logo_always && portalSettings.logo_url ? (
                <img 
                  src={portalSettings.logo_url} 
                  alt={portalSettings.portal_name || 'Portal'} 
                  className="h-10 object-contain max-w-[160px]"
                />
              ) : (
                <>
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: portalSettings.primary_color || '#8b5cf6' }}
                  >
                    {portalSettings.logo_url ? (
                      <img src={portalSettings.logo_url} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <Cloud className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-slate-900">
                      {isAdmin ? (portalSettings.portal_name || 'PortalIT') : 'Client Portal'}
                    </h1>
                    {!isAdmin && customer && (
                      <p className="text-xs text-slate-500">{customer.name}</p>
                    )}
                    {isAdmin && (
                      <p className="text-xs font-medium" style={{ color: portalSettings.primary_color || '#8b5cf6' }}>MSP Admin</p>
                    )}
                  </div>
                </>
              )}
              {portalSettings.show_logo_always && (
                <div className="ml-2">
                  {!isAdmin && customer && (
                    <p className="text-xs text-slate-500">{customer.name}</p>
                  )}
                  {isAdmin && (
                    <p className="text-xs font-medium" style={{ color: portalSettings.primary_color || '#8b5cf6' }}>MSP Admin</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = currentPageName === item.page || 
                (item.page === 'CustomerDetail' && currentPageName === 'CustomerDetail');
              return (
                <Link
                  key={item.page + (item.query || '')}
                  to={createPageUrl(item.page) + (item.query || '')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive 
                      ? "bg-purple-100 text-purple-700" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-slate-500" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-medium",
                    isAdmin ? "bg-purple-600 text-white" : "bg-purple-100 text-purple-700"
                  )}>
                    {user?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-slate-900">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500">
                      {isAdmin ? 'Administrator' : customer?.name || user?.email}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl('Settings')} className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => base44.auth.logout()}
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

      {/* Page content */}
      <main className="p-6 lg:p-8 max-w-7xl mx-auto">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            {isAdmin ? '© 2024 PortalIT - MSP Management' : 'Need help? Contact your IT provider'}
          </p>
          {!isAdmin && (
            <div className="flex items-center gap-4">
              <a href="tel:" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                Call Support
              </a>
              <span className="text-slate-300">|</span>
              <a href="mailto:" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                Email Support
              </a>
            </div>
          )}
        </div>
      </footer>

      {/* Floating Adminland - Only for admins */}
      <FloatingAdminland />
    </div>
  );
}