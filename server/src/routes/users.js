import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../middleware/auth.js';
import { getServiceSupabase } from '../lib/supabase.js';
import { sendEmail } from '../lib/email.js';
import { customerInviteTemplate, techInviteTemplate } from '../lib/email-templates.js';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getPortalUrl(req) {
  // Use FRONTEND_URL env var or derive from request origin
  return process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
}

// ── POST /api/users/invite ─────────────────────────────────────────────

router.post('/invite', requireAdmin, async (req, res, next) => {
  try {
    const { email, role, invite_type, customer_id } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    if (!invite_type || !['customer', 'tech'].includes(invite_type)) {
      return res.status(400).json({ error: 'invite_type must be "customer" or "tech"' });
    }
    if (invite_type === 'customer' && !customer_id) {
      return res.status(400).json({ error: 'customer_id is required for customer invitations' });
    }
    if (invite_type === 'tech' && !['admin', 'sales'].includes(role)) {
      return res.status(400).json({ error: 'role must be "admin" or "sales" for tech invitations' });
    }

    const finalRole = invite_type === 'customer' ? 'user' : role;
    const supabase = getServiceSupabase();

    // Check if user already exists in auth
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    // Create auth user (email not confirmed) or reuse existing
    let authUserId;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
    });

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        // Reuse existing auth user — happens when a previous invite partially failed
        const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
        const existing = authUsers?.find(u => u.email === email);
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

    // Generate OTP and hash it
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);

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

    // Create invitation record
    const { error: inviteError } = await supabase
      .from('user_invitations')
      .insert({
        email,
        role: finalRole,
        invite_type,
        customer_id: invite_type === 'customer' ? customer_id : null,
        otp_hash: otpHash,
        auth_user_id: authUserId,
        status: 'pending',
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        created_by: req.user?.id || null,
      });

    if (inviteError) {
      console.error('Failed to create invitation:', inviteError);
      // Clean up: delete the auth user we just created
      await supabase.auth.admin.deleteUser(authUserId);
      return res.status(500).json({ error: 'Failed to create invitation record' });
    }

    // Create or update user profile row
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        auth_id: authUserId,
        email,
        role: finalRole,
        full_name: '',
        customer_id: invite_type === 'customer' ? customer_id : null,
        customer_name: customerName,
      }, { onConflict: 'auth_id' });

    if (profileError) {
      console.error('Failed to create user profile:', profileError);
    }

    // Send invitation email via Resend
    const portalUrl = getPortalUrl(req);

    const emailHtml = invite_type === 'customer'
      ? customerInviteTemplate({ otp, portalUrl, companyName: customerName })
      : techInviteTemplate({ otp, portalUrl, role: finalRole });

    const emailSubject = invite_type === 'customer'
      ? `You've been invited to ${customerName || 'PortalIT'}`
      : `Welcome to the PortalIT team`;

    try {
      await sendEmail({
        to: email,
        subject: emailSubject,
        body: emailHtml,
      });
    } catch (emailErr) {
      console.error('Failed to send invitation email:', emailErr);
      // Don't fail the whole request — invitation is created, email can be resent
    }

    res.json({
      success: true,
      user: { id: authUserId, email },
      message: 'Invitation sent successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/users/verify-otp ─────────────────────────────────────────

router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'email and otp are required' });
    }

    const supabase = getServiceSupabase();

    // Find pending invitation
    const { data: invitations, error: lookupError } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('email', email)
      .eq('status', 'pending')
      .order('created_date', { ascending: false })
      .limit(1);

    if (lookupError || !invitations || invitations.length === 0) {
      return res.status(404).json({ error: 'No pending invitation found for this email' });
    }

    const invitation = invitations[0];

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from('user_invitations')
        .update({ status: 'expired', updated_date: new Date().toISOString() })
        .eq('id', invitation.id);
      return res.status(410).json({ error: 'This invitation has expired. Please request a new one.' });
    }

    // Verify OTP
    const isValid = await bcrypt.compare(otp, invitation.otp_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    // Confirm email in Supabase Auth
    if (invitation.auth_user_id) {
      const { error: confirmError } = await supabase.auth.admin.updateUserById(
        invitation.auth_user_id,
        { email_confirm: true }
      );
      if (confirmError) {
        console.error('Failed to confirm email:', confirmError);
      }
    }

    // Generate a short-lived token for the set-password step
    const otpToken = await bcrypt.hash(`${email}:${Date.now()}`, 8);

    // Store token temporarily on the invitation
    await supabase
      .from('user_invitations')
      .update({
        status: 'accepted',
        otp_hash: await bcrypt.hash(otpToken, 10),
        updated_date: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    res.json({
      success: true,
      otp_token: otpToken,
      message: 'Email verified successfully. Please set your password.',
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/users/set-password ───────────────────────────────────────

router.post('/set-password', async (req, res, next) => {
  try {
    const { email, password, otp_token } = req.body;

    if (!email || !password || !otp_token) {
      return res.status(400).json({ error: 'email, password, and otp_token are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const supabase = getServiceSupabase();

    // Find the accepted invitation
    const { data: invitations } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('email', email)
      .eq('status', 'accepted')
      .order('updated_date', { ascending: false })
      .limit(1);

    if (!invitations || invitations.length === 0) {
      return res.status(404).json({ error: 'No verified invitation found. Please verify your email first.' });
    }

    const invitation = invitations[0];

    // Verify the otp_token
    const isValidToken = await bcrypt.compare(otp_token, invitation.otp_hash);
    if (!isValidToken) {
      return res.status(401).json({ error: 'Invalid or expired session. Please verify your email again.' });
    }

    // Set password in Supabase Auth
    if (invitation.auth_user_id) {
      const { error: pwError } = await supabase.auth.admin.updateUserById(
        invitation.auth_user_id,
        { password }
      );

      if (pwError) {
        return res.status(500).json({ error: 'Failed to set password: ' + pwError.message });
      }
    }

    // Clear the otp_hash so the token can't be reused
    await supabase
      .from('user_invitations')
      .update({
        otp_hash: 'used',
        updated_date: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    res.json({
      success: true,
      message: 'Password set successfully. You can now sign in.',
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/users/resend-invite ──────────────────────────────────────

router.post('/resend-invite', requireAdmin, async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const supabase = getServiceSupabase();

    // Find the most recent invitation
    const { data: invitations } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('email', email)
      .order('created_date', { ascending: false })
      .limit(1);

    if (!invitations || invitations.length === 0) {
      return res.status(404).json({ error: 'No invitation found for this email' });
    }

    const invitation = invitations[0];

    // Generate new OTP
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);

    // Update invitation with new OTP and expiry
    await supabase
      .from('user_invitations')
      .update({
        otp_hash: otpHash,
        status: 'pending',
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        updated_date: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    // Look up customer name
    let customerName = null;
    if (invitation.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('name')
        .eq('id', invitation.customer_id)
        .single();
      customerName = customer?.name || null;
    }

    // Re-send email
    const portalUrl = getPortalUrl(req);
    const emailHtml = invitation.invite_type === 'customer'
      ? customerInviteTemplate({ otp, portalUrl, companyName: customerName })
      : techInviteTemplate({ otp, portalUrl, role: invitation.role });

    await sendEmail({
      to: email,
      subject: 'Your PortalIT invitation code',
      body: emailHtml,
    });

    res.json({ success: true, message: 'Invitation resent successfully' });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/users/email-status ────────────────────────────────────────
// Health check for Resend configuration

router.get('/email-status', requireAdmin, async (_req, res) => {
  const hasResendKey = !!process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || 'PortalIT <noreply@portalit.app>';

  res.json({
    configured: hasResendKey,
    from: emailFrom,
  });
});

export { router as usersRouter };
