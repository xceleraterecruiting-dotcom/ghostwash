import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getStripe } from '@/lib/stripe/client';
import Stripe from 'stripe';

// Separate webhook for GhostWash billing (vs. customer membership webhooks)
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  // Use a separate webhook secret for billing events
  const webhookSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: 'Missing signature or webhook secret' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Billing webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        // Only handle GhostWash subscriptions
        if (subscription.metadata?.type !== 'ghostwash_subscription') {
          console.log('Ignoring non-GhostWash subscription');
          return NextResponse.json({ received: true });
        }

        const organizationId = subscription.metadata.organization_id;
        if (!organizationId) {
          console.error('No organization_id in subscription metadata');
          return NextResponse.json({ received: true });
        }

        // Update organization with subscription status
        await supabase
          .from('organizations')
          .update({
            subscription_status: subscription.status,
            subscription_id: subscription.id,
            trial_ends_at: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            current_period_ends_at: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
          })
          .eq('id', organizationId);

        console.log(
          'Updated org subscription:',
          organizationId,
          subscription.status
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        if (subscription.metadata?.type !== 'ghostwash_subscription') {
          return NextResponse.json({ received: true });
        }

        const organizationId = subscription.metadata.organization_id;
        if (organizationId) {
          await supabase
            .from('organizations')
            .update({
              subscription_status: 'canceled',
              subscription_id: null,
            })
            .eq('id', organizationId);

          console.log('Canceled org subscription:', organizationId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        // Check if this is a GhostWash subscription invoice
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );

          if (subscription.metadata?.type === 'ghostwash_subscription') {
            const organizationId = subscription.metadata.organization_id;

            // Could notify the operator about payment failure
            console.log(
              'GhostWash payment failed for org:',
              organizationId
            );

            // Update status
            await supabase
              .from('organizations')
              .update({ subscription_status: 'past_due' })
              .eq('id', organizationId);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled billing event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Billing webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
