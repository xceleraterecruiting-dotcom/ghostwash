'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface BillingStatus {
  status: string;
  trial_ends: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface Organization {
  id: string;
  name: string;
}

function BillingContent() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchBillingStatus();
    }
  }, [selectedOrg]);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/setup');
      const data = await res.json();
      setOrganizations(data.organizations || []);
      if (data.organizations?.length > 0) {
        setSelectedOrg(data.organizations[0].id);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBillingStatus = async () => {
    if (!selectedOrg) return;

    try {
      const res = await fetch(`/api/billing?organizationId=${selectedOrg}`);
      const data = await res.json();
      setBillingStatus(data);
    } catch (error) {
      console.error('Error fetching billing status:', error);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedOrg) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkout',
          organizationId: selectedOrg,
          returnUrl: window.location.href,
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!selectedOrg) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'portal',
          organizationId: selectedOrg,
          returnUrl: window.location.href,
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400',
      trialing: 'bg-blue-500/20 text-blue-400',
      past_due: 'bg-yellow-500/20 text-yellow-400',
      canceled: 'bg-red-500/20 text-red-400',
      none: 'bg-gray-500/20 text-gray-400',
    };

    const labels: Record<string, string> = {
      active: 'Active',
      trialing: 'Free Trial',
      past_due: 'Past Due',
      canceled: 'Canceled',
      none: 'Not Subscribed',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm ${colors[status] || colors.none}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-navy flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-navy">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Billing</h1>
            <p className="text-gray-400 text-sm">Manage your GhostWash subscription</p>
          </div>
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {canceled && (
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-yellow-400">
              Checkout was canceled. You can try again when you're ready.
            </p>
          </div>
        )}

        {/* Organization Selector */}
        {organizations.length > 1 && (
          <div className="mb-8">
            <label className="block text-sm text-gray-400 mb-2">Organization</label>
            <select
              value={selectedOrg || ''}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Pricing Card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Current Plan */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-white mb-6">Your Plan</h2>

            {billingStatus ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Status</span>
                  {getStatusBadge(billingStatus.status)}
                </div>

                {billingStatus.status === 'trialing' && billingStatus.trial_ends && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Trial Ends</span>
                    <span className="text-white">{formatDate(billingStatus.trial_ends)}</span>
                  </div>
                )}

                {billingStatus.status === 'active' && billingStatus.current_period_end && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Next Billing Date</span>
                    <span className="text-white">
                      {formatDate(billingStatus.current_period_end)}
                    </span>
                  </div>
                )}

                {billingStatus.cancel_at_period_end && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mt-4">
                    <p className="text-yellow-400 text-sm">
                      Your subscription will end on {formatDate(billingStatus.current_period_end)}
                    </p>
                  </div>
                )}

                <div className="pt-4 mt-4 border-t border-white/10">
                  {billingStatus.status === 'none' ? (
                    <button
                      onClick={handleSubscribe}
                      disabled={actionLoading}
                      className="w-full bg-brand-gold hover:bg-brand-gold/90 text-brand-navy font-bold py-3 px-6 rounded-lg disabled:opacity-50"
                    >
                      {actionLoading ? 'Loading...' : 'Start Free Trial'}
                    </button>
                  ) : (
                    <button
                      onClick={handleManageBilling}
                      disabled={actionLoading}
                      className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-lg disabled:opacity-50"
                    >
                      {actionLoading ? 'Loading...' : 'Manage Subscription'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-gray-400">Loading billing status...</div>
            )}
          </div>

          {/* Plan Details */}
          <div className="bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 border border-brand-gold/30 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">GhostWash AI</h2>
              <span className="bg-brand-gold/20 text-brand-gold text-xs px-2 py-1 rounded">
                PRO
              </span>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-white">$499</span>
              <span className="text-gray-400">/month</span>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                'Unlimited members',
                'All 5 AI agents',
                'SMS & Email automation',
                'Daily briefings',
                'Custom templates',
                'Priority support',
                '0% transaction fees',
                'Unlimited sites',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-gray-300">
                  <span className="text-brand-gold">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-gray-400 text-sm">
                <span className="text-white font-medium">14-day free trial</span> included.
                Cancel anytime. No setup fees.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-white mb-6">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {[
              {
                q: 'What happens after my trial ends?',
                a: "Your subscription will automatically begin, and you'll be charged $499/month. You can cancel anytime during or after the trial.",
              },
              {
                q: 'Are there any transaction fees?',
                a: 'No! Unlike competitors who take 15-20% of your membership revenue, GhostWash charges 0% transaction fees. You keep 100% of your membership revenue.',
              },
              {
                q: 'Can I add multiple locations?',
                a: 'Yes, your subscription includes unlimited sites. Add as many car wash locations as you need.',
              },
              {
                q: 'How do I cancel?',
                a: 'You can cancel anytime from the billing portal. Your access continues until the end of your billing period.',
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-xl p-6"
              >
                <h3 className="text-white font-medium mb-2">{faq.q}</h3>
                <p className="text-gray-400 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-navy flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
