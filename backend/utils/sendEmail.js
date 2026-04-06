const nodemailer = require('nodemailer');
const {
  buildResetPasswordHtml,
  buildResetPasswordText,
  getLogoAttachment,
  EMAIL_LOGO_CID,
} = require('./emailTemplates');

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * Sends password reset email. If SMTP is not configured, returns { sent: false }
 * so the caller can log the link for local development.
 *
 * Inbox avatar (purple circle with “S” in Gmail): NOT set by this app — Gmail
 * builds it from the sender address. To show your glass mark instead:
 *   • Gravatar: create an account with the exact EMAIL_FROM address, upload
 *     backend/assets/logo-email.png (square crop ~512px) as the profile image.
 *   • Or set a profile photo on the Google/Microsoft account used to send SMTP.
 *   • BIMI (optional, domain-wide) for certified brand logos in some clients.
 */
async function sendPasswordResetEmail({ to, resetUrl, name }) {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  const displayName = name ? String(name).trim() : 'there';
  const text = buildResetPasswordText({ resetUrl, displayName });
  const logoAtt = getLogoAttachment();
  const logoCid = logoAtt ? EMAIL_LOGO_CID : undefined;
  const html = buildResetPasswordHtml({ resetUrl, displayName, logoCid });

  if (!transporter) {
    return { sent: false };
  }

  const mail = {
    from: `"Sipsip" <${from}>`,
    to,
    subject: 'Reset your Sipsip password',
    text,
    html,
  };
  if (logoAtt) {
    mail.attachments = [logoAtt];
  }

  await transporter.sendMail(mail);

  return { sent: true };
}

module.exports = { sendPasswordResetEmail };
