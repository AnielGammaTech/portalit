import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Mail, CheckCircle, AlertCircle, Send, Loader2 } from 'lucide-react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

export default function ResendEmailConfig() {
  const [testEmail, setTestEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { data: emailStatus, isLoading } = useQuery({
    queryKey: ['email-status'],
    queryFn: async () => {
      const token = (await client.auth.me()) && (await (await import('@/api/client')).supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${apiBaseUrl}/api/users/email-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch email status');
      return res.json();
    },
  });

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error('Please enter an email address');
      return;
    }
    setIsSending(true);
    try {
      // We'll use the invite endpoint logic for a test email
      toast.success('Test email functionality will be available once Resend API key is configured on Railway');
    } catch (error) {
      toast.error('Failed to send test email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
            <Mail className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Resend Email</h2>
            <p className="text-sm text-slate-500">Email delivery service for invitations and notifications</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Checking configuration...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50">
              {emailStatus?.configured ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-900">Connected</p>
                    <p className="text-sm text-slate-500">Resend API key is configured</p>
                  </div>
                  <Badge className="ml-auto bg-green-100 text-green-700 border-green-200">● Active</Badge>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-900">Not Configured</p>
                    <p className="text-sm text-slate-500">Set RESEND_API_KEY on the backend service in Railway</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-amber-600 border-amber-200">● Missing</Badge>
                </>
              )}
            </div>

            {emailStatus && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">From Address</p>
                  <p className="font-mono text-sm text-slate-900">{emailStatus.from}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Provider</p>
                  <p className="font-mono text-sm text-slate-900">Resend API</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test Email */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-1">Send Test Email</h3>
        <p className="text-sm text-slate-500 mb-4">Verify your email configuration by sending a test message</p>
        <div className="flex gap-3">
          <Input
            type="email"
            placeholder="test@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={handleSendTest}
            disabled={isSending || !emailStatus?.configured}
            className="gap-2"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Test
          </Button>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Setup Guide
        </h3>
        <ol className="text-sm text-amber-800 space-y-2 list-decimal list-inside">
          <li>Create a free account at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">resend.com</a></li>
          <li>Add and verify your sending domain</li>
          <li>Generate an API key from the Resend dashboard</li>
          <li>Set the <code className="bg-amber-100 px-1 rounded">RESEND_API_KEY</code> environment variable on the PortalIT backend service in Railway</li>
          <li>Optionally set <code className="bg-amber-100 px-1 rounded">EMAIL_FROM</code> (defaults to <code className="bg-amber-100 px-1 rounded">PortalIT &lt;noreply@portalit.app&gt;</code>)</li>
        </ol>
      </div>
    </div>
  );
}
