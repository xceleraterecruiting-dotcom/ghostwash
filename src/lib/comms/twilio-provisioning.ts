/**
 * Twilio Number Provisioning
 *
 * Automatically provisions local phone numbers for new sites.
 * Cost: $1/mo per number + $0.0079 per SMS
 */

import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ghostwash.app';

export interface ProvisionResult {
  success: boolean;
  phoneNumber?: string;
  phoneNumberSid?: string;
  error?: string;
}

/**
 * Search for available local numbers in an area code
 */
export async function searchAvailableNumbers(
  areaCode: string,
  limit: number = 5
): Promise<string[]> {
  if (!IS_PRODUCTION) {
    // Return fake numbers in dev
    console.log(`[TWILIO:DEV] Searching for numbers in area code ${areaCode}`);
    return [`+1${areaCode}5551234`, `+1${areaCode}5555678`];
  }

  try {
    const numbers = await client.availablePhoneNumbers('US')
      .local
      .list({
        areaCode: parseInt(areaCode, 10),
        limit,
        smsEnabled: true,
        voiceEnabled: true,
      });

    return numbers.map(n => n.phoneNumber);
  } catch (error: any) {
    console.error('[TWILIO] Search error:', error.message);
    return [];
  }
}

/**
 * Provision a new phone number for a site
 */
export async function provisionNumber(
  areaCode: string,
  siteId: string,
  friendlyName?: string
): Promise<ProvisionResult> {
  if (!IS_PRODUCTION) {
    // Return fake number in dev
    const fakeNumber = `+1${areaCode}555${Math.floor(1000 + Math.random() * 9000)}`;
    console.log(`[TWILIO:DEV] Provisioned fake number: ${fakeNumber}`);
    return {
      success: true,
      phoneNumber: fakeNumber,
      phoneNumberSid: `dev-${Date.now()}`,
    };
  }

  try {
    // Search for available numbers
    const availableNumbers = await client.availablePhoneNumbers('US')
      .local
      .list({
        areaCode: parseInt(areaCode, 10),
        limit: 1,
        smsEnabled: true,
        voiceEnabled: true,
      });

    if (availableNumbers.length === 0) {
      // Try nearby area codes if none available
      const nearbyNumbers = await client.availablePhoneNumbers('US')
        .local
        .list({
          nearNumber: `+1${areaCode}0000000`,
          limit: 1,
          smsEnabled: true,
          voiceEnabled: true,
        });

      if (nearbyNumbers.length === 0) {
        return {
          success: false,
          error: `No available numbers in or near area code ${areaCode}`,
        };
      }

      availableNumbers.push(nearbyNumbers[0]);
    }

    const numberToBuy = availableNumbers[0].phoneNumber;

    // Buy the number and configure webhooks
    const webhookUrl = `${BASE_URL}/api/twilio/inbound`;

    const purchasedNumber = await client.incomingPhoneNumbers.create({
      phoneNumber: numberToBuy,
      friendlyName: friendlyName || `GhostWash Site ${siteId}`,
      smsUrl: webhookUrl,
      smsMethod: 'POST',
      // Voice can go to voicemail or be forwarded later
      voiceUrl: webhookUrl,
      voiceMethod: 'POST',
    });

    console.log(`[TWILIO] Provisioned number: ${purchasedNumber.phoneNumber}`);

    return {
      success: true,
      phoneNumber: purchasedNumber.phoneNumber,
      phoneNumberSid: purchasedNumber.sid,
    };
  } catch (error: any) {
    console.error('[TWILIO] Provisioning error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update webhook URL for an existing number
 */
export async function updateNumberWebhook(
  phoneNumberSid: string,
  webhookUrl?: string
): Promise<boolean> {
  if (!IS_PRODUCTION) {
    console.log(`[TWILIO:DEV] Updated webhook for ${phoneNumberSid}`);
    return true;
  }

  try {
    const url = webhookUrl || `${BASE_URL}/api/twilio/inbound`;

    await client.incomingPhoneNumbers(phoneNumberSid).update({
      smsUrl: url,
      smsMethod: 'POST',
    });

    return true;
  } catch (error: any) {
    console.error('[TWILIO] Webhook update error:', error.message);
    return false;
  }
}

/**
 * Release a phone number (when site is deleted)
 */
export async function releaseNumber(phoneNumberSid: string): Promise<boolean> {
  if (!IS_PRODUCTION) {
    console.log(`[TWILIO:DEV] Released number ${phoneNumberSid}`);
    return true;
  }

  try {
    await client.incomingPhoneNumbers(phoneNumberSid).remove();
    console.log(`[TWILIO] Released number ${phoneNumberSid}`);
    return true;
  } catch (error: any) {
    console.error('[TWILIO] Release error:', error.message);
    return false;
  }
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  // +18435551234 -> (843) 555-1234
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

/**
 * Extract area code from address or ZIP
 */
export function getAreaCodeFromState(state: string): string {
  // Default area codes by state (first major metro)
  const stateAreaCodes: Record<string, string> = {
    AL: '205', AK: '907', AZ: '602', AR: '501', CA: '213',
    CO: '303', CT: '203', DE: '302', FL: '305', GA: '404',
    HI: '808', ID: '208', IL: '312', IN: '317', IA: '515',
    KS: '316', KY: '502', LA: '504', ME: '207', MD: '301',
    MA: '617', MI: '313', MN: '612', MS: '601', MO: '314',
    MT: '406', NE: '402', NV: '702', NH: '603', NJ: '201',
    NM: '505', NY: '212', NC: '704', ND: '701', OH: '216',
    OK: '405', OR: '503', PA: '215', RI: '401', SC: '843',
    SD: '605', TN: '615', TX: '214', UT: '801', VT: '802',
    VA: '804', WA: '206', WV: '304', WI: '414', WY: '307',
    DC: '202',
  };

  return stateAreaCodes[state.toUpperCase()] || '800';
}
