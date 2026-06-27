export async function sendVerificationEmail({ to, name, verifyUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL || 'comments@nkosikhonadlamini.xyz';

  const subject = 'Verify your comment on Nkosikhona Dlamini\'s blog';
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Click the link below to verify your email and publish your comment:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>If you did not leave this comment, you can ignore this email.</p>
  `;
  const text = `Hi ${name},\n\nVerify your comment:\n${verifyUrl}\n\nIf you did not leave this comment, ignore this email.`;

  if (!apiKey) {
    console.log('[comments] RESEND_API_KEY not set — verification link:', verifyUrl);
    return { sent: false };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email send failed: ${detail}`);
  }

  return { sent: true };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
