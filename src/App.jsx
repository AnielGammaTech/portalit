import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/client';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import WrongPortalMessage from '@/components/WrongPortalMessage';
import Login from '@/pages/Login';
import AcceptInvite from '@/pages/AcceptInvite';
import { Shimmer } from '@/components/ui/shimmer-skeleton';
import {
  isCustomerPortal,
  isFullPortal,
  CUSTOMER_ALLOWED_PAGES,
  CUSTOMER_PORTAL_MAIN_PAGE,
  CUSTOMER_PORTAL_URL,
} from '@/lib/portal-mode';
import { canAccessPage } from '@/lib/permissions';

const { Pages: AllPages, Layout, mainPage } = pagesConfig;

// Pages accessible to customer portal users only — no admin role required
const CUSTOMER_ONLY_PAGES = CUSTOMER_ALLOWED_PAGES;

function ExternalRedirect({ to }) {
  React.useEffect(() => {
    if (to) window.location.replace(to);
  }, [to]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      <p className="text-sm text-slate-500">Redirecting...</p>
    </div>
  );
}

/**
 * Route-level access enforcement.
 * Staff roles are checked against page permissions, and customer users are
 * moved to the isolated customer portal service when that URL is configured.
 */
const RequirePageAccess = ({ pageName, children }) => {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'sales';

  if (!isStaff) {
    return CUSTOMER_PORTAL_URL
      ? <ExternalRedirect to={CUSTOMER_PORTAL_URL} />
      : <Navigate to="/AwaitingAccess" replace />;
  }

  if (!canAccessPage(user?.role, pageName)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// In customer portal mode, only register allowed pages
const Pages = isCustomerPortal
  ? Object.fromEntries(
      Object.entries(AllPages).filter(([key]) => CUSTOMER_ALLOWED_PAGES.has(key))
    )
  : AllPages;

const mainPageKey = isCustomerPortal
  ? CUSTOMER_PORTAL_MAIN_PAGE
  : (mainPage ?? Object.keys(Pages)[0]);

const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const PAGE_LABELS = {
  Adminland: 'Adminland',
  Analytics: 'Analytics',
  Billing: 'Billing',
  Contracts: 'Contracts',
  CustomerDetail: 'Customer account',
  CustomerPortalPreview: 'Customer preview',
  CustomerSettings: 'Customer settings',
  Customers: 'Customers',
  Dashboard: 'Dashboard',
  Integrations: 'Integrations',
  LicenseDetail: 'License details',
  SaaSReports: 'SaaS reports',
  Services: 'Services',
  Settings: 'Settings',
  SpendAnalysis: 'Spend analysis',
};

function PageLoadingSkeleton({ pageName }) {
  const label = PAGE_LABELS[pageName] || 'PortalIT';

  return (
    <div className="space-y-5 rounded-2xl bg-slate-50/95 p-1">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shimmer className="h-8 w-8 rounded-lg" />
            <div>
              <p className="text-sm font-semibold text-slate-700">Loading {label}</p>
              <p className="text-xs text-slate-400">Preparing the latest portal data</p>
            </div>
          </div>
        </div>
        <Shimmer className="hidden h-9 w-28 rounded-lg sm:block" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Shimmer className="h-3 w-20 rounded-md" />
            <Shimmer className="mt-3 h-7 w-16 rounded-md" />
            <Shimmer className="mt-2 h-3 w-28 rounded-md" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <Shimmer className="h-5 w-44 rounded-md" />
          <Shimmer className="mt-2 h-3 w-64 max-w-full rounded-md" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[minmax(160px,1fr)_120px_100px] gap-4 px-4 py-3">
              <div className="flex items-center gap-3">
                <Shimmer className="h-9 w-9 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Shimmer className="h-4 w-36 rounded-md" />
                  <Shimmer className="h-3 w-52 max-w-full rounded-md" />
                </div>
              </div>
              <Shimmer className="h-5 w-24 self-center rounded-full" />
              <Shimmer className="h-4 w-16 self-center justify-self-end rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RouteDataLoadingBoundary({ children, currentPageName }) {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;
  const [showLoader, setShowLoader] = React.useState(true);

  React.useEffect(() => {
    setShowLoader(true);
    const timer = window.setTimeout(() => {
      setShowLoader(false);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [routeKey]);

  return (
    <div className="relative min-h-[60vh]">
      <div className={showLoader ? 'pointer-events-none select-none opacity-0' : 'opacity-100'}>
        {children}
      </div>
      {showLoader && (
        <div className="absolute inset-0 z-20">
          <PageLoadingSkeleton pageName={currentPageName} />
        </div>
      )}
    </div>
  );
}

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>
    <ErrorBoundary>
      <RouteDataLoadingBoundary currentPageName={currentPageName}>{children}</RouteDataLoadingBoundary>
    </ErrorBoundary>
  </Layout>
  : (
    <ErrorBoundary>
      <RouteDataLoadingBoundary currentPageName={currentPageName}>{children}</RouteDataLoadingBoundary>
    </ErrorBoundary>
  );


const AuthenticatedApp = () => {
  const { isAuthenticated, isLoadingAuth, authError, authRetrying, user } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        {authRetrying && (
          <p className="text-sm text-slate-500 animate-pulse">Reconnecting...</p>
        )}
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  // Block staff users (admin/sales) on the customer portal
  if (isCustomerPortal && (user?.role === 'admin' || user?.role === 'sales')) {
    return <WrongPortalMessage user={user} />;
  }

  if (isFullPortal && user?.role === 'user' && CUSTOMER_PORTAL_URL) {
    return <ExternalRedirect to={CUSTOMER_PORTAL_URL} />;
  }

  // Render the main app (full portal mode — admin/sales users)
  return (
    <Routes>
      <Route path="/" element={
        CUSTOMER_ONLY_PAGES.has(mainPageKey)
          ? <LayoutWrapper currentPageName={mainPageKey}><MainPage /></LayoutWrapper>
          : <RequirePageAccess pageName={mainPageKey}><LayoutWrapper currentPageName={mainPageKey}><MainPage /></LayoutWrapper></RequirePageAccess>
      } />
      {Object.entries(Pages).map(([path, Page]) => {
        const pageElement = (
          <LayoutWrapper currentPageName={path}>
            <Page />
          </LayoutWrapper>
        );
        const wrappedElement = CUSTOMER_ONLY_PAGES.has(path)
          ? pageElement
          : <RequirePageAccess pageName={path}>{pageElement}</RequirePageAccess>;

        return (
          <Route
            key={path}
            path={`/${path}`}
            element={wrappedElement}
          />
        );
      })}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


// Handles /auth-redirect#access_token=...&refresh_token=...
// Used when the main portal redirects a customer user here with their session
function AuthRedirect() {
  const navigate = useNavigate();
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error: sessionError }) => {
          if (sessionError) {
            setError('Session expired. Please log in again.');
          } else {
            // Clear the hash and navigate to home
            window.history.replaceState(null, '', '/');
            navigate('/', { replace: true });
          }
        });
    } else {
      setError('Invalid login link. Please log in again.');
    }
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">{error}</p>
          <a href="/login" className="text-sm text-primary hover:underline">Go to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth-redirect" element={<AuthRedirect />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="*" element={
              <ErrorBoundary>
                <NavigationTracker />
                <AuthenticatedApp />
              </ErrorBoundary>
            } />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
