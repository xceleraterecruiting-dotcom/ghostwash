/**
 * Washify POS Adapter
 *
 * Integration with Washify car wash management system.
 *
 * Note: Washify API is partner-gated. This adapter uses placeholder
 * endpoints based on known API patterns. Real endpoints will be
 * swapped in once we have partner API access.
 *
 * Known API patterns:
 * - Base URL: https://washifyapi.com:8296
 * - Auth: API key based
 * - Endpoint pattern: POST to .svc endpoints with JSON body
 *   containing companyId, locationId, APIkey
 */

import type {
  POSAdapter,
  POSCredentials,
  POSMember,
  POSWashEvent,
  POSPaymentEvent,
  POSPlanChangeEvent,
  SyncResult,
  ConnectionTestResult,
} from './adapter-interface';
import { registerAdapter } from './adapter-interface';

// Environment variable for base URL (allows swapping for sandbox/prod)
const WASHIFY_BASE_URL = process.env.WASHIFY_API_URL || 'https://washifyapi.com:8296';

// Rate limiting config
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

interface WashifyAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

interface WashifyMemberData {
  MemberId: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Phone: string;
  PlanName: string;
  PlanPrice: number;
  Status: string;
  JoinDate: string;
  CardLast4: string;
  Vehicle?: {
    Plate: string;
    Make: string;
    Color: string;
  };
}

interface WashifyWashData {
  WashId: string;
  MemberId: string;
  WashDateTime: string;
  WashType: string;
  Lane: string;
  DurationSec: number;
}

interface WashifyPaymentData {
  PaymentId: string;
  MemberId: string;
  EventType: string;
  Amount: number;
  EventDateTime: string;
  FailureReason?: string;
  CardLast4?: string;
}

interface WashifyPlanChangeData {
  ChangeId: string;
  MemberId: string;
  ChangeType: string;
  FromPlan?: string;
  ToPlan?: string;
  Reason?: string;
  ChangeDateTime: string;
}

/**
 * Sleep helper for rate limiting backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make API request with retry logic
 */
async function makeRequest<T>(
  endpoint: string,
  credentials: POSCredentials,
  body: Record<string, any> = {}
): Promise<WashifyAPIResponse<T>> {
  const url = `${credentials.baseUrl || WASHIFY_BASE_URL}${endpoint}`;

  const requestBody = {
    companyId: credentials.companyId,
    locationId: credentials.locationId,
    APIkey: credentials.apiKey,
    ...body,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Handle rate limiting
      if (response.status === 429) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.log(`[WASHIFY] Rate limited, backing off ${backoff}ms`);
        await sleep(backoff);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error: any) {
      lastError = error;
      console.error(`[WASHIFY] Request failed (attempt ${attempt + 1}):`, error.message);

      if (attempt < MAX_RETRIES - 1) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await sleep(backoff);
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Request failed after retries',
  };
}

/**
 * Map Washify member to GhostWash format
 */
function mapMember(data: WashifyMemberData): POSMember {
  const statusMap: Record<string, POSMember['status']> = {
    Active: 'active',
    Paused: 'paused',
    Cancelled: 'cancelled',
    Pending: 'pending',
    active: 'active',
    paused: 'paused',
    cancelled: 'cancelled',
    pending: 'pending',
  };

  return {
    externalId: data.MemberId,
    firstName: data.FirstName || '',
    lastName: data.LastName || '',
    email: data.Email || null,
    phone: data.Phone || null,
    planName: data.PlanName || 'Unknown',
    planPriceCents: Math.round((data.PlanPrice || 0) * 100),
    status: statusMap[data.Status] || 'active',
    joinDate: new Date(data.JoinDate),
    cardLastFour: data.CardLast4,
    vehiclePlate: data.Vehicle?.Plate,
    vehicleMake: data.Vehicle?.Make,
    vehicleColor: data.Vehicle?.Color,
    rawData: data,
  };
}

/**
 * Map Washify wash event to GhostWash format
 */
function mapWash(data: WashifyWashData): POSWashEvent {
  return {
    externalId: data.WashId,
    memberExternalId: data.MemberId,
    washedAt: new Date(data.WashDateTime),
    washType: data.WashType,
    lane: data.Lane,
    durationSeconds: data.DurationSec,
    rawData: data,
  };
}

/**
 * Map Washify payment event to GhostWash format
 */
function mapPayment(data: WashifyPaymentData): POSPaymentEvent {
  const eventTypeMap: Record<string, POSPaymentEvent['eventType']> = {
    Success: 'charge_success',
    Failed: 'charge_failed',
    Refund: 'refund',
    Chargeback: 'chargeback',
    charge_success: 'charge_success',
    charge_failed: 'charge_failed',
    refund: 'refund',
    chargeback: 'chargeback',
  };

  return {
    externalId: data.PaymentId,
    memberExternalId: data.MemberId,
    eventType: eventTypeMap[data.EventType] || 'charge_failed',
    amountCents: Math.round((data.Amount || 0) * 100),
    occurredAt: new Date(data.EventDateTime),
    failureReason: data.FailureReason,
    cardLastFour: data.CardLast4,
    rawData: data,
  };
}

/**
 * Map Washify plan change to GhostWash format
 */
function mapPlanChange(data: WashifyPlanChangeData): POSPlanChangeEvent {
  const changeTypeMap: Record<string, POSPlanChangeEvent['changeType']> = {
    Upgrade: 'upgrade',
    Downgrade: 'downgrade',
    Cancel: 'cancel',
    Reactivate: 'reactivate',
    New: 'new',
    upgrade: 'upgrade',
    downgrade: 'downgrade',
    cancel: 'cancel',
    reactivate: 'reactivate',
    new: 'new',
  };

  return {
    externalId: data.ChangeId,
    memberExternalId: data.MemberId,
    changeType: changeTypeMap[data.ChangeType] || 'cancel',
    fromPlan: data.FromPlan,
    toPlan: data.ToPlan,
    reason: data.Reason,
    occurredAt: new Date(data.ChangeDateTime),
    rawData: data,
  };
}

/**
 * Washify POS Adapter Implementation
 */
export const washifyAdapter: POSAdapter = {
  adapterType: 'washify',
  displayName: 'Washify',

  async testConnection(credentials: POSCredentials): Promise<ConnectionTestResult> {
    console.log('[WASHIFY] Testing connection...');

    // Validate required credentials
    if (!credentials.apiKey) {
      return {
        success: false,
        message: 'API key is required',
      };
    }

    if (!credentials.companyId || !credentials.locationId) {
      return {
        success: false,
        message: 'Company ID and Location ID are required',
      };
    }

    try {
      // Placeholder endpoint - will be replaced with real endpoint
      const response = await makeRequest<{
        CompanyName: string;
        LocationName: string;
        MemberCount: number;
        ApiVersion: string;
      }>('/api/v1/Connection.svc/Test', credentials);

      if (!response.success) {
        return {
          success: false,
          message: response.error || 'Connection failed',
        };
      }

      return {
        success: true,
        message: 'Connected to Washify',
        details: {
          apiVersion: response.data?.ApiVersion,
          companyName: response.data?.CompanyName,
          locationName: response.data?.LocationName,
          memberCount: response.data?.MemberCount,
        },
      };
    } catch (error: any) {
      console.error('[WASHIFY] Connection test failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to connect to Washify API',
      };
    }
  },

  async syncMembers(
    siteId: string,
    credentials: POSCredentials
  ): Promise<{ members: POSMember[]; result: SyncResult }> {
    console.log(`[WASHIFY] Syncing members for site ${siteId}`);
    const startTime = Date.now();
    const errors: Array<{ id: string; error: string }> = [];

    try {
      // Placeholder endpoint
      const response = await makeRequest<{ Members: WashifyMemberData[] }>(
        '/api/v1/Members.svc/GetAll',
        credentials
      );

      if (!response.success || !response.data?.Members) {
        return {
          members: [],
          result: {
            success: false,
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsSkipped: 0,
            errors: [{ id: 'api', error: response.error || 'No data returned' }],
            durationMs: Date.now() - startTime,
          },
        };
      }

      const members: POSMember[] = [];

      for (const memberData of response.data.Members) {
        try {
          members.push(mapMember(memberData));
        } catch (err: any) {
          errors.push({ id: memberData.MemberId, error: err.message });
        }
      }

      return {
        members,
        result: {
          success: errors.length === 0,
          recordsProcessed: response.data.Members.length,
          recordsCreated: members.length,
          recordsUpdated: 0,
          recordsSkipped: errors.length,
          errors,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      console.error('[WASHIFY] syncMembers error:', error);
      return {
        members: [],
        result: {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          errors: [{ id: 'sync', error: error.message }],
          durationMs: Date.now() - startTime,
        },
      };
    }
  },

  async syncWashes(
    siteId: string,
    credentials: POSCredentials,
    since: Date
  ): Promise<{ washes: POSWashEvent[]; result: SyncResult }> {
    console.log(`[WASHIFY] Syncing washes for site ${siteId} since ${since.toISOString()}`);
    const startTime = Date.now();
    const errors: Array<{ id: string; error: string }> = [];

    try {
      const response = await makeRequest<{ Washes: WashifyWashData[] }>(
        '/api/v1/Washes.svc/GetSince',
        credentials,
        { since: since.toISOString() }
      );

      if (!response.success || !response.data?.Washes) {
        return {
          washes: [],
          result: {
            success: false,
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsSkipped: 0,
            errors: [{ id: 'api', error: response.error || 'No data returned' }],
            durationMs: Date.now() - startTime,
          },
        };
      }

      const washes: POSWashEvent[] = [];

      for (const washData of response.data.Washes) {
        try {
          washes.push(mapWash(washData));
        } catch (err: any) {
          errors.push({ id: washData.WashId, error: err.message });
        }
      }

      return {
        washes,
        result: {
          success: errors.length === 0,
          recordsProcessed: response.data.Washes.length,
          recordsCreated: washes.length,
          recordsUpdated: 0,
          recordsSkipped: errors.length,
          errors,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      console.error('[WASHIFY] syncWashes error:', error);
      return {
        washes: [],
        result: {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          errors: [{ id: 'sync', error: error.message }],
          durationMs: Date.now() - startTime,
        },
      };
    }
  },

  async syncPaymentEvents(
    siteId: string,
    credentials: POSCredentials,
    since: Date
  ): Promise<{ payments: POSPaymentEvent[]; result: SyncResult }> {
    console.log(`[WASHIFY] Syncing payments for site ${siteId} since ${since.toISOString()}`);
    const startTime = Date.now();
    const errors: Array<{ id: string; error: string }> = [];

    try {
      const response = await makeRequest<{ Payments: WashifyPaymentData[] }>(
        '/api/v1/Payments.svc/GetSince',
        credentials,
        { since: since.toISOString() }
      );

      if (!response.success || !response.data?.Payments) {
        return {
          payments: [],
          result: {
            success: false,
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsSkipped: 0,
            errors: [{ id: 'api', error: response.error || 'No data returned' }],
            durationMs: Date.now() - startTime,
          },
        };
      }

      const payments: POSPaymentEvent[] = [];

      for (const paymentData of response.data.Payments) {
        try {
          payments.push(mapPayment(paymentData));
        } catch (err: any) {
          errors.push({ id: paymentData.PaymentId, error: err.message });
        }
      }

      return {
        payments,
        result: {
          success: errors.length === 0,
          recordsProcessed: response.data.Payments.length,
          recordsCreated: payments.length,
          recordsUpdated: 0,
          recordsSkipped: errors.length,
          errors,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      console.error('[WASHIFY] syncPaymentEvents error:', error);
      return {
        payments: [],
        result: {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          errors: [{ id: 'sync', error: error.message }],
          durationMs: Date.now() - startTime,
        },
      };
    }
  },

  async syncPlanChanges(
    siteId: string,
    credentials: POSCredentials,
    since: Date
  ): Promise<{ changes: POSPlanChangeEvent[]; result: SyncResult }> {
    console.log(`[WASHIFY] Syncing plan changes for site ${siteId} since ${since.toISOString()}`);
    const startTime = Date.now();
    const errors: Array<{ id: string; error: string }> = [];

    try {
      const response = await makeRequest<{ Changes: WashifyPlanChangeData[] }>(
        '/api/v1/PlanChanges.svc/GetSince',
        credentials,
        { since: since.toISOString() }
      );

      if (!response.success || !response.data?.Changes) {
        return {
          changes: [],
          result: {
            success: false,
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsSkipped: 0,
            errors: [{ id: 'api', error: response.error || 'No data returned' }],
            durationMs: Date.now() - startTime,
          },
        };
      }

      const changes: POSPlanChangeEvent[] = [];

      for (const changeData of response.data.Changes) {
        try {
          changes.push(mapPlanChange(changeData));
        } catch (err: any) {
          errors.push({ id: changeData.ChangeId, error: err.message });
        }
      }

      return {
        changes,
        result: {
          success: errors.length === 0,
          recordsProcessed: response.data.Changes.length,
          recordsCreated: changes.length,
          recordsUpdated: 0,
          recordsSkipped: errors.length,
          errors,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      console.error('[WASHIFY] syncPlanChanges error:', error);
      return {
        changes: [],
        result: {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          errors: [{ id: 'sync', error: error.message }],
          durationMs: Date.now() - startTime,
        },
      };
    }
  },

  async handleWebhook(
    siteId: string,
    payload: any,
    headers: Record<string, string>
  ): Promise<{
    eventType: string;
    processed: boolean;
    data?: POSMember | POSWashEvent | POSPaymentEvent | POSPlanChangeEvent;
  }> {
    console.log(`[WASHIFY] Processing webhook for site ${siteId}`);

    const eventType = payload.EventType || payload.event_type || 'unknown';

    try {
      switch (eventType) {
        case 'member.created':
        case 'member.updated':
          if (payload.Member) {
            return {
              eventType,
              processed: true,
              data: mapMember(payload.Member),
            };
          }
          break;

        case 'wash.completed':
          if (payload.Wash) {
            return {
              eventType,
              processed: true,
              data: mapWash(payload.Wash),
            };
          }
          break;

        case 'payment.success':
        case 'payment.failed':
          if (payload.Payment) {
            return {
              eventType,
              processed: true,
              data: mapPayment(payload.Payment),
            };
          }
          break;

        case 'plan.changed':
          if (payload.Change) {
            return {
              eventType,
              processed: true,
              data: mapPlanChange(payload.Change),
            };
          }
          break;
      }

      return {
        eventType,
        processed: false,
      };
    } catch (error: any) {
      console.error('[WASHIFY] Webhook processing error:', error);
      return {
        eventType,
        processed: false,
      };
    }
  },

  validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    // Placeholder - implement actual signature validation when we have API docs
    // Typically HMAC-SHA256 of payload with secret
    console.log('[WASHIFY] Webhook signature validation not yet implemented');
    return true;
  },
};

// Register adapter
registerAdapter(washifyAdapter);

export default washifyAdapter;
