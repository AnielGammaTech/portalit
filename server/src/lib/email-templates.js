/**
 * Email templates for PortalIT invitations and OTP verification.
 * Used by /api/users/invite and /api/users/send-otp endpoints.
 */

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #f8fafc;
  padding: 40px 20px;
`;

const cardStyles = `
  max-width: 480px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
`;

const headerStyles = `
  background: linear-gradient(135deg, #4C1D95, #5B21B6);
  padding: 32px 32px 24px;
  text-align: center;
`;

const otpBoxStyles = `
  background: #f1f5f9;
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  margin: 24px 0;
`;

const otpCodeStyles = `
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 8px;
  color: #1e293b;
  font-family: 'Courier New', monospace;
`;

const buttonStyles = `
  display: inline-block;
  background: linear-gradient(135deg, #4C1D95, #5B21B6);
  color: #ffffff;
  padding: 14px 32px;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
`;

function wrapTemplate(content) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="${baseStyles}">
  <div style="${cardStyles}">
    <div style="${headerStyles}">
      <div style="font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
        Portal<span style="color: #C4B5FD;">IT</span>
      </div>
    </div>
    <div style="padding: 32px;">
      ${content}
    </div>
    <div style="padding: 16px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Welcome email sent when an admin invites a new user.
 * Contains a link to the accept-invite page.
 */
export function welcomeEmailTemplate({ firstName, inviteUrl, invitedBy, customerName, role }) {
  const greeting = firstName || 'there';

  let contextLine = '';
  if (customerName) {
    contextLine = `You've been invited to access the <strong>${customerName}</strong> portal on PortalIT.`;
  } else if (role) {
    const roleLabel = role === 'admin' ? 'Administrator' : role === 'sales' ? 'Sales' : 'Team Member';
    contextLine = `You've been invited to join PortalIT as a <strong>${roleLabel}</strong>.`;
  } else {
    contextLine = `You've been invited to join PortalIT.`;
  }

  const invitedByLine = invitedBy
    ? `<p style="color: #94a3b8; font-size: 13px; margin: 16px 0 0;">Invited by ${invitedBy}</p>`
    : '';

  return wrapTemplate(`
    <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 8px;">
      Hi ${greeting}, you're invited!
    </h2>
    <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
      ${contextLine}
      Click the button below to activate your account.
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${inviteUrl}" style="${buttonStyles}">
        Activate Your Account
      </a>
    </div>

    <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
      Or copy and paste this link into your browser:<br/>
      <a href="${inviteUrl}" style="color: #7C3AED; word-break: break-all;">${inviteUrl}</a>
    </p>
    ${invitedByLine}
  `);
}

/**
 * OTP verification email sent when a user requests a code on the accept-invite page.
 * Contains the 6-digit verification code.
 */
export function otpEmailTemplate({ code, firstName }) {
  const greeting = firstName || 'there';

  return wrapTemplate(`
    <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 8px;">
      Your verification code
    </h2>
    <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
      Hi ${greeting}, use the code below to verify your email and activate your account.
    </p>

    <div style="${otpBoxStyles}">
      <p style="color: #64748b; font-size: 13px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">
        Verification code
      </p>
      <div style="${otpCodeStyles}">${code}</div>
    </div>

    <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
      This code expires in 10 minutes. If you didn't request this code, you can safely ignore this email.
    </p>
  `);
}
