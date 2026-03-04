import React, { useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/api/client';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

async function apiFetchPublic(path, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

/**
 * AcceptInvite — 3-step activation flow immune to email link scanners:
 * Step 1: Enter/confirm email → sends OTP code via Resend
 * Step 2: Enter 6-digit OTP code → verifies and establishes session
 * Step 3: Set password → activates account
 */
export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get('email') || '';

  const [step, setStep] = useState('email'); // email → otp → password
  const [email, setEmail] = useState(prefillEmail);
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const otpInputRef = useRef(null);

  // Step 1: Send OTP code to email via our API + Resend
  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiFetchPublic('/api/users/send-otp', { email: email.toLowerCase() });
      setStep('otp');
      setLoading(false);
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (err) {
      setError(err?.message || 'Failed to send verification code');
      setLoading(false);
    }
  };

  // Step 2: Verify OTP code via our API, then establish Supabase session
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await apiFetchPublic('/api/users/verify-otp', {
        email: email.toLowerCase(),
        code: otpCode.trim(),
      });

      if (result.token) {
        // Use the token to establish a Supabase session client-side
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: result.token,
          type: 'magiclink',
        });

        if (verifyError) {
          setError(verifyError.message || 'Session creation failed. Please try again.');
          setLoading(false);
          return;
        }

        if (data?.session) {
          setStep('password');
          setLoading(false);
          return;
        }
      }

      setError('Verification failed. Please try again.');
      setLoading(false);
    } catch (err) {
      setError(err?.message || 'Invalid code. Please try again.');
      setLoading(false);
    }
  };

  // Step 3: Set password
  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message || 'Failed to set password');
        setLoading(false);
        return;
      }

      // Password set — navigate to app
      navigate('/', { replace: true });
    } catch (err) {
      setError('Could not connect to server');
      setLoading(false);
    }
  };

  // Resend code via our API
  const handleResendCode = async () => {
    setError('');
    setLoading(true);
    try {
      await apiFetchPublic('/api/users/send-otp', { email: email.toLowerCase() });
    } catch (err) {
      setError(err?.message || 'Failed to resend code');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">
            Portal<span className="text-purple-600">IT</span>
          </h1>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6 mt-3">
            <div className={`w-2 h-2 rounded-full ${step === 'email' ? 'bg-purple-600' : 'bg-purple-200'}`} />
            <div className={`w-8 h-0.5 ${step !== 'email' ? 'bg-purple-400' : 'bg-slate-200'}`} />
            <div className={`w-2 h-2 rounded-full ${step === 'otp' ? 'bg-purple-600' : step === 'password' ? 'bg-purple-200' : 'bg-slate-200'}`} />
            <div className={`w-8 h-0.5 ${step === 'password' ? 'bg-purple-400' : 'bg-slate-200'}`} />
            <div className={`w-2 h-2 rounded-full ${step === 'password' ? 'bg-purple-600' : 'bg-slate-200'}`} />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 border border-red-200 mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Enter email */}
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <p className="text-slate-500 text-center text-sm mb-2">
                Enter your email to receive a verification code
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="you@company.com"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending code...' : 'Send verification code'}
              </button>
            </form>
          )}

          {/* Step 2: Enter OTP code */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <p className="text-slate-500 text-center text-sm mb-2">
                We sent a 6-digit code to <strong className="text-slate-700">{email}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Verification code</label>
                <input
                  ref={otpInputRef}
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3 py-3 border border-slate-300 rounded-lg text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify code'}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtpCode(''); setError(''); }}
                  className="text-slate-500 hover:text-slate-700"
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Set password */}
          {step === 'password' && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <p className="text-slate-500 text-center text-sm mb-2">
                Set your password to activate your account
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Repeat your password"
                  minLength={8}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Activating...' : 'Activate account'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-purple-600 hover:text-purple-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
