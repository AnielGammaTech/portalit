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

/**
 * Mask an IP address for safe logging — retains only the first two octets.
 * e.g. "192.168.1.42" → "192.168.x.x"
 * IPv6 addresses are truncated to the first segment.
 */
function maskIp(ip) {
  if (!ip || typeof ip !== 'string') return '[unknown-ip]';
  // IPv4
  const v4parts = ip.split('.');
  if (v4parts.length === 4) {
    return `${v4parts[0]}.${v4parts[1]}.x.x`;
  }
  // IPv6 — show only the first group
  const v6parts = ip.split(':');
  if (v6parts.length > 1) {
    return `${v6parts[0]}:****`;
  }
  return '[ip]';
}

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email) && email.length <= 254;
}

function sanitizeName(name) {
  if (typeof name !== 'string') return '';
  // Strip HTML tags and trim whitespace
  return name.replace(/<[^>]*>/g, '').trim().slice(0, 200);
}

function sanitizeOptionalUrl(value, fieldName) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    const err = new Error(`${fieldName} must be a string`);
    err.status = 400;
    throw err;
  }

  const trimmed = value.trim();
  if (trimmed.length > 2048) {
    const err = new Error(`${fieldName} is too long`);
    err.status = 400;
    throw err;
  }

  if (trimmed.startsWith('/api/upload/file/')) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return trimmed;
  } catch {
    // Fall through to the uniform validation error below.
  }

  const err = new Error(`${fieldName} must be an http(s) URL or uploaded file URL`);
  err.status = 400;
  throw err;
}

async function ensureAnotherAdminExists(supabase, targetUserId) {
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin')
    .neq('id', targetUserId);

  if (error) throw new Error(error.message);
  return (count || 0) > 0;
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

async function findAuthUserByEmail(supabase, lowerEmail) {
  let page = 1;
  while (true) {
    const { data: { users = [] } = {}, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);
    const match = users.find(user => user.email === lowerEmail);
    if (match) return match;
    if (users.length < 100) return null;
    page += 1;
  }
}

async function upsertUserProfile(supabase, payload) {
  const { data, error } = await supabase
    .from('users')
    .upsert(payload, { onConflict: 'auth_id', ignoreDuplicates: false })
    .select('id, auth_id, email, full_name, role, customer_id, customer_name')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function sendInviteEmail({ to, firstName, invitedBy, customerName, role }) {
  const portalUrl = getPortalUrl();
  const inviteUrl = `${portalUrl}/accept-invite?email=${encodeURIComponent(to)}`;
  return sendEmail({
    to,
    subject: `You're invited to PortalIT — Activate your account`,
    body: welcomeEmailTemplate({
      firstName,
      inviteUrl,
      invitedBy,
      customerName,
      role,
    }),
  });
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

    // Clean up orphaned user record if it exists without auth_id.
    // Ignore errors here — a concurrent request may have already cleaned it up,
    // and the upsert below will handle any remaining conflict gracefully.
    if (existingUsers && existingUsers.length > 0 && !existingUsers[0].auth_id) {
      await supabase.from('users').delete().eq('id', existingUsers[0].id).then(() => null, () => null);
    }

    // Create user in Supabase Auth with email_confirm: true
    const tempPassword = `TempInvite_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let authUserId;
    let authUserWasCreated = false;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: lowerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name, role: finalRole },
    });

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        const existing = await findAuthUserByEmail(supabase, lowerEmail);
        if (!existing) {
          return res.status(409).json({ error: 'A user with this email already exists but could not be found' });
        }
        authUserId = existing.id;
      } else {
        return res.status(400).json({ error: authError.message });
      }
    } else {
      authUserId = authData.user.id;
      authUserWasCreated = true;
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

    let profile;
    try {
      profile = await upsertUserProfile(supabase, {
        auth_id: authUserId,
        email: lowerEmail,
        role: finalRole,
        full_name,
        customer_id: invite_type === 'customer' ? customer_id : null,
        customer_name: customerName,
      });
    } catch (profileError) {
      console.error('Failed to create user profile:', profileError.message);
      if (authUserWasCreated && authUserId) {
        await supabase.auth.admin.deleteUser(authUserId).then(() => null, () => null);
      }
      return res.status(500).json({ error: 'Invitation could not be created. Please try again.' });
    }

    // Send welcome email via Resend
    let emailSent = true;
    let emailError = null;
    try {
      await sendInviteEmail({
        to: lowerEmail,
        firstName: full_name.split(' ')[0],
        invitedBy: req.user?.email,
        customerName: invite_type === 'customer' ? customerName : null,
        role: invite_type === 'tech' ? finalRole : null,
      });
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr.message);
      emailSent = false;
      emailError = emailErr.message;
    }

    res.json({
      success: true,
      email_sent: emailSent,
      email_error: emailError,
      user: { id: profile.id, auth_id: authUserId, email: lowerEmail },
      message: emailSent
        ? 'Invitation sent successfully'
        : 'User was created, but the invitation email could not be delivered',
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
      console.warn(`OTP send rate limit exceeded for ${maskEmail(lowerEmail)} from IP ${maskIp(req.ip)}`);
      res.set('Retry-After', String(emailLimit.retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many code requests for this email. Please try again later.',
      });
    }

    const supabase = getServiceSupabase();

    const { data: users, error: userLookupError } = await supabase
      .from('users')
      .select('id, full_name, auth_id')
      .eq('email', lowerEmail)
      .limit(1);

    if (userLookupError) {
      return res.status(500).json({ error: 'Could not verify invitation. Please try again.' });
    }

    if (!users || users.length === 0) {
      const authUser = await findAuthUserByEmail(supabase, lowerEmail);
      if (authUser) {
        return res.status(409).json({
          error: 'This account exists but is not attached to a PortalIT invitation. Ask your PortalIT admin to resend the invite.',
        });
      }
      return res.status(404).json({
        error: 'No PortalIT invitation was found for this email. Ask your PortalIT admin to send an invite.',
      });
    }

    const code = generateOtp();
    otpStore.set(lowerEmail, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
    cleanExpiredOtps();

    console.log(`OTP sent to ${maskEmail(lowerEmail)} from IP ${maskIp(req.ip)}`);

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
      console.warn(`OTP verify rate limit exceeded for ${maskEmail(lowerEmail)} from IP ${maskIp(req.ip)}`);
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
      console.warn(`Invalid OTP attempt for ${maskEmail(lowerEmail)} from IP ${maskIp(req.ip)}`);
      return res.status(400).json({ error: 'Invalid code. Please check and try again.' });
    }

    // Code is valid — consume it
    otpStore.delete(lowerEmail);
    console.log(`OTP verified for ${maskEmail(lowerEmail)} from IP ${maskIp(req.ip)}`);

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
      .select('id, full_name, role, customer_id, customer_name')
      .eq('email', lowerEmail)
      .limit(1);

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await sendInviteEmail({
      to: lowerEmail,
      firstName: users[0].full_name?.split(' ')[0] || 'there',
      invitedBy: req.user?.email,
      customerName: users[0].role === 'user' ? users[0].customer_name : null,
      role: users[0].role !== 'user' ? users[0].role : null,
    });

    res.json({ success: true, email: lowerEmail });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/users/reset-password ────────────────────────────────────

const resetPasswordLimiter = createRateLimiter({
  storeId: 'reset-password',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many password reset attempts. Please try again later.',
});

router.post('/reset-password', requireAdmin, resetPasswordLimiter, async (req, res, next) => {
  try {
    const { user_id, new_password } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const supabase = getServiceSupabase();

    // Look up the user's auth_id
    const { data: profile } = await supabase
      .from('users')
      .select('auth_id, email, full_name')
      .eq('id', user_id)
      .single();

    if (!profile || !profile.auth_id) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (new_password) {
      // Direct password set by admin
      if (new_password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const { error } = await supabase.auth.admin.updateUserById(profile.auth_id, {
        password: new_password,
      });
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true, method: 'direct', email: profile.email });
    } else {
      // Send password reset email via Supabase
      const portalUrl = getPortalUrl();
      const { error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: profile.email,
        options: { redirectTo: `${portalUrl}/login` },
      });
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true, method: 'email', email: profile.email });
    }
  } catch (error) {
    next(error);
  }
});

// ── GET /api/users/auth-details ───────────────────────────────────────

router.get('/auth-details', requireAdmin, async (_req, res, next) => {
  try {
    const supabase = getServiceSupabase();

    // Fetch all auth users with pagination (API returns max 100 per page)
    let allUsers = [];
    let page = 1;
    while (true) {
      const { data: { users: pageUsers }, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      allUsers = allUsers.concat(pageUsers);
      if (pageUsers.length < 100) break;
      page++;
    }

    const details = {};
    for (const user of allUsers) {
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

// ── PATCH /api/users/:id ─────────────────────────────────────────────
// Admin-only profile and access updates with server-side validation/audit.

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const supabase = getServiceSupabase();

    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('id, auth_id, email, full_name, role, customer_id, customer_name, avatar_url')
      .eq('id', id)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = {};
    const allowedKeys = new Set(['full_name', 'avatar_url', 'role', 'customer_id']);
    const rejectedKeys = Object.keys(req.body || {}).filter(key => !allowedKeys.has(key) && key !== 'customer_name');
    if (rejectedKeys.length > 0) {
      return res.status(400).json({ error: `Unsupported user update fields: ${rejectedKeys.join(', ')}` });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'full_name')) {
      updates.full_name = sanitizeName(req.body.full_name);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'avatar_url')) {
      updates.avatar_url = sanitizeOptionalUrl(req.body.avatar_url, 'avatar_url');
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'role')) {
      if (!VALID_ROLES.includes(req.body.role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
      }
      if (req.user?.id === id && req.body.role !== 'admin') {
        return res.status(400).json({ error: 'You cannot remove your own admin role' });
      }
      if (existing.role === 'admin' && req.body.role !== 'admin') {
        const hasAnotherAdmin = await ensureAnotherAdminExists(supabase, id);
        if (!hasAnotherAdmin) {
          return res.status(400).json({ error: 'Cannot remove the last admin account' });
        }
      }
      updates.role = req.body.role;
    }

    const finalRole = updates.role || existing.role || 'user';
    if (finalRole !== 'user') {
      updates.customer_id = null;
      updates.customer_name = null;
    } else if (Object.prototype.hasOwnProperty.call(req.body, 'customer_id')) {
      const customerId = req.body.customer_id === 'none' || req.body.customer_id === '' ? null : req.body.customer_id;
      if (customerId) {
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('id, name')
          .eq('id', customerId)
          .single();
        if (customerError || !customer) {
          return res.status(400).json({ error: 'Invalid customer_id: customer not found' });
        }
        updates.customer_id = customer.id;
        updates.customer_name = customer.name || null;
      } else {
        updates.customer_id = null;
        updates.customer_name = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No supported fields provided' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, auth_id, email, full_name, role, customer_id, customer_name, avatar_url')
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    if (existing.auth_id && (updates.full_name !== undefined || updates.role !== undefined)) {
      await supabase.auth.admin.updateUserById(existing.auth_id, {
        user_metadata: {
          full_name: updated.full_name || '',
          role: updated.role || 'user',
        },
      }).then(() => null, (authError) => {
        console.warn(`[Users] Auth metadata update failed for ${maskEmail(existing.email)}:`, authError.message);
      });
    }

    await supabase.from('user_audit_log').insert({
      actor_id: req.user?.id || null,
      action: 'update',
      target_user_id: id,
      target_email: existing.email,
      details: {
        updated_fields: Object.keys(updates),
        previous_role: existing.role,
        next_role: updated.role,
        updated_by: req.user?.email,
      },
    }).then(() => null, () => null);

    res.json({ success: true, user: updated });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/users/:id/sign-ins ──────────────────────────────────────

router.get('/:id/sign-ins', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Allow admins to view any user's sign-ins; non-admins may only view their own
    const isAdmin = req.user?.role === 'admin';
    const isSelf = req.user?.id === id || req.user?.auth_id === id;
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

// ── DELETE /api/users/:id ─────────────────────────────────────────────
// Full user deletion: removes both profile AND Supabase Auth record

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const supabase = getServiceSupabase();

    // Prevent self-deletion
    if (req.user?.id === id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Get auth_id before deleting profile
    const { data: profile } = await supabase
      .from('users')
      .select('auth_id, email, full_name, role')
      .eq('id', id)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (profile.role === 'admin') {
      return res.status(400).json({ error: 'Admin accounts cannot be deleted from Adminland' });
    }

    // Log the deletion for audit
    await supabase.from('user_audit_log').insert({
      actor_id: req.user?.id || null,
      action: 'delete',
      target_user_id: id,
      target_email: profile.email,
      details: { full_name: profile.full_name, deleted_by: req.user?.email },
    }).then(() => null, () => null); // don't fail if audit table missing

    // Delete profile first
    const { error: profileErr } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (profileErr) {
      return res.status(500).json({ error: profileErr.message });
    }

    // Then delete auth record (cleanup)
    if (profile.auth_id) {
      const { error: authErr } = await supabase.auth.admin.deleteUser(profile.auth_id);
      if (authErr) {
        console.error(`[Users] Auth cleanup failed for ${maskEmail(profile.email)}:`, authErr.message);
        // Profile already deleted — log but don't fail the request
      }
    }

    res.json({ success: true, message: `User ${maskEmail(profile.email)} deleted` });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/users/:id/suspend ──────────────────────────────────────
// Suspend a user (ban in Supabase Auth) without deleting

router.post('/:id/suspend', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const supabase = getServiceSupabase();

    if (req.user?.id === id) {
      return res.status(400).json({ error: 'You cannot suspend your own account' });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('auth_id, email, full_name, role')
      .eq('id', id)
      .single();

    if (!profile || !profile.auth_id) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (profile.role === 'admin') {
      return res.status(400).json({ error: 'Admin accounts cannot be suspended from Adminland' });
    }

    // Ban the user in Supabase Auth (prevents login)
    const { error: banErr } = await supabase.auth.admin.updateUserById(profile.auth_id, {
      ban_duration: '876000h', // ~100 years = effectively permanent until unsuspended
    });

    if (banErr) {
      return res.status(500).json({ error: banErr.message });
    }

    // Audit log
    await supabase.from('user_audit_log').insert({
      actor_id: req.user?.id || null,
      action: 'suspend',
      target_user_id: id,
      target_email: profile.email,
      details: { suspended_by: req.user?.email },
    }).then(() => null, () => null);

    res.json({ success: true, email: profile.email, message: `${profile.full_name} suspended` });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/users/:id/unsuspend ────────────────────────────────────
// Reactivate a suspended user

router.post('/:id/unsuspend', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const supabase = getServiceSupabase();

    const { data: profile } = await supabase
      .from('users')
      .select('auth_id, email, full_name')
      .eq('id', id)
      .single();

    if (!profile || !profile.auth_id) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Unban the user
    const { error: unbanErr } = await supabase.auth.admin.updateUserById(profile.auth_id, {
      ban_duration: 'none',
    });

    if (unbanErr) {
      return res.status(500).json({ error: unbanErr.message });
    }

    // Audit log
    await supabase.from('user_audit_log').insert({
      actor_id: req.user?.id || null,
      action: 'unsuspend',
      target_user_id: id,
      target_email: profile.email,
      details: { unsuspended_by: req.user?.email },
    }).then(() => null, () => null);

    res.json({ success: true, email: profile.email, message: `${profile.full_name} reactivated` });
  } catch (error) {
    next(error);
  }
});

export { router as usersRouter };
