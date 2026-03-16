import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/api/client';

const AuthContext = createContext();

// Race a promise against a timeout — rejects if the promise doesn't
// settle within `ms` milliseconds.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Auth check timed out')), ms)
    ),
  ]);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const initialCheckDone = useRef(false);

  useEffect(() => {
    checkUserAuth();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip SIGNED_IN during initial load — checkUserAuth handles it
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
      // Still set as authenticated even if profile fetch fails
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

      // 5-second timeout — if session check hangs (stale cookies,
      // network issues), stop waiting and send user to login.
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        5000
      );

      if (session?.user) {
        await withTimeout(loadUserProfile(session.user), 5000);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // On timeout, clear the stale session so the user
      // isn't stuck in a loop on next reload.
      if (error.message === 'Auth check timed out') {
        console.warn('Auth timed out — clearing stale session');
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
