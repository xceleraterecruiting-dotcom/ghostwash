import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getStripe } from '@/lib/stripe/client';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Missing signature or webhook secret' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(supabase, subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabase, invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleCheckoutCompleted(
  supabase: any,
  session: Stripe.Checkout.Session
) {
  const { site_id, plan_id, customer_name, customer_phone } =
    session.metadata || {};

  if (!site_id) {
    console.error('No site_id in session metadata');
    return;
  }

  // Get site's organization
  const { data: site } = await supabase
    .from('sites')
    .select('organization_id')
    .eq('id', site_id)
    .single();

  if (!site) {
    console.error('Site not found:', site_id);
    return;
  }

  // Parse name
  const nameParts = (customer_name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Create or update member
  const { data: existingMember } = await supabase
    .from('members')
    .select('id')
    .eq('email', session.customer_email)
    .eq('site_id', site_id)
    .single();

  const memberData = {
    organization_id: site.organization_id,
    site_id: site_id,
    email: session.customer_email,
    phone: customer_phone || null,
    first_name: firstName,
    last_name: lastName,
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: session.subscription as string,
    plan_name: plan_id || 'basic',
    status: 'active',
    source: 'online',
    join_date: new Date().toISOString(),
  };

  if (existingMember) {
    await supabase.from('members').update(memberData).eq('id', existingMember.id);
  } else {
    await supabase.from('members').insert(memberData);
  }

  // Log the action
  await supabase.from('agent_actions').insert({
    organization_id: site.organization_id,
    site_id: site_id,
    agent_type: 'membership',
    decision_type: 'new_member',
    tier_at_decision: 1,
    input_context: {
      customer_email: session.customer_email,
      plan_id: plan_id,
      source: 'online_checkout',
    },
    decision_made: 'New member signup via online checkout',
    action_taken: 'created_membership',
    outcome_status: 'success',
  });

  console.log('New member created from checkout:', session.customer_email);
}

async function handleSubscriptionUpdated(
  supabase: any,
  subscription: Stripe.Subscription
) {
  const { site_id } = subscription.metadata || {};

  if (!site_id) return;

  // Update member status based on subscription status
  const status = subscription.status === 'active' ? 'active' : 'inactive';

  await supabase
    .from('members')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subscription.id);

  console.log('Subscription updated:', subscription.id, status);
}

async function handleSubscriptionCanceled(
  supabase: any,
  subscription: Stripe.Subscription
) {
  const { site_id } = subscription.metadata || {};

  // Update member to churned
  const { data: member } = await supabase
    .from('members')
    .select('id, site_id, organization_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (member) {
    await supabase
      .from('members')
      .update({
        status: 'churned',
        churn_date: new Date().toISOString(),
      })
      .eq('id', member.id);

    // Log the churn
    await supabase.from('agent_actions').insert({
      organization_id: member.organization_id,
      site_id: member.site_id,
      agent_type: 'membership',
      decision_type: 'member_churned',
      tier_at_decision: 1,
      input_context: {
        member_id: member.id,
        subscription_id: subscription.id,
        reason: subscription.cancellation_details?.reason || 'unknown',
      },
      decision_made: 'Member subscription canceled',
      action_taken: 'marked_churned',
      outcome_status: 'completed',
    });
  }

  console.log('Subscription canceled:', subscription.id);
}

async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  const { data: member } = await supabase
    .from('members')
    .select('id, cc_last_failed, cc_fail_count')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (member) {
    await supabase
      .from('members')
      .update({
        cc_last_failed: new Date().toISOString(),
        cc_fail_count: (member.cc_fail_count || 0) + 1,
      })
      .eq('id', member.id);
  }

  console.log('Payment failed for subscription:', subscriptionId);
}

async function handlePaymentSucceeded(supabase: any, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  // Clear payment failure flags
  await supabase
    .from('members')
    .update({
      cc_last_failed: null,
      cc_fail_count: 0,
      last_payment_date: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  console.log('Payment succeeded for subscription:', subscriptionId);
}
