import React from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, Clock, Mail, Phone, LogOut } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function AwaitingAccess({ user }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="w-10 h-10 text-amber-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Access Pending
          </h1>
          
          {/* Description */}
          <p className="text-slate-600 mb-6">
            Your account has been created successfully, but you haven't been assigned to an organization yet.
          </p>

          {/* Status Card */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Account Status</p>
                <p className="text-xs text-amber-600 font-medium">Awaiting Organization Assignment</p>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Logged in as</p>
            <p className="font-medium text-slate-900">{user?.full_name || 'User'}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>

          {/* Contact Section */}
          <div className="border-t border-slate-200 pt-6 mb-6">
            <p className="text-sm text-slate-600 mb-4">
              Please contact your IT provider to complete your account setup.
            </p>
            
            <div className="space-y-3">
              <a 
                href="mailto:help@gamma.tech" 
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
              >
                <Mail className="w-4 h-4" />
                Contact Support
              </a>
              
              <a 
                href="tel:+12393304939" 
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
              >
                <Phone className="w-4 h-4" />
                Call Support
              </a>
            </div>
          </div>

          {/* Logout */}
          <Button 
            variant="ghost" 
            onClick={() => base44.auth.logout()}
            className="text-slate-500 hover:text-slate-700"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Your security is our priority. Access is granted only after verification.
        </p>
      </div>
    </div>
  );
}