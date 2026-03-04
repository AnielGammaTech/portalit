/**
 * Email templates for user invitations via Resend.
 * Used by the /api/users/invite endpoint.
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
        This invitation expires in 72 hours. If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function customerInviteTemplate({ otp, portalUrl, companyName }) {
  return wrapTemplate(`
    <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 8px;">
      You've been invited!
    </h2>
    <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
      You've been invited to access the <strong>${companyName || 'your company'}</strong> portal on PortalIT. 
      Use the verification code below to activate your account.
    </p>

    <div style="${otpBoxStyles}">
      <p style="color: #64748b; font-size: 13px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">
        Your verification code
      </p>
      <div style="${otpCodeStyles}">${otp}</div>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${portalUrl}/accept-invite?email=${encodeURIComponent('')}" style="${buttonStyles}">
        Activate Your Account
      </a>
    </div>

    <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
      Or go to <a href="${portalUrl}/accept-invite" style="color: #7C3AED;">${portalUrl}/accept-invite</a> 
      and enter the code above.
    </p>
  `);
}

export function techInviteTemplate({ otp, portalUrl, role }) {
  const roleLabel = role === 'admin' ? 'Administrator' : role === 'sales' ? 'Sales' : 'Team Member';
  
  return wrapTemplate(`
    <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 8px;">
      Welcome to the team!
    </h2>
    <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
      You've been invited to join PortalIT as a <strong>${roleLabel}</strong>. 
      Use the verification code below to activate your account.
    </p>

    <div style="${otpBoxStyles}">
      <p style="color: #64748b; font-size: 13px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">
        Your verification code
      </p>
      <div style="${otpCodeStyles}">${otp}</div>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${portalUrl}/accept-invite" style="${buttonStyles}">
        Activate Your Account
      </a>
    </div>

    <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
      Or go to <a href="${portalUrl}/accept-invite" style="color: #7C3AED;">${portalUrl}/accept-invite</a> 
      and enter the code above.
    </p>
  `);
}
