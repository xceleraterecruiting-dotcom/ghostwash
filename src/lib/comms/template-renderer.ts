/**
 * Template Renderer
 *
 * Replaces {{variables}} in intervention templates with member data.
 * This is the ONLY way customer-facing text is generated.
 * The LLM never writes customer-facing messages.
 */

import Mustache from 'mustache';

export interface TemplateVariables {
  first_name: string;
  last_name: string;
  plan_name: string;
  plan_price: string; // formatted: "$29.99"
  wash_count: number;
  wash_count_30d: number;
  savings_amount: string; // formatted: "$127.00"
  days_as_member: number;
  site_name: string;
  offer_details: string;
  referral_code: string;
  payment_update_link: string;
}

export function renderTemplate(template: string, variables: TemplateVariables): string {
  // Mustache auto-escapes HTML, which is fine for SMS/email
  return Mustache.render(template, variables);
}

export function buildVariables(
  member: {
    first_name: string | null;
    last_name: string | null;
    plan_name: string | null;
    plan_price_cents: number | null;
    wash_count_total: number;
    wash_count_30d: number;
    plan_start_date: string | null;
  },
  site: { name: string },
  offer: { details: string } = { details: '' },
  paymentUpdateLink: string = ''
): TemplateVariables {
  const planPriceDollars = member.plan_price_cents
    ? (member.plan_price_cents / 100).toFixed(2)
    : '0.00';

  // Estimate savings: total washes * average retail price ($15) - total paid
  const estimatedRetailPerWash = 1500; // $15.00 in cents
  const totalRetailValue = member.wash_count_total * estimatedRetailPerWash;
  const monthsAsMember = member.plan_start_date
    ? Math.max(1, Math.floor((Date.now() - new Date(member.plan_start_date).getTime()) / (30 * 24 * 60 * 60 * 1000)))
    : 1;
  const totalPaid = (member.plan_price_cents || 0) * monthsAsMember;
  const savings = Math.max(0, totalRetailValue - totalPaid);

  const daysAsMember = member.plan_start_date
    ? Math.floor((Date.now() - new Date(member.plan_start_date).getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  return {
    first_name: member.first_name || 'there',
    last_name: member.last_name || '',
    plan_name: member.plan_name || 'your plan',
    plan_price: `$${planPriceDollars}`,
    wash_count: member.wash_count_total,
    wash_count_30d: member.wash_count_30d,
    savings_amount: `$${(savings / 100).toFixed(2)}`,
    days_as_member: daysAsMember,
    site_name: site.name,
    offer_details: offer.details,
    referral_code: '', // TODO: generate unique referral codes
    payment_update_link: paymentUpdateLink,
  };
}
