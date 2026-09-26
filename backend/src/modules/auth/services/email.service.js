import HttpError from '../../../common/exceptions/http-error.js';

const sendEmail = async ({ to, subject, text, html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new HttpError('Password reset email is not configured', 503, 'EMAIL_NOT_CONFIGURED');
  }

  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
  } catch (error) {
    console.error('[Resend] Email request failed:', error.message);
    throw new HttpError('Could not send verification email. Please try again shortly.', 502, 'EMAIL_DELIVERY_FAILED');
  }

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error(`[Resend] Email request failed (${response.status}):`, details);
    throw new HttpError('Could not send verification email. Please try again shortly.', 502, 'EMAIL_DELIVERY_FAILED');
  }
};

export { sendEmail };