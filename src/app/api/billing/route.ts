import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getStripe } from '@/lib/stripe/client';

// GhostWash pricing
const GHOSTWASH_PRICE_MONTHLY = 49900; // $499.00
const GHOSTWASH_PRODUCT_NAME = 'GhostWash AI Platform';

// Create a billing portal session or checkout session for GhostWash subscription
export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    const body = await request.json();
    const { action, organizationId, returnUrl } = body;

    const supabase = createServerClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Get organization
    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (action === 'portal') {
      // Create billing portal session for existing subscribers
      if (!org.stripe_customer_id) {
        return NextResponse.json(
          { error: 'No subscription found' },
          { status: 400 }
        );
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: returnUrl || `${appUrl}/dashboard`,
      });

      return NextResponse.json({ url: session.url });
    }

    // Create checkout session for new subscription
    // First, get or create customer
    let customerId = org.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: {
          organization_id: organizationId,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', organizationId);
    }

    // Get or create GhostWash product and price
    const prices = await stripe.prices.list({
      lookup_keys: ['ghostwash_monthly'],
      limit: 1,
    });

    let priceId: string;
    if (prices.data.length > 0) {
      priceId = prices.data[0].id;
    } else {
      // Create product and price
      const product = await stripe.products.create({
        name: GHOSTWASH_PRODUCT_NAME,
        description: 'AI-powered car wash operations platform',
        metadata: { type: 'ghostwash_subscription' },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: GHOSTWASH_PRICE_MONTHLY,
        currency: 'usd',
        recurring: { interval: 'month' },
        lookup_key: 'ghostwash_monthly',
      });

      priceId = price.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl || `${appUrl}/billing?canceled=true`,
      subscription_data: {
        metadata: {
          organization_id: organizationId,
          type: 'ghostwash_subscription',
        },
        trial_period_days: 14, // 14-day free trial
      },
      metadata: {
        organization_id: organizationId,
        type: 'ghostwash_subscription',
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Billing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Get billing status for an organization
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // If no Stripe customer, not subscribed
    if (!org.stripe_customer_id) {
      return NextResponse.json({
        status: 'none',
        trial_ends: null,
        current_period_end: null,
      });
    }

    // Get subscription from Stripe
    const stripe = getStripe();
    const subscriptions = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      status: 'all',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({
        status: 'none',
        trial_ends: null,
        current_period_end: null,
      });
    }

    const sub = subscriptions.data[0];

    return NextResponse.json({
      status: sub.status,
      trial_ends: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
    });
  } catch (error: any) {
    console.error('Billing status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
