import React, { useState, useEffect } from 'react';
import { client } from '@/api/client';
import { createPageUrl } from '../utils';
import { Settings as SettingsIcon, Shield } from 'lucide-react';

/**
 * Settings.jsx - Route handler that redirects admins to the unified
 * Adminland settings page and shows CustomerSettings for customers.
 *
 * Admin users:  redirect to /Adminland?tab=<tab> (preserves ?tab= param)
 * Customer users: redirect to /CustomerSettings (their own portal settings)
 */
export default function Settings() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const redirect = async () => {
      try {
        const user = await client.auth.me();

        if (user?.role === 'admin') {
          // Carry over any ?tab= query param so deep-links keep working
          const urlParams = new URLSearchParams(window.location.search);
          const tab = urlParams.get('tab');

          // Map legacy tab names that existed in old Settings page
          const legacyMap = {
            integrations: 'integrations',
            gammastack: 'api',
            company: 'branding',
            profile: 'branding',
            notifications: 'branding',
          };

          const resolvedTab = legacyMap[tab] || tab || 'branding';
          window.location.href = createPageUrl('Adminland') + `?tab=${resolvedTab}`;
        } else {
          // Non-admin users go to CustomerSettings
          window.location.href = createPageUrl('CustomerSettings');
        }
      } catch (error) {
        setIsLoading(false);
      }
    };

    redirect();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  // Fallback if redirect fails
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Redirecting...</h2>
        <p className="text-slate-500">
          If you are not redirected,{' '}
          <a href={createPageUrl('Dashboard')} className="text-purple-600 hover:underline">
            go to Dashboard
          </a>.
        </p>
      </div>
    </div>
  );
}
