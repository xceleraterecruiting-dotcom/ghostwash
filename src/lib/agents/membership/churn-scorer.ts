/**
 * Churn Scorer V1 — Rule-Based
 *
 * Deterministic scoring model that outperforms "no churn prediction"
 * by a massive margin. Ships in days, not weeks. No ML required.
 *
 * Upgrade to XGBoost (V2) after 90 days of labeled outcome data.
 *
 * Score: 0-100. Threshold for intervention: 60+
 */

interface MemberChurnInput {
  wash_count_30d: number;
  wash_count_60d: number;
  avg_wash_frequency_days: number | null; // historical average
  days_since_last_wash: number | null;
  payment_failure_count: number;
  plan_age_days: number;
  month: number; // 1-12 for seasonal adjustment
}

interface ChurnScoreResult {
  score: number;
  factors: {
    visit_frequency_decay: number;
    days_since_last_wash: number;
    payment_failures: number;
    membership_age: number;
    seasonal: number;
  };
}

export function calculateChurnScore(input: MemberChurnInput): ChurnScoreResult {
  const factors = {
    visit_frequency_decay: 0,
    days_since_last_wash: 0,
    payment_failures: 0,
    membership_age: 0,
    seasonal: 0,
  };

  // ---- Factor 1: Visit Frequency Decay (0-40 points) ----
  // Compare recent 30-day wash count to what we'd expect from their average
  if (input.avg_wash_frequency_days && input.avg_wash_frequency_days > 0) {
    const expected_30d = 30 / input.avg_wash_frequency_days;
    const actual_30d = input.wash_count_30d;

    if (expected_30d > 0) {
      const decay_pct = 1 - (actual_30d / expected_30d);

      if (decay_pct >= 0.5) {
        factors.visit_frequency_decay = 40;
      } else if (decay_pct >= 0.25) {
        factors.visit_frequency_decay = 25;
      } else if (decay_pct >= 0.1) {
        factors.visit_frequency_decay = 15;
      }
    }
  } else if (input.wash_count_30d !== undefined && input.wash_count_30d !== null) {
    // No historical average — use raw 30d count only if we have it
    if (input.wash_count_30d === 0) {
      factors.visit_frequency_decay = 35;
    } else if (input.wash_count_30d === 1) {
      factors.visit_frequency_decay = 20;
    }
  }
  // If wash_count_30d is not populated, we rely on days_since_last_wash factor instead

  // ---- Factor 2: Days Since Last Wash (-15 to 35 points) ----
  // This is the most reliable signal when we have it
  // Very recent activity can reduce overall score (negative points)
  if (input.days_since_last_wash !== null) {
    // Absolute thresholds (more aggressive when no wash in X days)
    if (input.days_since_last_wash >= 90) {
      factors.days_since_last_wash = 35; // 3+ months no wash = very high risk
    } else if (input.days_since_last_wash >= 60) {
      factors.days_since_last_wash = 30; // 2+ months = high risk
    } else if (input.days_since_last_wash >= 45) {
      factors.days_since_last_wash = 25;
    } else if (input.days_since_last_wash >= 30) {
      factors.days_since_last_wash = 20;
    } else if (input.days_since_last_wash >= 21) {
      factors.days_since_last_wash = 15;
    } else if (input.days_since_last_wash >= 14) {
      factors.days_since_last_wash = 10;
    } else if (input.days_since_last_wash >= 7) {
      factors.days_since_last_wash = 5;
    } else if (input.days_since_last_wash <= 3) {
      // Very recent wash = negative points (reduces risk)
      factors.days_since_last_wash = -15;
    } else {
      // 4-6 days = slight reduction
      factors.days_since_last_wash = -5;
    }
  }

  // ---- Factor 3: Payment Failures (0-20 points) ----
  if (input.payment_failure_count >= 2) {
    factors.payment_failures = 20;
  } else if (input.payment_failure_count === 1) {
    factors.payment_failures = 10;
  }

  // ---- Factor 4: Membership Age (0-10 points) ----
  // Members in first 60 days churn at 2-3x the rate
  if (input.plan_age_days < 30) {
    factors.membership_age = 10;
  } else if (input.plan_age_days < 60) {
    factors.membership_age = 7;
  }

  // ---- Factor 5: Seasonal Adjustment (0-5 points) ----
  // Winter months (Dec, Jan, Feb) have higher churn in most markets
  const winterMonths = [12, 1, 2];
  if (winterMonths.includes(input.month)) {
    factors.seasonal = 5;
  }

  // ---- Total ----
  const rawScore =
    factors.visit_frequency_decay +
    factors.days_since_last_wash +
    factors.payment_failures +
    factors.membership_age +
    factors.seasonal;

  // Clamp to 0-100 range
  const score = Math.max(0, Math.min(100, rawScore));

  return { score, factors };
}
