/**
 * POS Adapter Interface
 *
 * Universal interface for all POS system integrations.
 * Each POS (Washify, DRB, Rinsed, etc.) implements this interface.
 */

// ============================================================================
// Data Types
// ============================================================================

export interface POSMember {
  externalId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  planName: string;
  planPriceCents: number;
  status: 'active' | 'paused' | 'cancelled' | 'pending';
  joinDate: Date;
  cardLastFour?: string;
  vehiclePlate?: string;
  vehicleMake?: string;
  vehicleColor?: string;
  rawData?: Record<string, any>;
}

export interface POSWashEvent {
  externalId: string;
  memberExternalId: string;
  washedAt: Date;
  washType?: string;
  lane?: string;
  durationSeconds?: number;
  rawData?: Record<string, any>;
}

export interface POSPaymentEvent {
  externalId: string;
  memberExternalId: string;
  eventType: 'charge_success' | 'charge_failed' | 'refund' | 'chargeback';
  amountCents: number;
  occurredAt: Date;
  failureReason?: string;
  cardLastFour?: string;
  rawData?: Record<string, any>;
}

export interface POSPlanChangeEvent {
  externalId: string;
  memberExternalId: string;
  changeType: 'upgrade' | 'downgrade' | 'cancel' | 'reactivate' | 'new';
  fromPlan?: string;
  toPlan?: string;
  reason?: string;
  occurredAt: Date;
  rawData?: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: Array<{ id: string; error: string }>;
  durationMs: number;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    apiVersion?: string;
    companyName?: string;
    locationName?: string;
    memberCount?: number;
  };
}

export interface POSCredentials {
  apiKey: string;
  apiSecret?: string;
  companyId?: string;
  locationId?: string;
  baseUrl?: string;
}

// ============================================================================
// Adapter Interface
// ============================================================================

export interface POSAdapter {
  /**
   * Unique identifier for this adapter
   */
  readonly adapterType: string;

  /**
   * Human-readable name
   */
  readonly displayName: string;

  /**
   * Test connection with provided credentials
   */
  testConnection(credentials: POSCredentials): Promise<ConnectionTestResult>;

  /**
   * Sync all members from POS
   * Used for initial full sync or periodic reconciliation
   */
  syncMembers(siteId: string, credentials: POSCredentials): Promise<{
    members: POSMember[];
    result: SyncResult;
  }>;

  /**
   * Sync wash events since a given timestamp
   * Used for incremental sync
   */
  syncWashes(
    siteId: string,
    credentials: POSCredentials,
    since: Date
  ): Promise<{
    washes: POSWashEvent[];
    result: SyncResult;
  }>;

  /**
   * Sync payment events since a given timestamp
   */
  syncPaymentEvents(
    siteId: string,
    credentials: POSCredentials,
    since: Date
  ): Promise<{
    payments: POSPaymentEvent[];
    result: SyncResult;
  }>;

  /**
   * Sync plan change events since a given timestamp
   */
  syncPlanChanges(
    siteId: string,
    credentials: POSCredentials,
    since: Date
  ): Promise<{
    changes: POSPlanChangeEvent[];
    result: SyncResult;
  }>;

  /**
   * Handle incoming webhook from the POS system
   */
  handleWebhook(
    siteId: string,
    payload: any,
    headers: Record<string, string>
  ): Promise<{
    eventType: string;
    processed: boolean;
    data?: POSMember | POSWashEvent | POSPaymentEvent | POSPlanChangeEvent;
  }>;

  /**
   * Validate webhook signature (if applicable)
   */
  validateWebhookSignature?(
    payload: string,
    signature: string,
    secret: string
  ): boolean;
}

// ============================================================================
// Adapter Registry
// ============================================================================

const adapters: Map<string, POSAdapter> = new Map();

export function registerAdapter(adapter: POSAdapter): void {
  adapters.set(adapter.adapterType, adapter);
}

export function getAdapter(type: string): POSAdapter | undefined {
  return adapters.get(type);
}

export function getAvailableAdapters(): Array<{ type: string; name: string }> {
  return Array.from(adapters.values()).map((a) => ({
    type: a.adapterType,
    name: a.displayName,
  }));
}

// ============================================================================
// Helper Types for Sync Pipeline
// ============================================================================

export interface SyncContext {
  siteId: string;
  organizationId: string;
  credentials: POSCredentials;
  lastSyncAt: Date | null;
  isFullSync: boolean;
}

export interface SyncLogEntry {
  siteId: string;
  syncType: 'full' | 'incremental';
  memberssynced: number;
  washessynced: number;
  paymentsSynced: number;
  status: 'success' | 'failed' | 'partial';
  errorMessage?: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}
