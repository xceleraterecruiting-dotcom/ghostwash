/**
 * SMS Communication Layer
 *
 * Wraps Twilio for sending SMS messages.
 * In development/staging, logs to console instead of sending.
 */

import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER!;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export interface SMSResult {
  success: boolean;
  message_sid?: string;
  error?: string;
}

export async function sendSMS(to: string, body: string): Promise<SMSResult> {
  // In development, just log
  if (!IS_PRODUCTION) {
    console.log(`[SMS:DEV] To: ${to} | Body: ${body}`);
    return { success: true, message_sid: `dev-${Date.now()}` };
  }

  try {
    const message = await client.messages.create({
      body,
      from: FROM_NUMBER,
      to,
    });

    return { success: true, message_sid: message.sid };
  } catch (error: any) {
    console.error('[SMS:ERROR]', error.message);
    return { success: false, error: error.message };
  }
}
