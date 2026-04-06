const path = require('path');
const fs = require('fs');

/** Same CID string must be used in sendEmail attachment and img src */
const EMAIL_LOGO_CID = 'sipsip-logo@sipsip';

/**
 * Escape text for safe use inside HTML email bodies.
 */
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}



function buildResetPasswordHtml({ resetUrl, displayName }) {
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(resetUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <title>Reset your Sipsip password</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f7fd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0f7fd;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbeafe;box-shadow:0 4px 24px rgba(9,132,227,0.08);">
          <tr>
            <td style="background:linear-gradient(145deg,#3b82f6 0%,#2563eb 55%,#1d4ed8 100%);padding:26px 24px 28px;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;text-align:center;">
                    <div style="font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.15;">Sipsip</div>
                    <div style="font-size:13px;color:rgba(255,255,255,0.92);padding-top:6px;line-height:1.35;">Stay hydrated, stay sharp</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 12px;">
              <p style="margin:0 0 12px;font-size:17px;line-height:1.45;color:#0f172a;font-weight:600;">Hi ${safeName},</p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#475569;">Forgot your password? No worries, it happens to the best of us! Click the button below to reset your Sipsip account password.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 28px;">
                <tr>
                  <td style="border-radius:999px;background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                    <a href="${safeUrl}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">Reset my password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">This link is only valid for <strong style="color:#334155;">1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 32px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:1.55;color:#64748b;">Button not working? Copy and paste this URL into your browser:</p>
                <p style="margin:8px 0 0;word-break:break-all;font-size:11px;line-height:1.45;color:#3b82f6;font-family:ui-monospace,SFMono-Regular,'Segoe UI Mono',Menlo,monospace;">${safeUrl}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:24px 28px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:13px;font-weight:600;color:#475569;">Cheers,</p>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b;">The Sipsip Team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildResetPasswordText({ resetUrl, displayName }) {
  const name = displayName || 'there';
  return [
    `Hi ${name},`,
    '',
    'We received a request to reset your Sipsip password.',
    '',
    'Open this link (expires in 1 hour):',
    resetUrl,
    '',
    'If you did not ask for this, you can ignore this email.',
    '',
    '— The Sipsip team',
  ].join('\n');
}

function getLogoAttachment() {
  // Logo attachment disabled as per user request to clean up the email format.
  return null;
}

module.exports = {
  escapeHtml,
  buildResetPasswordHtml,
  buildResetPasswordText,
  getLogoAttachment,
  EMAIL_LOGO_CID,
};
