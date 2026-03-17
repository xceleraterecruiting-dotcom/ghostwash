/**
 * Intent Classifier
 *
 * Uses Claude API to classify inbound customer messages into intent categories.
 * Returns a confidence score - if below threshold, message is flagged for human review.
 */

import Anthropic from '@anthropic-ai/sdk';

export type IntentCategory =
  | 'cancel_request'
  | 'billing_question'
  | 'payment_update'
  | 'hours_location'
  | 'complaint'
  | 'compliment'
  | 'membership_question'
  | 'yes_confirm'
  | 'no_decline'
  | 'other';

export interface ClassificationResult {
  intent: IntentCategory;
  confidence: number;
  reasoning?: string;
}

const INTENT_DESCRIPTIONS: Record<IntentCategory, string> = {
  cancel_request: 'Customer wants to cancel their membership ("I want to cancel", "how do I cancel", "stop charging me", "end my membership")',
  billing_question: 'Customer has a question about charges or billing ("why was I charged", "what\'s my plan cost", "double charge", "receipt")',
  payment_update: 'Customer wants to update payment method ("update my card", "new credit card", "card declined", "change payment")',
  hours_location: 'Customer asking about business hours or location ("what time do you open", "where are you located", "are you open today", "address")',
  complaint: 'Customer is unhappy or complaining ("bad wash", "scratched my car", "machine broke", "terrible experience", "not working")',
  compliment: 'Customer is expressing satisfaction or thanks ("great wash", "love this place", "thank you", "amazing service")',
  membership_question: 'Customer asking about membership plans ("what plans do you have", "can I upgrade", "add a vehicle", "pricing")',
  yes_confirm: 'Customer is confirming or accepting something ("yes", "ok", "sure", "accept", "deal", "sounds good")',
  no_decline: 'Customer is declining or refusing something ("no", "nope", "not interested", "just cancel")',
  other: 'Anything that does not fit the above categories',
};

export async function classifyIntent(
  message: string,
  conversationContext?: string
): Promise<ClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('No ANTHROPIC_API_KEY - using keyword fallback');
    return classifyWithKeywords(message);
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const systemPrompt = `You are an intent classifier for a car wash membership business. Your job is to classify customer messages into exactly ONE intent category.

Available categories and their meanings:
${Object.entries(INTENT_DESCRIPTIONS)
  .map(([intent, desc]) => `- ${intent}: ${desc}`)
  .join('\n')}

${conversationContext ? `\nConversation context (previous messages):\n${conversationContext}\n` : ''}

Rules:
1. Return ONLY valid JSON with "intent" and "confidence" fields
2. confidence should be a number between 0 and 1
3. If the customer previously received a save offer and is now responding, classify as "yes_confirm" or "no_decline" accordingly
4. For short responses like "yes", "no", "ok" - use context to determine if they're confirming/declining an offer
5. If truly ambiguous, use "other" with lower confidence

Example output: {"intent": "cancel_request", "confidence": 0.95}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Classify this customer message:\n\n"${message}"`,
        },
      ],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return classifyWithKeywords(message);
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return classifyWithKeywords(message);
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate intent is a valid category
    if (!Object.keys(INTENT_DESCRIPTIONS).includes(result.intent)) {
      result.intent = 'other';
    }

    return {
      intent: result.intent as IntentCategory,
      confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error('Intent classification error:', error);
    return classifyWithKeywords(message);
  }
}

/**
 * Fallback keyword-based classification when API is unavailable
 */
function classifyWithKeywords(message: string): ClassificationResult {
  const lower = message.toLowerCase().trim();

  // Yes/No responses (check first for short messages)
  if (/^(yes|yeah|yep|ok|okay|sure|accept|deal|sounds good|let's do it)$/i.test(lower)) {
    return { intent: 'yes_confirm', confidence: 0.85 };
  }
  if (/^(no|nope|nah|not interested|just cancel|no thanks|decline)$/i.test(lower)) {
    return { intent: 'no_decline', confidence: 0.85 };
  }

  // Cancel keywords
  if (/cancel|stop charging|end (my )?membership|unsubscribe|quit|terminate/i.test(lower)) {
    return { intent: 'cancel_request', confidence: 0.8 };
  }

  // Billing keywords
  if (/charged|charge|bill|invoice|receipt|payment history|cost|price/i.test(lower)) {
    return { intent: 'billing_question', confidence: 0.75 };
  }

  // Payment update keywords
  if (/update (my )?(card|payment)|new card|change (card|payment)|card declined/i.test(lower)) {
    return { intent: 'payment_update', confidence: 0.8 };
  }

  // Hours/location keywords
  if (/hours|open|close|location|address|where|directions/i.test(lower)) {
    return { intent: 'hours_location', confidence: 0.8 };
  }

  // Complaint keywords
  if (/scratch|damage|broke|broken|terrible|awful|worst|horrible|bad|didn't work|not working|problem|issue/i.test(lower)) {
    return { intent: 'complaint', confidence: 0.7 };
  }

  // Compliment keywords
  if (/thank|thanks|great|love|awesome|amazing|excellent|perfect|good job|appreciate/i.test(lower)) {
    return { intent: 'compliment', confidence: 0.75 };
  }

  // Membership question keywords
  if (/plan|upgrade|downgrade|membership|join|sign up|options|vehicle/i.test(lower)) {
    return { intent: 'membership_question', confidence: 0.7 };
  }

  // Default to other with low confidence
  return { intent: 'other', confidence: 0.4 };
}

/**
 * Check for escalation triggers that should bypass auto-response
 */
export function checkEscalationTriggers(message: string): {
  shouldEscalate: boolean;
  reason?: string;
} {
  const lower = message.toLowerCase();

  // Profanity check (basic)
  const profanityPatterns = /\b(fuck|shit|damn|ass|bitch|bastard|crap)\b/i;
  if (profanityPatterns.test(lower)) {
    return { shouldEscalate: true, reason: 'profanity_detected' };
  }

  // Legal language
  const legalPatterns = /\b(lawyer|attorney|sue|lawsuit|legal action|court|lawyer up)\b/i;
  if (legalPatterns.test(lower)) {
    return { shouldEscalate: true, reason: 'legal_language_detected' };
  }

  // Threats
  const threatPatterns = /\b(threaten|report|bbb|better business|news|media|social media blast)\b/i;
  if (threatPatterns.test(lower)) {
    return { shouldEscalate: true, reason: 'threat_detected' };
  }

  return { shouldEscalate: false };
}

/**
 * Get the template name for an intent
 */
export function getTemplateForIntent(intent: IntentCategory): string {
  const templateMap: Record<IntentCategory, string> = {
    cancel_request: 'Save Offer Response',
    billing_question: 'Billing Info Response',
    payment_update: 'Payment Update Response',
    hours_location: 'Hours Location Response',
    complaint: 'Complaint Response',
    compliment: 'Compliment Response',
    membership_question: 'Membership Question Response',
    yes_confirm: 'Confirm Cancel Response', // If they say yes to save offer
    no_decline: 'Confirm Cancel Response', // If they decline save offer
    other: 'Fallback Response',
  };

  return templateMap[intent];
}

/**
 * Determine if the intent requires operator notification (Tier 2)
 */
export function requiresOperatorNotification(intent: IntentCategory): boolean {
  return intent === 'complaint' || intent === 'other';
}
