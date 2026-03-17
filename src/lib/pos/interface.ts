/**
 * POS Adapter Interface
 *
 * Every POS integration (Washify, DRB, Sonny's, CSV Import)
 * implements this interface. Agents never deal with POS-specific logic.
 */

export interface POSMember {
  pos_member_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  plan_name: string | null;
  plan_price_cents: number | null;
  plan_start_date: string | null; // ISO date
  plan_status: 'active' | 'paused' | 'cancelled' | 'past_due';
  payment_status: 'current' | 'declined' | 'retry_pending';
  last_payment_date: string | null; // ISO datetime
  last_payment_failure: string | null;
  payment_failure_count: number;
  vehicles: Array<{
    plate?: string;
    make?: string;
    model?: string;
    year?: number;
  }>;
}

export interface POSTransaction {
  pos_transaction_id: string;
  member_pos_id: string | null; // null for retail
  wash_type: string;
  amount_cents: number;
  payment_method: 'membership' | 'credit_card' | 'cash';
  vehicle_plate: string | null;
  washed_at: string; // ISO datetime
}

export interface POSPlan {
  plan_id: string;
  name: string;
  price_cents: number;
  active: boolean;
}

export interface POSAdapter {
  /** Fetch all members, or only those updated since a timestamp */
  fetchMembers(siteId: string, since?: Date): Promise<POSMember[]>;

  /** Fetch wash transactions, optionally since a timestamp */
  fetchTransactions(siteId: string, since?: Date): Promise<POSTransaction[]>;

  /** Fetch available membership plans */
  fetchPlans(siteId: string): Promise<POSPlan[]>;

  /** Get a single member by their POS ID */
  getMemberById(posMemberId: string): Promise<POSMember | null>;

  /** Test the connection to the POS system */
  testConnection(): Promise<{ success: boolean; error?: string }>;
}
