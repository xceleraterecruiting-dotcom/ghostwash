import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getStripe } from '@/lib/stripe/client';

// Create a Stripe Checkout session for membership signup
export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    const body = await request.json();
    const { siteId, planId, customerEmail, customerName, customerPhone } = body;

    if (!siteId || !planId || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get site info
    const { data: site } = await supabase
      .from('sites')
      .select('*, organizations(*)')
      .eq('id', siteId)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Get or create Stripe customer
    const customers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    });

    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
        phone: customerPhone,
        metadata: {
          site_id: siteId,
          organization_id: site.organization_id,
        },
      });
      customerId = customer.id;
    }

    // Plan pricing (in cents)
    const planPrices: Record<string, { amount: number; name: string }> = {
      basic: { amount: 2999, name: 'Basic Wash Membership' },
      plus: { amount: 3999, name: 'Plus Wash Membership' },
      unlimited: { amount: 4999, name: 'Unlimited VIP Membership' },
    };

    const plan = planPrices[planId];
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Create or retrieve Stripe Price for this plan
    // In production, you'd create these prices in Stripe dashboard or via API
    // For now, we create them on-the-fly with metadata
    const prices = await stripe.prices.list({
      lookup_keys: [`${siteId}_${planId}`],
      limit: 1,
    });

    let priceId: string;
    if (prices.data.length > 0) {
      priceId = prices.data[0].id;
    } else {
      // Create a product and price
      const product = await stripe.products.create({
        name: `${plan.name} - ${site.name}`,
        metadata: {
          site_id: siteId,
          plan_id: planId,
        },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.amount,
        currency: 'usd',
        recurring: { interval: 'month' },
        lookup_key: `${siteId}_${planId}`,
        metadata: {
          site_id: siteId,
          plan_id: planId,
        },
      });

      priceId = price.id;
    }

    // Create checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
      success_url: `${appUrl}/join/${siteId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/join/${siteId}?canceled=true`,
      metadata: {
        site_id: siteId,
        plan_id: planId,
        customer_name: customerName || '',
        customer_phone: customerPhone || '',
      },
      subscription_data: {
        metadata: {
          site_id: siteId,
          plan_id: planId,
        },
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
