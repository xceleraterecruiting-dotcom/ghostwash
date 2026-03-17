/**
 * Email Communication Layer
 *
 * Wraps SendGrid for sending emails.
 * In development/staging, logs to console instead of sending.
 */

import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'notifications@ghostwash.ai';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export interface EmailResult {
  success: boolean;
  error?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<EmailResult> {
  // In development, just log
  if (!IS_PRODUCTION) {
    console.log(`[EMAIL:DEV] To: ${to} | Subject: ${subject} | Body: ${body.substring(0, 100)}...`);
    return { success: true };
  }

  try {
    await sgMail.send({
      to,
      from: FROM_EMAIL,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    });

    return { success: true };
  } catch (error: any) {
    console.error('[EMAIL:ERROR]', error.message);
    return { success: false, error: error.message };
  }
}
