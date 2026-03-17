'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/components/providers/AuthProvider';

type Step = 'welcome' | 'organization' | 'site' | 'pos' | 'templates' | 'guardrails' | 'complete';

interface FormData {
  orgName: string;
  siteName: string;
  siteAddress: string;
  posType: string;
  ownerEmail: string;
  ownerPhone: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSiteId, setCreatedSiteId] = useState<string | null>(null);
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null);
  const [twilioError, setTwilioError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    orgName: '',
    siteName: '',
    siteAddress: '',
    posType: 'csv',
    ownerEmail: '',
    ownerPhone: '',
  });

  // Auto-populate email from authenticated user
  useEffect(() => {
    if (user?.email && !formData.ownerEmail) {
      setFormData((prev) => ({ ...prev, ownerEmail: user.email! }));
    }
  }, [user, formData.ownerEmail]);

  const steps: { key: Step; label: string }[] = [
    { key: 'welcome', label: 'Welcome' },
    { key: 'organization', label: 'Organization' },
    { key: 'site', label: 'Site' },
    { key: 'pos', label: 'POS' },
    { key: 'templates', label: 'Templates' },
    { key: 'guardrails', label: 'Guardrails' },
    { key: 'complete', label: 'Complete' },
  ];

  const currentIndex = steps.findIndex((s) => s.key === step);

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex].key);
    }
  };

  const handleBack = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex].key);
    }
  };

  const createOrgAndSite = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: formData.orgName,
          ownerEmail: formData.ownerEmail,
          ownerPhone: formData.ownerPhone,
          siteName: formData.siteName,
          siteAddress: formData.siteAddress,
          posType: formData.posType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCreatedSiteId(data.site.id);

      // Capture Twilio provisioning result
      if (data.site.twilio_number_formatted) {
        setTwilioNumber(data.site.twilio_number_formatted);
      }
      if (data.twilioError) {
        setTwilioError(data.twilioError);
      }

      handleNext();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goToDashboard = () => {
    if (createdSiteId) {
      router.push(`/dashboard/${createdSiteId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Progress Bar */}
      <div className="border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    i < currentIndex
                      ? 'bg-success text-white'
                      : i === currentIndex
                      ? 'bg-accent text-white'
                      : 'bg-surface-hover text-muted-foreground'
                  }`}
                >
                  {i < currentIndex ? '✓' : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`w-12 md:w-24 h-1 mx-2 transition-colors ${
                      i < currentIndex ? 'bg-success' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            {steps.map((s) => (
              <span key={s.key} className="w-8 text-center">
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <Image src="/logo.svg" alt="GhostWash" width={120} height={168} priority />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Welcome to GhostWash
            </h1>
            <p className="text-muted text-lg mb-8">
              Your AI-powered car wash operations platform. Let's get you set up
              in just a few minutes.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-all duration-150">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-accent/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-foreground font-semibold mb-1">AI Agent</h3>
                <p className="text-muted text-sm">
                  Autonomous decisions for churn, payments, and more
                </p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-all duration-150">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-accent/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-foreground font-semibold mb-1">Daily Briefings</h3>
                <p className="text-muted text-sm">
                  Wake up to insights, not alarms
                </p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-all duration-150">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-accent/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-foreground font-semibold mb-1">Your Control</h3>
                <p className="text-muted text-sm">
                  Set guardrails and autonomy tiers
                </p>
              </div>
            </div>

            <button
              onClick={handleNext}
              className="bg-accent hover:bg-accent-hover text-white font-bold py-4 px-8 rounded-lg text-lg transition-all duration-150 active:scale-[0.98] shadow-lg shadow-accent/25"
            >
              Get Started
            </button>
          </div>
        )}

        {/* Organization Step */}
        {step === 'organization' && (
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Your Organization
            </h2>
            <p className="text-muted mb-8">
              First, let's set up your business.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm text-muted mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={formData.orgName}
                  onChange={(e) =>
                    setFormData({ ...formData, orgName: e.target.value })
                  }
                  placeholder="Smith's Car Wash LLC"
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-2">
                  Your Email *
                </label>
                <input
                  type="email"
                  value={formData.ownerEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, ownerEmail: e.target.value })
                  }
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.ownerPhone}
                  onChange={(e) =>
                    setFormData({ ...formData, ownerPhone: e.target.value })
                  }
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
                />
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={handleBack}
                className="text-muted hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                disabled={!formData.orgName || !formData.ownerEmail}
                className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition-all duration-150 active:scale-[0.98]"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Site Step */}
        {step === 'site' && (
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Your First Location
            </h2>
            <p className="text-muted mb-8">
              You can add more locations later.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm text-muted mb-2">
                  Location Name *
                </label>
                <input
                  type="text"
                  value={formData.siteName}
                  onChange={(e) =>
                    setFormData({ ...formData, siteName: e.target.value })
                  }
                  placeholder="Downtown Location"
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.siteAddress}
                  onChange={(e) =>
                    setFormData({ ...formData, siteAddress: e.target.value })
                  }
                  placeholder="123 Main St, Anytown, USA"
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-danger/10 border border-danger/20 rounded-lg p-3">
                <p className="text-danger text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={handleBack}
                className="text-muted hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={createOrgAndSite}
                disabled={!formData.siteName || loading}
                className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition-all duration-150 active:scale-[0.98]"
              >
                {loading ? 'Creating...' : 'Create & Continue'}
              </button>
            </div>
          </div>
        )}

        {/* POS Step */}
        {step === 'pos' && (
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Connect Your POS
            </h2>
            <p className="text-muted mb-8">
              How should we import your member data?
            </p>

            <div className="space-y-4">
              {/* CSV Upload - Primary Option */}
              <div
                onClick={() => setFormData({ ...formData, posType: 'csv' })}
                className={`bg-surface border-2 rounded-xl p-6 cursor-pointer transition-all duration-150 ${
                  formData.posType === 'csv'
                    ? 'border-accent bg-accent/10 ring-1 ring-accent/20'
                    : 'border-border hover:border-border-hover'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground font-semibold">CSV Upload</h3>
                      <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    </div>
                    <p className="text-muted text-sm mt-1">
                      Export members from your POS and upload a CSV file. We'll
                      help you map the columns. Works with any POS system.
                    </p>
                  </div>
                </div>
              </div>

              {/* Washify */}
              <div
                onClick={() => setFormData({ ...formData, posType: 'washify' })}
                className={`bg-surface border-2 rounded-xl p-6 cursor-pointer transition-all duration-150 ${
                  formData.posType === 'washify'
                    ? 'border-accent bg-accent/10 ring-1 ring-accent/20'
                    : 'border-border hover:border-border-hover'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-foreground font-semibold mb-1">Washify</h3>
                    <p className="text-muted text-sm">
                      Washify integration available — enter your API credentials in Settings after setup, or{' '}
                      <a href="mailto:support@ghostwash.ai" className="text-accent hover:underline">
                        contact support@ghostwash.ai
                      </a>{' '}
                      to set up the connection.
                    </p>
                    <span className="inline-block mt-2 text-xs bg-success/20 text-success px-2 py-1 rounded-full">
                      Available
                    </span>
                  </div>
                </div>
              </div>

              {/* DRB */}
              <div
                onClick={() => setFormData({ ...formData, posType: 'drb' })}
                className={`bg-surface border-2 rounded-xl p-6 cursor-pointer transition-all duration-150 ${
                  formData.posType === 'drb'
                    ? 'border-accent bg-accent/10 ring-1 ring-accent/20'
                    : 'border-border hover:border-border-hover'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-foreground font-semibold mb-1">DRB / Patheon</h3>
                    <p className="text-muted text-sm">
                      We're in Patheon certification. Use CSV for now.
                    </p>
                    <span className="inline-block mt-2 text-xs bg-warning/20 text-warning px-2 py-1 rounded-full">
                      Coming Soon
                    </span>
                  </div>
                </div>
              </div>

              {/* Other */}
              <div
                onClick={() => setFormData({ ...formData, posType: 'other' })}
                className={`bg-surface border-2 rounded-xl p-6 cursor-pointer transition-all duration-150 ${
                  formData.posType === 'other'
                    ? 'border-accent bg-accent/10 ring-1 ring-accent/20'
                    : 'border-border hover:border-border-hover'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-foreground font-semibold mb-1">Other POS</h3>
                    <p className="text-muted text-sm">
                      Using Rinsed, Everwash, or another POS? Use CSV import for now and we'll contact you about integration.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={handleBack}
                className="text-muted hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg transition-all duration-150 active:scale-[0.98]"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Templates Step */}
        {step === 'templates' && (
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Message Templates
            </h2>
            <p className="text-muted mb-8">
              We've pre-loaded proven templates. You can customize them anytime.
            </p>

            <div className="space-y-3">
              {[
                {
                  type: 'Churn Win-back',
                  channel: 'SMS',
                  preview:
                    "Hey {{first_name}}! We noticed you haven't visited {{site_name}} lately...",
                },
                {
                  type: 'CC Decline',
                  channel: 'Email',
                  preview:
                    'Your membership payment needs attention. Update your card...',
                },
                {
                  type: 'Day 0 Welcome',
                  channel: 'SMS',
                  preview:
                    "Welcome to {{site_name}}! Here's how to get the most from your membership...",
                },
                {
                  type: 'Review Request',
                  channel: 'SMS',
                  preview:
                    "{{first_name}}, you've saved {{savings_amount}} with us! Mind leaving a quick review?",
                },
              ].map((template) => (
                <div
                  key={template.type}
                  className="bg-surface border border-border rounded-xl p-4 hover:border-border-hover transition-all duration-150"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground font-medium">{template.type}</span>
                    <span className="text-xs bg-surface-hover text-muted px-2 py-1 rounded-full">
                      {template.channel}
                    </span>
                  </div>
                  <p className="text-muted text-sm">{template.preview}</p>
                </div>
              ))}
            </div>

            <p className="text-muted-foreground text-sm mt-4 text-center">
              10+ templates loaded • Edit anytime in Settings
            </p>

            <div className="flex justify-between mt-8">
              <button
                onClick={handleBack}
                className="text-muted hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg transition-all duration-150 active:scale-[0.98]"
              >
                Looks Good
              </button>
            </div>
          </div>
        )}

        {/* Guardrails Step */}
        {step === 'guardrails' && (
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Safety Guardrails
            </h2>
            <p className="text-muted mb-8">
              Here are the default limits we've set. You can customize these in Settings after setup.
            </p>

            <div className="space-y-6">
              <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-all duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-foreground font-medium">
                    Max Messages Per Member
                  </span>
                  <span className="text-accent font-bold font-mono">3/week</span>
                </div>
                <p className="text-muted text-sm">
                  We'll never over-message your members
                </p>
              </div>

              <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-all duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-foreground font-medium">
                    Cooldown Between Contact
                  </span>
                  <span className="text-accent font-bold font-mono">7 days</span>
                </div>
                <p className="text-muted text-sm">
                  Minimum wait between contacting the same member
                </p>
              </div>

              <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-all duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-foreground font-medium">
                    Max Discount Offered
                  </span>
                  <span className="text-accent font-bold font-mono">25%</span>
                </div>
                <p className="text-muted text-sm">
                  Limits on promotional discounts
                </p>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={handleBack}
                className="text-muted hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg transition-all duration-150 active:scale-[0.98]"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-success/20 flex items-center justify-center">
              <svg className="w-12 h-12 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">You're All Set!</h1>
            <p className="text-muted text-lg mb-8">
              GhostWash is ready to start working for you. Next up: import your
              member data.
            </p>

            {/* Twilio Number Display */}
            {twilioNumber && (
              <div className="bg-gradient-to-r from-accent/20 to-accent/10 border border-accent/30 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-muted text-sm font-medium">Your SMS Number</span>
                </div>
                <div className="text-3xl font-bold text-accent font-mono">
                  {twilioNumber}
                </div>
                <p className="text-muted text-sm mt-2">
                  This is your dedicated number for member communications
                </p>
              </div>
            )}

            {twilioError && (
              <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-8">
                <div className="flex items-center justify-center gap-2 text-warning">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm font-medium">Phone number pending</span>
                </div>
                <p className="text-muted text-xs mt-1">
                  We'll provision your SMS number shortly. Check Settings to verify.
                </p>
              </div>
            )}

            <div className="bg-surface border border-border rounded-xl p-6 mb-8">
              <h3 className="text-foreground font-semibold mb-4">Quick Start:</h3>
              <ol className="text-left text-muted space-y-3">
                <li className="flex items-start gap-3">
                  <span className="bg-accent/20 text-accent w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    1
                  </span>
                  <span>Upload your member CSV from your POS</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-accent/20 text-accent w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    2
                  </span>
                  <span>Review the AI's first recommendations</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-accent/20 text-accent w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    3
                  </span>
                  <span>Promote decisions to Tier 1 as you build trust</span>
                </li>
              </ol>
            </div>

            <button
              onClick={goToDashboard}
              className="bg-accent hover:bg-accent-hover text-white font-bold py-4 px-8 rounded-lg text-lg transition-all duration-150 active:scale-[0.98]"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
