'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface Plan {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  interval: string;
  features: string[];
  popular?: boolean;
}

interface SiteInfo {
  id: string;
  name: string;
  address: string;
}

function JoinContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.siteId as string;
  const canceled = searchParams.get('canceled');

  const [site, setSite] = useState<SiteInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    fetchPlans();
  }, [siteId]);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`/api/plans/${siteId}`);
      if (!res.ok) throw new Error('Failed to load plans');
      const data = await res.json();
      setSite(data.site);
      setPlans(data.plans);
      // Auto-select popular plan
      const popular = data.plans.find((p: Plan) => p.popular);
      if (popular) setSelectedPlan(popular.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlan || !email) {
      setError('Please select a plan and enter your email');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          planId: selectedPlan,
          customerEmail: email,
          customerName: name,
          customerPhone: phone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-navy to-brand-navy/90 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (error && !site) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-navy to-brand-navy/90 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <p className="text-gray-400 mt-2">Please check the URL and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy to-brand-navy/90">
      {/* Header */}
      <header className="text-center py-12 px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
          Join {site?.name}
        </h1>
        <p className="text-gray-400 text-lg">
          Unlimited car washes starting at just $29.99/month
        </p>
        {site?.address && (
          <p className="text-gray-500 text-sm mt-2">{site.address}</p>
        )}
      </header>

      {canceled && (
        <div className="max-w-4xl mx-auto px-4 mb-6">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
            <p className="text-yellow-400">
              Checkout was canceled. Select a plan to try again.
            </p>
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative bg-white/5 border-2 rounded-2xl p-6 cursor-pointer transition-all ${
                selectedPlan === plan.id
                  ? 'border-brand-gold bg-brand-gold/10 scale-105'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-gold text-brand-navy text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
              <p className="text-gray-400 text-sm mb-4">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-white">
                  {formatPrice(plan.price_cents)}
                </span>
                <span className="text-gray-400">/{plan.interval}</span>
              </div>

              <ul className="space-y-2">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {selectedPlan === plan.id && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 bg-brand-gold rounded-full flex items-center justify-center">
                    <span className="text-brand-navy font-bold">✓</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Signup Form */}
        <div className="max-w-md mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-6 text-center">
              Complete Your Signup
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
                <p className="text-xs text-gray-500 mt-1">
                  For membership updates and exclusive offers
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !selectedPlan}
                className="w-full bg-brand-gold hover:bg-brand-gold/90 text-brand-navy font-bold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  'Processing...'
                ) : selectedPlan ? (
                  `Continue to Payment - ${formatPrice(
                    plans.find((p) => p.id === selectedPlan)?.price_cents || 0
                  )}/mo`
                ) : (
                  'Select a Plan Above'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-500 text-xs">
                By signing up, you agree to our terms of service and privacy policy.
                <br />
                Cancel anytime. Secure payment by Stripe.
              </p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="p-6">
            <div className="text-4xl mb-3">🚗</div>
            <h3 className="text-white font-semibold mb-1">Unlimited Washes</h3>
            <p className="text-gray-400 text-sm">
              Wash as often as you want, no limits
            </p>
          </div>
          <div className="p-6">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="text-white font-semibold mb-1">Skip the Line</h3>
            <p className="text-gray-400 text-sm">
              RFID tag for express lane access
            </p>
          </div>
          <div className="p-6">
            <div className="text-4xl mb-3">💰</div>
            <h3 className="text-white font-semibold mb-1">Save Money</h3>
            <p className="text-gray-400 text-sm">
              Members save an average of $50/month
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center">
        <p className="text-gray-500 text-sm">
          Powered by GhostWash.AI - The Future of Car Wash Operations
        </p>
      </footer>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-brand-navy to-brand-navy/90 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
