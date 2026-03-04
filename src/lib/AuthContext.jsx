import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkUserAuth();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
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

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthError({
        type: 'auth_required',
        message: 'Authentication required',
      });
    } finally {
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
