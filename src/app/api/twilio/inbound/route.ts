/**
 * Twilio Inbound Webhook
 *
 * Receives inbound SMS messages from Twilio and processes them
 * through the conversation service.
 *
 * Twilio webhook URL: https://yourapp.com/api/twilio/inbound
 */

import { NextRequest, NextResponse } from 'next/server';
import { processInboundMessage } from '@/lib/conversations/conversation-service';
import twilio from 'twilio';

// Validate Twilio webhook signature in production
const validateTwilioRequest = (req: NextRequest, body: string): boolean => {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioSignature = req.headers.get('x-twilio-signature');

  if (!authToken || !twilioSignature) {
    // In development, skip validation
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  }

  const url = req.url;
  const params = Object.fromEntries(new URLSearchParams(body));

  return twilio.validateRequest(authToken, twilioSignature, url, params);
};

export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData();

    const from = formData.get('From')?.toString() || '';
    const to = formData.get('To')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';
    const messageSid = formData.get('MessageSid')?.toString() || '';

    // Basic validation
    if (!from || !to || !body) {
      console.error('Missing required fields in Twilio webhook');
      return new NextResponse('Missing required fields', { status: 400 });
    }

    console.log(`📱 Inbound SMS from ${from} to ${to}: "${body.substring(0, 50)}..."`);

    // Process the message
    const result = await processInboundMessage({
      from,
      to,
      body,
      twilioSid: messageSid,
      channel: 'sms',
    });

    console.log('Processing result:', {
      intent: result.intent,
      confidence: result.confidence,
      autoResponded: result.autoResponded,
      escalated: result.escalated,
    });

    // Return TwiML response (empty - we send response separately via API)
    // This acknowledges receipt to Twilio
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error: any) {
    console.error('Twilio webhook error:', error);

    // Return empty TwiML to avoid Twilio retries
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}

// Handle Twilio status callbacks
export async function GET(request: NextRequest) {
  // Health check endpoint
  return NextResponse.json({
    status: 'ok',
    service: 'twilio-inbound-webhook',
    timestamp: new Date().toISOString(),
  });
}
