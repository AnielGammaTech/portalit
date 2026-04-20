import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/client';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import WrongPortalMessage from '@/components/WrongPortalMessage';
import Login from '@/pages/Login';
import AcceptInvite from '@/pages/AcceptInvite';
import {
  isCustomerPortal,
  isFullPortal,
  CUSTOMER_ALLOWED_PAGES,
  CUSTOMER_PORTAL_MAIN_PAGE,
  CUSTOMER_PORTAL_URL,
} from '@/lib/portal-mode';

const { Pages: AllPages, Layout, mainPage } = pagesConfig;

// Pages accessible to customer portal users only — no admin role required
const CUSTOMER_ONLY_PAGES = CUSTOMER_ALLOWED_PAGES;

/**
 * H-1: Route-level role enforcement.
 * Wraps admin/internal routes to ensure only admin or sales users can access them.
 * Customer portal users (role !== 'admin' && role !== 'sales') are redirected to
 * the customer portal URL or the AwaitingAccess page.
 */
const RequireAdmin = ({ children }) => {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'sales';

  if (!isStaff) {
    const redirectTarget = CUSTOMER_PORTAL_URL || '/AwaitingAccess';
    return <Navigate to={redirectTarget} replace />;
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

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}><ErrorBoundary>{children}</ErrorBoundary></Layout>
  : <ErrorBoundary>{children}</ErrorBoundary>;

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

  // Render the main app (full portal mode — admin/sales users)
  return (
    <Routes>
      <Route path="/" element={
        // H-1: Wrap the main page with admin enforcement if it is an admin-only page
        CUSTOMER_ONLY_PAGES.has(mainPageKey)
          ? <LayoutWrapper currentPageName={mainPageKey}><MainPage /></LayoutWrapper>
          : <RequireAdmin><LayoutWrapper currentPageName={mainPageKey}><MainPage /></LayoutWrapper></RequireAdmin>
      } />
      {Object.entries(Pages).map(([path, Page]) => {
        // H-1: Wrap admin/internal pages with role enforcement.
        // Pages in CUSTOMER_ONLY_PAGES (CustomerDetail, CustomerSettings, AwaitingAccess)
        // are accessible without admin role; all others require admin or sales.
        const pageElement = (
          <LayoutWrapper currentPageName={path}>
            <Page />
          </LayoutWrapper>
        );
        const wrappedElement = CUSTOMER_ONLY_PAGES.has(path)
          ? pageElement
          : <RequireAdmin>{pageElement}</RequireAdmin>;

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
