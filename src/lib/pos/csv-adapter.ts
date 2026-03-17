/**
 * CSV Import Adapter
 *
 * Adapter for importing member data via CSV upload.
 * Implements the same POSAdapter interface for consistency.
 *
 * This is a "passive" adapter - it doesn't actively sync,
 * but processes uploaded files through the same pipeline.
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

export interface CSVRow {
  [key: string]: string;
}

export interface CSVParseOptions {
  hasHeader?: boolean;
  delimiter?: string;
  fieldMapping?: Record<string, string>;
}

// Default field mappings for common CSV formats
const DEFAULT_FIELD_MAPPING: Record<string, string[]> = {
  firstName: ['first_name', 'firstname', 'first', 'fname', 'given_name'],
  lastName: ['last_name', 'lastname', 'last', 'lname', 'surname', 'family_name'],
  email: ['email', 'email_address', 'e-mail', 'mail'],
  phone: ['phone', 'phone_number', 'mobile', 'cell', 'telephone', 'tel'],
  planName: ['plan', 'plan_name', 'membership', 'membership_type', 'package'],
  planPrice: ['price', 'plan_price', 'amount', 'monthly_price', 'rate'],
  status: ['status', 'plan_status', 'membership_status', 'state'],
  joinDate: ['join_date', 'joined', 'start_date', 'signup_date', 'created_at', 'enrolled'],
  cardLastFour: ['card_last_four', 'card_last4', 'last_four', 'card'],
  vehiclePlate: ['plate', 'license_plate', 'vehicle_plate', 'tag'],
  externalId: ['id', 'member_id', 'external_id', 'customer_id', 'account_number'],
};

/**
 * Find a field value using multiple possible column names
 */
function findField(row: CSVRow, possibleNames: string[]): string | null {
  const lowerRow: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    lowerRow[key.toLowerCase().trim()] = value;
  }

  for (const name of possibleNames) {
    if (lowerRow[name.toLowerCase()]) {
      return lowerRow[name.toLowerCase()].trim();
    }
  }
  return null;
}

/**
 * Parse status string to normalized format
 */
function parseStatus(status: string | null): POSMember['status'] {
  if (!status) return 'active';

  const normalized = status.toLowerCase().trim();

  if (['active', 'current', 'enabled', 'subscribed'].includes(normalized)) {
    return 'active';
  }
  if (['paused', 'hold', 'suspended', 'frozen'].includes(normalized)) {
    return 'paused';
  }
  if (['cancelled', 'canceled', 'terminated', 'inactive', 'churned'].includes(normalized)) {
    return 'cancelled';
  }
  if (['pending', 'new', 'trial'].includes(normalized)) {
    return 'pending';
  }

  return 'active';
}

/**
 * Parse price string to cents
 */
function parsePriceToCents(price: string | null): number {
  if (!price) return 0;

  // Remove currency symbols and whitespace
  const cleaned = price.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) return 0;

  // Assume it's in dollars, convert to cents
  return Math.round(parsed * 100);
}

/**
 * Parse date string
 */
function parseDate(dateStr: string | null): Date {
  if (!dateStr) return new Date();

  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    // Try common formats
    // MM/DD/YYYY
    const parts = dateStr.split(/[/\-]/);
    if (parts.length === 3) {
      const [a, b, c] = parts.map((p) => parseInt(p, 10));
      // If first number > 12, assume DD/MM/YYYY
      if (a > 12) {
        return new Date(c, b - 1, a);
      }
      // Otherwise assume MM/DD/YYYY
      return new Date(c, a - 1, b);
    }
    return new Date();
  }

  return parsed;
}

/**
 * Parse phone number to E.164 format
 */
function parsePhone(phone: string | null): string | null {
  if (!phone) return null;

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.length > 10) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Parse a single CSV row to a POSMember
 */
function parseRowToMember(row: CSVRow, rowIndex: number): POSMember {
  const externalId = findField(row, DEFAULT_FIELD_MAPPING.externalId) || `csv-${rowIndex}`;
  const firstName = findField(row, DEFAULT_FIELD_MAPPING.firstName) || '';
  const lastName = findField(row, DEFAULT_FIELD_MAPPING.lastName) || '';
  const email = findField(row, DEFAULT_FIELD_MAPPING.email);
  const phone = parsePhone(findField(row, DEFAULT_FIELD_MAPPING.phone));
  const planName = findField(row, DEFAULT_FIELD_MAPPING.planName) || 'Unknown';
  const planPriceCents = parsePriceToCents(findField(row, DEFAULT_FIELD_MAPPING.planPrice));
  const status = parseStatus(findField(row, DEFAULT_FIELD_MAPPING.status));
  const joinDate = parseDate(findField(row, DEFAULT_FIELD_MAPPING.joinDate));
  const cardLastFour = findField(row, DEFAULT_FIELD_MAPPING.cardLastFour) || undefined;
  const vehiclePlate = findField(row, DEFAULT_FIELD_MAPPING.vehiclePlate) || undefined;

  return {
    externalId,
    firstName,
    lastName,
    email,
    phone,
    planName,
    planPriceCents,
    status,
    joinDate,
    cardLastFour,
    vehiclePlate,
    rawData: row,
  };
}

/**
 * Parse CSV string to rows
 */
export function parseCSV(content: string, options: CSVParseOptions = {}): CSVRow[] {
  const { hasHeader = true, delimiter = ',' } = options;

  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));

  // Parse rows
  const startIndex = hasHeader ? 1 : 0;
  const rows: CSVRow[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const values = parseCSVLine(line, delimiter);

    if (values.length === 0) continue;

    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * CSV Import Adapter Implementation
 */
export const csvAdapter: POSAdapter = {
  adapterType: 'csv_import',
  displayName: 'CSV Import',

  async testConnection(_credentials: POSCredentials): Promise<ConnectionTestResult> {
    // CSV doesn't have a connection to test
    return {
      success: true,
      message: 'CSV import is always available',
    };
  },

  async syncMembers(
    _siteId: string,
    _credentials: POSCredentials
  ): Promise<{ members: POSMember[]; result: SyncResult }> {
    // CSV adapter doesn't do active syncing
    // Data is pushed via import endpoint
    return {
      members: [],
      result: {
        success: true,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [],
        durationMs: 0,
      },
    };
  },

  async syncWashes(
    _siteId: string,
    _credentials: POSCredentials,
    _since: Date
  ): Promise<{ washes: POSWashEvent[]; result: SyncResult }> {
    return {
      washes: [],
      result: {
        success: true,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [],
        durationMs: 0,
      },
    };
  },

  async syncPaymentEvents(
    _siteId: string,
    _credentials: POSCredentials,
    _since: Date
  ): Promise<{ payments: POSPaymentEvent[]; result: SyncResult }> {
    return {
      payments: [],
      result: {
        success: true,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [],
        durationMs: 0,
      },
    };
  },

  async syncPlanChanges(
    _siteId: string,
    _credentials: POSCredentials,
    _since: Date
  ): Promise<{ changes: POSPlanChangeEvent[]; result: SyncResult }> {
    return {
      changes: [],
      result: {
        success: true,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [],
        durationMs: 0,
      },
    };
  },

  async handleWebhook(
    _siteId: string,
    _payload: any,
    _headers: Record<string, string>
  ): Promise<{
    eventType: string;
    processed: boolean;
    data?: POSMember | POSWashEvent | POSPaymentEvent | POSPlanChangeEvent;
  }> {
    // CSV doesn't have webhooks
    return {
      eventType: 'not_supported',
      processed: false,
    };
  },
};

// Register adapter
registerAdapter(csvAdapter);

/**
 * Process CSV content and return parsed members
 * This is the main entry point for CSV imports
 */
export async function processCSVImport(
  content: string,
  options: CSVParseOptions = {}
): Promise<{ members: POSMember[]; result: SyncResult }> {
  const startTime = Date.now();
  const errors: Array<{ id: string; error: string }> = [];

  try {
    const rows = parseCSV(content, options);
    const members: POSMember[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const member = parseRowToMember(rows[i], i);

        // Basic validation
        if (!member.firstName && !member.lastName && !member.email && !member.phone) {
          errors.push({ id: `row-${i + 1}`, error: 'No identifiable information in row' });
          continue;
        }

        members.push(member);
      } catch (err: any) {
        errors.push({ id: `row-${i + 1}`, error: err.message });
      }
    }

    return {
      members,
      result: {
        success: errors.length === 0,
        recordsProcessed: rows.length,
        recordsCreated: members.length,
        recordsUpdated: 0,
        recordsSkipped: errors.length,
        errors,
        durationMs: Date.now() - startTime,
      },
    };
  } catch (error: any) {
    return {
      members: [],
      result: {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [{ id: 'parse', error: error.message }],
        durationMs: Date.now() - startTime,
      },
    };
  }
}

export default csvAdapter;
