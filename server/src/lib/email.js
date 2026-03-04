import { Resend } from 'resend';

let resendClient = null;

function getResend() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendEmail({ to, subject, body }) {
  const resend = getResend();

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'PortalIT <noreply@portalit.app>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html: body,
  });

  if (error) {
    console.error('Email send error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return { success: true };
}
