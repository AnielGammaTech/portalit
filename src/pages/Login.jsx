import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, KeyRound, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CUSTOMER_PORTAL_URL } from '@/lib/portal-mode';

const PORTAL_ACCENT = '#7C3AED';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Check user role to determine routing
      const { data: profile } = await supabase
        .from('users')
        .select('role, customer_id')
        .eq('auth_id', authData.user.id)
        .single();

      const role = profile?.role || 'user';

      // Customer users → redirect to customer portal. The session is
      // already in the .gtools.io cookie (auth-storage.js D-21), so the
      // customer portal reads it automatically. No fragment handoff = no
      // refresh-token leak via bookmarks/history sync/referrer.
      if (role === 'user' && CUSTOMER_PORTAL_URL && authData.session) {
        toast.success('Redirecting to your portal...');
        window.location.href = `${CUSTOMER_PORTAL_URL}/`;
        return;
      }

      // Admin/sales → stay on main portal
      toast.success('Signed in successfully');
      // Only follow returnUrl if it's a same-origin relative path. Reject
      // protocol-relative ("//evil.com") and absolute URLs to avoid an
      // open-redirect phishing vector.
      const safeReturn = returnUrl
        && returnUrl.startsWith('/')
        && !returnUrl.startsWith('//')
        ? returnUrl
        : null;
      if (safeReturn) {
        navigate(safeReturn);
      } else {
        navigate('/');
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Password reset email sent. Check your inbox.');
      setIsResetMode(false);
    } catch (err) {
      toast.error('Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      <LoginHeroPanel />

      <div className="flex w-full flex-col bg-white lg:w-[45%]">
        <div className="flex flex-1 items-center justify-center px-8 py-10 sm:px-16">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md"
          >
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black text-white shadow-lg" style={{ background: PORTAL_ACCENT }}>
                P
              </div>
              <span className="text-xl font-bold tracking-tight text-[#0B2231]">Portal<span style={{ color: PORTAL_ACCENT }}>IT</span></span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={isResetMode ? 'reset' : 'login'}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
                className="mb-8"
              >
                <h1 className="text-3xl font-bold tracking-tight text-[#0B2231]">
                  {isResetMode ? 'Reset password' : 'Welcome back'}
                </h1>
                <p className="mt-2 text-[15px] text-slate-500">
                  {isResetMode
                    ? 'Enter your email and we will send you a reset link.'
                    : 'Sign in to pick up where you left off.'}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="rounded-[22px] border border-slate-200 bg-white p-7 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.45)]">
            <form onSubmit={isResetMode ? handleResetPassword : handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-semibold text-[#0B2231]">Email address</label>
                <div className="relative group">
                  <div className={cn(
                    'absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200',
                    focusedField === 'email' ? 'text-[#7C3AED]' : 'text-slate-400'
                  )}>
                    <Mail className="w-[18px] h-[18px]" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 text-[15px] text-[#0B2231] transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-[#7C3AED]/30"
                    autoComplete="email"
                  />
                </div>
              </div>

              <AnimatePresence mode="wait">
                {!isResetMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <label htmlFor="password" className="text-sm font-semibold text-[#0B2231]">Password</label>
                    <div className="relative group">
                      <div className={cn(
                        'absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200',
                        focusedField === 'password' ? 'text-[#7C3AED]' : 'text-slate-400'
                      )}>
                        <Lock className="w-[18px] h-[18px]" />
                      </div>
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 pr-11 text-[15px] text-[#0B2231] transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-[#7C3AED]/30"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 hover:text-[#0B2231]"
                      >
                        {showPassword
                          ? <EyeOff className="w-[18px] h-[18px]" />
                          : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>

                    <div className="flex justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => setIsResetMode(true)}
                        className="text-xs font-semibold text-[#7C3AED] transition-colors duration-200 hover:text-[#5B21B6]"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="group h-12 w-full gap-2 rounded-xl bg-[#0B2231] text-[15px] font-semibold text-white shadow-lg shadow-[#0B2231]/25 transition-all duration-200 hover:bg-[#163D57] hover:shadow-xl hover:shadow-[#0B2231]/25"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isResetMode ? (
                    <>
                      <KeyRound className="w-4 h-4" />
                      Send Reset Link
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </motion.div>
            </form>

            <AnimatePresence>
              {isResetMode && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 text-center"
                >
                  <button
                    type="button"
                    onClick={() => setIsResetMode(false)}
                    className="text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-[#0B2231]"
                  >
                    ← Back to sign in
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            Powered by{' '}
            <span className="font-semibold text-slate-500">Gamma Tech Services</span>
          </p>
        </motion.div>
      </div>
      </div>
    </div>
  );
}

function LoginHeroPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#0B2231] lg:flex lg:w-[55%]">
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#163D57] to-transparent opacity-90" />
      <div className="relative z-10 flex w-full flex-col justify-between p-14">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-xl font-black text-white shadow-xl">
            P
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Portal<span style={{ color: PORTAL_ACCENT }}>IT</span></span>
        </div>

        <div className="max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PORTAL_ACCENT }} />
            Client operations workspace
          </div>
          <h2 className="mb-5 text-[48px] font-extrabold leading-[1.05] tracking-tight text-white">
            Your IT operations,<br />
            <span style={{ color: PORTAL_ACCENT }}>unified.</span>
          </h2>
          <p className="max-w-md text-lg leading-relaxed text-slate-300">
            Billing, services, devices, Microsoft 365, and helpdesk requests in one clean portal.
          </p>

          <div className="mt-10 max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-[0_24px_70px_-28px_rgba(0,0,0,0.65)] backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                <ShieldCheck className="h-4 w-4" />
                Portal snapshot
              </div>
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">Live</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['106', 'Devices'],
                ['10', 'Services'],
                ['24/7', 'Coverage'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-2xl font-extrabold text-white">{value}</p>
                  <p className="mt-1 text-[11px] font-medium text-white/50">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {['HaloPSA', 'Datto RMM', 'CIPP', 'Spanning'].map(tag => (
                <span key={tag} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/75">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-white/40">Secure customer portal by Gamma Tech Services</p>
      </div>
    </div>
  );
}
