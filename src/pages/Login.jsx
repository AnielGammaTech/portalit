import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, KeyRound, Shield, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isCustomerPortal, CUSTOMER_PORTAL_URL } from '@/lib/portal-mode';

// Floating orb component for animated background
function FloatingOrb({ className, delay = 0 }) {
  return (
    <motion.div
      className={cn('absolute rounded-full blur-3xl opacity-30', className)}
      animate={{
        y: [0, -30, 0],
        x: [0, 15, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
    />
  );
}

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

  // On the full portal, show portal chooser if customer portal URL is configured
  const showPortalChooser = !isCustomerPortal && !!CUSTOMER_PORTAL_URL;
  const [portalChosen, setPortalChosen] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Signed in successfully');
      if (returnUrl) {
        window.location.href = returnUrl;
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
    <div className="min-h-screen relative overflow-hidden flex">
      {/* Left panel — Decorative branding */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-gradient-to-br from-primary via-primary/90 to-[#7828C8] items-center justify-center p-12">
        {/* Background orbs */}
        <FloatingOrb className="w-72 h-72 bg-white/20 top-20 left-10" delay={0} />
        <FloatingOrb className="w-96 h-96 bg-[#7828C8]/40 bottom-20 right-10" delay={2} />
        <FloatingOrb className="w-64 h-64 bg-sky-300/30 top-1/2 left-1/3" delay={4} />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 max-w-lg"
        >
          {/* Logo mark */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-[14px] bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <span className="text-2xl font-black text-white tracking-tighter">P</span>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">PortalIT</span>
          </div>

          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Your IT operations,{' '}
            <span className="text-white/80">unified.</span>
          </h2>
          <p className="text-lg text-white/70 leading-relaxed mb-10">
            Manage devices, contracts, invoices, and integrations — all from a single, modern dashboard.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {['Datto RMM', 'HaloPSA', 'Spanning', 'JumpCloud', 'RocketCyber'].map((tag, i) => (
              <motion.div
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
                className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium text-white/90"
              >
                {tag}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right panel — Login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-zinc-50 dark:bg-zinc-950 relative">
        {/* Subtle background gradient for right panel */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-[#7828C8]/[0.02]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative z-10 w-full max-w-[400px]"
        >
          {/* Mobile logo (only shows on small screens) */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-[14px] bg-primary flex items-center justify-center">
              <span className="text-xl font-black text-white tracking-tighter">P</span>
            </div>
            <span className="text-2xl font-bold text-foreground tracking-tight">PortalIT</span>
          </div>

          {/* Header text */}
          <div className="mb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={isResetMode ? 'reset' : showPortalChooser && !portalChosen ? 'chooser' : 'login'}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-3xl font-bold text-foreground tracking-tight">
                  {isResetMode ? 'Reset password' : showPortalChooser && !portalChosen ? 'Welcome to PortalIT' : 'Welcome back'}
                </h1>
                <p className="text-muted-foreground mt-2 text-[15px]">
                  {isResetMode
                    ? 'Enter your email and we\'ll send you a reset link.'
                    : showPortalChooser && !portalChosen
                    ? 'Select how you\'d like to sign in.'
                    : 'Sign in to your PortalIT account to continue.'}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Portal Chooser */}
          {showPortalChooser && !portalChosen ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              <button
                onClick={() => setPortalChosen(true)}
                className="w-full bg-card rounded-[20px] shadow-hero-lg border-2 border-border/60 hover:border-primary/50 p-6 text-left transition-all duration-200 hover:shadow-xl group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-[15px]">Staff &amp; Admin</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage customers, integrations, and settings</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </div>
              </button>

              <button
                onClick={() => { window.location.href = `${CUSTOMER_PORTAL_URL}/login`; }}
                className="w-full bg-card rounded-[20px] shadow-hero-lg border-2 border-border/60 hover:border-[#7828C8]/50 p-6 text-left transition-all duration-200 hover:shadow-xl group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#7828C8]/10 flex items-center justify-center shrink-0 group-hover:bg-[#7828C8]/15 transition-colors">
                    <Building2 className="w-6 h-6 text-[#7828C8]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-[15px]">Customer Portal</p>
                    <p className="text-sm text-muted-foreground mt-0.5">View your services, billing, and support</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-[#7828C8] transition-colors shrink-0" />
                </div>
              </button>
            </motion.div>
          ) : (
          <>
          {/* Form card */}
          <div className="bg-card rounded-[20px] shadow-hero-lg border border-border/60 p-7">
            <form onSubmit={isResetMode ? handleResetPassword : handleLogin} className="space-y-5">
              {/* Email field */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email address
                </label>
                <div className="relative group">
                  <div className={cn(
                    'absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200',
                    focusedField === 'email' ? 'text-primary' : 'text-muted-foreground/50'
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
                    className="h-12 pl-11 rounded-hero-lg bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-[15px]"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password field */}
              <AnimatePresence mode="wait">
                {!isResetMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <label htmlFor="password" className="text-sm font-medium text-foreground">
                      Password
                    </label>
                    <div className="relative group">
                      <div className={cn(
                        'absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200',
                        focusedField === 'password' ? 'text-primary' : 'text-muted-foreground/50'
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
                        className="h-12 pl-11 pr-11 rounded-hero-lg bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-[15px]"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors duration-200"
                      >
                        {showPassword
                          ? <EyeOff className="w-[18px] h-[18px]" />
                          : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>

                    {/* Forgot password link — inline */}
                    <div className="flex justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => setIsResetMode(true)}
                        className="text-xs text-primary hover:text-primary/80 font-medium transition-colors duration-200"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit button */}
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-hero-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[15px] shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-[250ms] gap-2 group"
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

            {/* Back to sign in (when in reset mode) */}
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
                    className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors duration-200"
                  >
                    ← Back to sign in
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Back to portal chooser */}
          {showPortalChooser && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setPortalChosen(false)}
                className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors duration-200"
              >
                ← Back to portal selection
              </button>
            </div>
          )}
          </>
          )}

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-muted-foreground/60">
            Powered by{' '}
            <span className="font-semibold text-muted-foreground/80">Gamma Technology Solutions</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
