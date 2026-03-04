import React from 'react';
import { client } from '@/api/client';
import { ShieldX, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WrongPortalMessage({ user }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <ShieldX className="w-10 h-10 text-red-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Customer Portal Only
          </h1>

          {/* Description */}
          <p className="text-slate-600 mb-6">
            This portal is exclusively for customer access. Administrator accounts
            cannot sign in here.
          </p>

          {/* User Info */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
              Signed in as
            </p>
            <p className="font-medium text-slate-900">
              {user?.full_name || 'Admin User'}
            </p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>

          {/* Instructions */}
          <p className="text-sm text-slate-500 mb-6">
            Please sign out and use the main admin portal to manage your organization.
          </p>

          {/* Logout */}
          <Button
            onClick={() => client.auth.logout('/login')}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
