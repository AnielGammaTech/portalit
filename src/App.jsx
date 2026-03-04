import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import WrongPortalMessage from '@/components/WrongPortalMessage';
import Login from '@/pages/Login';
import {
  isCustomerPortal,
  CUSTOMER_ALLOWED_PAGES,
  CUSTOMER_PORTAL_MAIN_PAGE,
} from '@/lib/portal-mode';

const { Pages: AllPages, Layout, mainPage } = pagesConfig;

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
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isAuthenticated, isLoadingAuth, authError, user } = useAuth();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
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

  // Block admin users on the customer portal
  if (isCustomerPortal && user?.role === 'admin') {
    return <WrongPortalMessage user={user} />;
  }

  // In customer portal mode, redirect / to CustomerDetail with their customer_id
  if (isCustomerPortal && user?.customer_id) {
    return (
      <Routes>
        <Route path="/" element={
          <Navigate to={`/CustomerDetail?id=${user.customer_id}`} replace />
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    );
  }

  // Render the main app (full portal mode)
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={
              <>
                <NavigationTracker />
                <AuthenticatedApp />
              </>
            } />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
