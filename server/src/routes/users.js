import { Router } from 'express';
import crypto from 'crypto';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limit.js';
import { getServiceSupabase } from '../lib/supabase.js';
import { sendEmail, isEmailConfigured } from '../lib/email.js';
import { welcomeEmailTemplate, otpEmailTemplate } from '../lib/email-templates.js';

const router = Router();

// ── Input validation helpers ─────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ['admin', 'sales', 'user'];

// ── Security helpers ──────────────────────────────────────────────────

/**
 * Mask an email address for safe logging.
 * e.g. "aniel@example.com" → "an***@example.com"
 */
function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '[invalid-email]';
  const [local, domain] = email.split('@');
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email) && email.length <= 254;
}

function sanitizeName(name) {
  if (typeof name !== 'string') return '';
  // Strip HTML tags and trim whitespace
  return name.replace(/<[^>]*>/g, '').trim().slice(0, 200);
}

// ── In-memory OTP store (codes expire after 10 minutes) ──────────────

const otpStore = new Map(); // email → { code, expiresAt }

// ── OTP rate limiting stores ─────────────────────────────────────────
// email → { count, resetAt } for send and verify separately
const otpSendLimits = new Map();   // max 5 per email per hour
const otpVerifyLimits = new Map(); // max 10 per email per hour

const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;   // 1 hour
const OTP_SEND_MAX = 5;
const OTP_VERIFY_WINDOW_MS = 60 * 60 * 1000;  // 1 hour
const OTP_VERIFY_MAX = 10;

function checkEmailRateLimit(store, email, windowMs, max) {
  const now = Date.now();
  const entry = store.get(email);

  if (!entry || now > entry.resetAt) {
    store.set(email, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= max) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  store.set(email, { ...entry, count: entry.count + 1 });
  return { allowed: true };
}

// IP-based brute force rate limiters for OTP endpoints
const otpSendIpLimiter = createRateLimiter({
  storeId: 'otp-send-ip',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: 'Too many OTP requests from this IP. Please try again later.',
});

const otpVerifyIpLimiter = createRateLimiter({
  storeId: 'otp-verify-ip',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: 'Too many verification attempts from this IP. Please try again later.',
});

function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

function cleanExpiredOtps() {
  const now = Date.now();
  for (const [key, val] of otpStore) {
    if (val.expiresAt < now) otpStore.delete(key);
  }
  for (const [key, val] of otpSendLimits) {
    if (now > val.resetAt) otpSendLimits.delete(key);
  }
  for (const [key, val] of otpVerifyLimits) {
    if (now > val.resetAt) otpVerifyLimits.delete(key);
  }
}

function getPortalUrl() {
  if (!process.env.FRONTEND_URL) {
    throw new Error('FRONTEND_URL environment variable is required');
  }
  return process.env.FRONTEND_URL;
}

// ── POST /api/users/invite ─────────────────────────────────────────────

router.post('/invite', requireAdmin, async (req, res, next) => {
  try {
    const { email, role, invite_type, customer_id } = req.body;
    const full_name = sanitizeName(req.body.full_name);

    if (!email || !full_name) {
      return res.status(400).json({ error: 'Email and full name are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!invite_type || !['customer', 'tech'].includes(invite_type)) {
      return res.status(400).json({ error: 'invite_type must be "customer" or "tech"' });
    }
    if (invite_type === 'customer' && !customer_id) {
      return res.status(400).json({ error: 'customer_id is required for customer invitations' });
    }
    if (invite_type === 'customer' && customer_id) {
      const supabaseCheck = getServiceSupabase();
      const { data: customerCheck, error: customerCheckError } = await supabaseCheck
        .from('customers')
        .select('id')
        .eq('id', customer_id)
        .single();
      if (customerCheckError || !customerCheck) {
        return res.status(400).json({ error: 'Invalid customer_id: customer not found' });
      }
    }
    if (invite_type === 'tech' && !['admin', 'sales'].includes(role)) {
      return res.status(400).json({ error: 'role must be "admin" or "sales" for tech invitations' });
    }
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const finalRole = invite_type === 'customer' ? 'user' : role;
    const lowerEmail = email.toLowerCase();
    const supabase = getServiceSupabase();

    // Check if user already exists
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id, email, auth_id')
      .eq('email', lowerEmail)
      .limit(1);

    if (existingUsers && existingUsers.length > 0 && existingUsers[0].auth_id) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    // Clean up orphaned user record if it exists without auth_id
    if (existingUsers && existingUsers.length > 0 && !existingUsers[0].auth_id) {
      await supabase.from('users').delete().eq('id', existingUsers[0].id);
    }

    // Create user in Supabase Auth with email_confirm: true
    const tempPassword = `TempInvite_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let authUserId;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: lowerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name, role: finalRole },
    });

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
        const existing = authUsers?.find(u => u.email === lowerEmail);
        if (!existing) {
          return res.status(409).json({ error: 'A user with this email already exists but could not be found' });
        }
        authUserId = existing.id;
      } else {
        return res.status(400).json({ error: authError.message });
      }
    } else {
      authUserId = authData.user.id;
    }

    // Look up customer name if customer invite
    let customerName = null;
    if (invite_type === 'customer' && customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('name')
        .eq('id', customer_id)
        .single();
      customerName = customer?.name || null;
    }

    // Create or update user profile row
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        auth_id: authUserId,
        email: lowerEmail,
        role: finalRole,
        full_name,
        customer_id: invite_type === 'customer' ? customer_id : null,
        customer_name: customerName,
      }, { onConflict: 'auth_id' });

    if (profileError) {
      console.error('Failed to create user profile:', profileError);
    }

    // Send welcome email via Resend
    const portalUrl = getPortalUrl();
    const inviteUrl = `${portalUrl}/accept-invite?email=${encodeURIComponent(lowerEmail)}`;

    try {
      await sendEmail({
        to: lowerEmail,
        subject: `You're invited to PortalIT — Activate your account`,
        body: welcomeEmailTemplate({
          firstName: full_name.split(' ')[0],
          inviteUrl,
          invitedBy: req.user?.email,
          customerName: invite_type === 'customer' ? customerName : null,
          role: invite_type === 'tech' ? finalRole : null,
        }),
      });
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr.message);
    }

    res.json({
      success: true,
      user: { id: authUserId, email: lowerEmail },
      message: 'Invitation sent successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/users/send-otp ───────────────────────────────────────────

router.post('/send-otp', otpSendIpLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const lowerEmail = email.toLowerCase();

    // Per-email rate limit: max 5 OTP sends per hour
    const emailLimit = checkEmailRateLimit(
      otpSendLimits, lowerEmail, OTP_SEND_WINDOW_MS, OTP_SEND_MAX
    );
    if (!emailLimit.allowed) {
      console.warn(`OTP send rate limit exceeded for ${maskEmail(lowerEmail)} from IP ${req.ip}`);
      res.set('Retry-After', String(emailLimit.retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many code requests for this email. Please try again later.',
      });
    }

    const supabase = getServiceSupabase();

    const { data: users } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('email', lowerEmail)
      .limit(1);

    if (!users || users.length === 0) {
      // Return generic success to prevent email enumeration
      return res.json({ success: true, email: lowerEmail });
    }

    const code = generateOtp();
    otpStore.set(lowerEmail, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
    cleanExpiredOtps();

    console.log(`OTP sent to ${maskEmail(lowerEmail)} from IP ${req.ip}`);

    const firstName = users[0].full_name?.split(' ')[0] || 'there';

    try {
      await sendEmail({
        to: lowerEmail,
        subject: `${code} — Your PortalIT verification code`,
        body: otpEmailTemplate({ code, firstName }),
      });
    } catch (emailErr) {
      console.error('Failed to send OTP email:', emailErr.message);
      return res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
    }

    res.json({ success: true, email: lowerEmail });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/users/verify-otp ─────────────────────────────────────────

router.post('/verify-otp', otpVerifyIpLimiter, async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const lowerEmail = email.toLowerCase();

    // Per-email rate limit: max 10 verify attempts per hour
    const emailLimit = checkEmailRateLimit(
      otpVerifyLimits, lowerEmail, OTP_VERIFY_WINDOW_MS, OTP_VERIFY_MAX
    );
    if (!emailLimit.allowed) {
      console.warn(`OTP verify rate limit exceeded for ${maskEmail(lowerEmail)} from IP ${req.ip}`);
      res.set('Retry-After', String(emailLimit.retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many verification attempts. Please try again later.',
      });
    }

    const stored = otpStore.get(lowerEmail);

    if (!stored) {
      return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(lowerEmail);
      return res.status(400).json({ error: 'Code has expired. Please request a new one.' });
    }
    if (stored.code !== String(code).trim()) {
      console.warn(`Invalid OTP attempt for ${maskEmail(lowerEmail)} from IP ${req.ip}`);
      return res.status(400).json({ error: 'Invalid code. Please check and try again.' });
    }

    // Code is valid — consume it
    otpStore.delete(lowerEmail);
    console.log(`OTP verified for ${maskEmail(lowerEmail)} from IP ${req.ip}`);

    const supabase = getServiceSupabase();

    // Generate a magic link token (server-side only, not emailed)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: lowerEmail,
    });

    if (linkError) {
      console.error('Magic link generation failed:', linkError);
      return res.status(500).json({ error: 'Could not create session' });
    }

    const hashedToken = linkData?.properties?.hashed_token;
    if (!hashedToken) {
      return res.status(500).json({ error: 'Could not generate auth token' });
    }

    res.json({ success: true, token: hashedToken, email: lowerEmail });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/users/resend-invite ──────────────────────────────────────

router.post('/resend-invite', requireAdmin, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const lowerEmail = email.toLowerCase();
    const supabase = getServiceSupabase();

    const { data: users } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('email', lowerEmail)
      .limit(1);

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const portalUrl = getPortalUrl();
    const inviteUrl = `${portalUrl}/accept-invite?email=${encodeURIComponent(lowerEmail)}`;

    await sendEmail({
      to: lowerEmail,
      subject: `You're invited to PortalIT — Activate your account`,
      body: welcomeEmailTemplate({
        firstName: users[0].full_name?.split(' ')[0] || 'there',
        inviteUrl,
        invitedBy: req.user?.email,
      }),
    });

    res.json({ success: true, email: lowerEmail });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/users/auth-details ───────────────────────────────────────

router.get('/auth-details', requireAdmin, async (_req, res, next) => {
  try {
    const supabase = getServiceSupabase();
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 100 });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const details = {};
    for (const user of users) {
      details[user.id] = {
        last_sign_in_at: user.last_sign_in_at || null,
        created_at: user.created_at,
        email_confirmed_at: user.email_confirmed_at || null,
        invited_at: user.invited_at || null,
        banned_until: user.banned_until || null,
        provider: user.app_metadata?.provider || 'email',
        providers: user.app_metadata?.providers || ['email'],
      };
    }

    res.json({ details });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/users/email-status ────────────────────────────────────────
// NOTE: Must be before /:id routes to avoid matching "email-status" as :id

router.get('/email-status', requireAdmin, async (_req, res) => {
  // Only expose whether email is configured — never return SMTP settings or sender details
  res.json({
    configured: isEmailConfigured(),
  });
});

// ── GET /api/users/:id/sign-ins ──────────────────────────────────────

router.get('/:id/sign-ins', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Allow admins to view any user's sign-ins; non-admins may only view their own
    const isAdmin = req.user?.role === 'admin';
    const isSelf = req.user?.id === id;
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Forbidden: you can only view your own sign-in history' });
    }

    const supabase = getServiceSupabase();

    const { data, error } = await supabase.rpc('get_user_sign_ins', {
      user_uuid: id,
      max_entries: 20,
    });

    if (error) {
      // Gracefully handle missing database function
      if (error.message?.includes('Could not find the function')) {
        return res.json({ sessions: [], hint: 'Run the SQL migration: supabase/migrations/003_add_sign_in_tracking.sql' });
      }
      console.error('Error fetching sign-ins:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ sessions: data || [] });
  } catch (error) {
    next(error);
  }
});

export { router as usersRouter };
