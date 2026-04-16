import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/api/client';

const AuthContext = createContext();

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Auth check timed out')), ms)
    ),
  ]);
}

const MAX_AUTH_RETRIES = 3;
const AUTH_TIMEOUT_MS = 8000;
const PROFILE_TIMEOUT_MS = 5000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [authRetrying, setAuthRetrying] = useState(false);
  const initialCheckDone = useRef(false);
  const retryCount = useRef(0);

  useEffect(() => {
    checkUserAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user && initialCheckDone.current) {
          await loadUserProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authUser) => {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .single();

      const fullUser = {
        id: profile?.id || authUser.id,
        auth_id: authUser.id,
        email: authUser.email,
        full_name: profile?.full_name || '',
        role: profile?.role || 'user',
        customer_id: profile?.customer_id || null,
        customer_name: profile?.customer_name || null,
        ...profile,
      };

      setUser(fullUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      setUser({
        id: authUser.id,
        auth_id: authUser.id,
        email: authUser.email,
        role: 'user',
      });
      setIsAuthenticated(true);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_TIMEOUT_MS
      );

      if (session?.user) {
        await withTimeout(loadUserProfile(session.user), PROFILE_TIMEOUT_MS);
        retryCount.current = 0;
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);

      if (error.message === 'Auth check timed out' && retryCount.current < MAX_AUTH_RETRIES) {
        retryCount.current += 1;
        console.warn(`Auth timed out — retry ${retryCount.current}/${MAX_AUTH_RETRIES}`);
        setAuthRetrying(true);
        const backoff = Math.min(1000 * retryCount.current, 3000);
        await new Promise(r => setTimeout(r, backoff));
        setAuthRetrying(false);
        return checkUserAuth();
      }

      if (error.message === 'Auth check timed out') {
        console.warn('Auth retries exhausted — clearing session');
        await supabase.auth.signOut().catch(() => {});
        setAuthError(null);
      } else {
        setAuthError(error.message || 'Authentication failed');
      }
      setIsAuthenticated(false);
    } finally {
      initialCheckDone.current = true;
      setIsLoadingAuth(false);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    supabase.auth.signOut();

    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    window.location.href = `/login?returnUrl=${encodeURIComponent(window.location.href)}`;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      authRetrying,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
