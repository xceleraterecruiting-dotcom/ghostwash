'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X, Check, ArrowRight, Zap, CreditCard, Users } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { DailyBriefingMock } from '@/components/DailyBriefingMock';
import { WaitlistForm } from '@/components/WaitlistForm';

// Intersection observer hook for scroll animations
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

// Animated section wrapper
function AnimatedSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, isInView } = useInView();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className}`}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(20px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Comparison data
  const comparisons = [
    {
      traditional: 'Shows you a churn report',
      ghostwash: 'Saves the member before they cancel',
    },
    {
      traditional: 'Alerts you about a declined card',
      ghostwash: 'Retries it at the optimal time automatically',
    },
    {
      traditional: 'Sends you a dashboard to review',
      ghostwash: 'Sends you a 5-minute morning briefing',
    },
    {
      traditional: 'Requires you to build campaigns',
      ghostwash: 'Runs campaigns autonomously within your rules',
    },
    {
      traditional: 'Charges 4% commission on online sales',
      ghostwash: '0% commission. Forever.',
    },
  ];

  // Features data
  const features = [
    {
      icon: Zap,
      title: 'Saves churning members',
      tagline: "You don't build the campaign. You don't write the message. GhostWash handles it.",
      description:
        "AI scores every member every 6 hours. When someone is about to leave, GhostWash picks the best message, the best offer, the best channel - and sends it. You wake up to 'GhostWash saved 4 members last night.'",
    },
    {
      icon: CreditCard,
      title: 'Recovers failed payments',
      tagline: "No manual retries. No chasing. It just happens.",
      description:
        "When a credit card declines, GhostWash does not just retry on day 3. It figures out when that member gets paid and retries at the exact right time. Recovery rate: 25-40% higher than standard retry.",
    },
    {
      icon: Users,
      title: 'Onboards new members',
      tagline: "Every new member gets a 30-day sequence. You set it up once. Never again.",
      description:
        'Every new member gets a personalized 30-day welcome sequence that builds the wash habit. Members who wash 2+ times in their first month retain at 3x the rate.',
    },
  ];

  // Trust metrics
  const trustMetrics = [
    { value: '0%', label: 'commission' },
    { value: '$0', label: 'setup fee' },
    { value: '14-day', label: 'free trial' },
    { value: 'Any POS', label: 'compatible' },
  ];

  // Pricing plans
  const plans = [
    {
      name: 'Operator',
      price: '$699',
      foundingPrice: '$499',
      period: '/month per site',
      description: 'For single and multi-site operators',
      features: [
        'Churn prediction + auto-intervention',
        'Payment recovery',
        'Member onboarding sequences',
        'Daily briefings',
        'Template editor',
        'Guardrails + tier controls',
        '0% commission on member signups',
        'Unlimited email and SMS',
      ],
    },
    {
      name: 'Portfolio',
      price: '$999',
      foundingPrice: '$749',
      period: '/month per site',
      description: 'For 5+ location operators',
      features: [
        'Everything in Operator',
        'Multi-site command center',
        'Cross-site benchmarking',
        'Dynamic pricing engine',
        'Staff scheduling',
        'Chemical auto-ordering',
        'Dedicated account manager',
      ],
      highlighted: true,
    },
  ];

  // Competitive comparison data
  const competitiveComparison = [
    {
      row: 'Problem solving',
      traditional: 'Shows you the problem',
      callCenter: 'Fixes it with agents',
      ghostwash: 'Fixes it autonomously',
    },
    {
      row: 'Cost',
      traditional: '$765-999/mo + 4% commission',
      callCenter: '$1,500+/mo',
      ghostwash: '$699/mo, 0% forever',
    },
    {
      row: 'Your time',
      traditional: '30-60 min/day of your time',
      callCenter: '0 min but no membership mgmt',
      ghostwash: '5-min morning briefing',
    },
    {
      row: 'Campaigns',
      traditional: 'You build campaigns',
      callCenter: 'Humans handle calls only',
      ghostwash: 'Full lifecycle on autopilot',
    },
    {
      row: 'Messaging',
      traditional: 'No inbound messaging',
      callCenter: 'Phone only, business hours',
      ghostwash: 'SMS 24/7 + cancel saves',
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-content mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="w-8 h-10 text-white" />
            <span className="text-lg font-semibold tracking-tight hidden sm:inline">
              GhostWash
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted hover:text-white transition">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted hover:text-white transition">
              Pricing
            </a>
            <Link href="/login" className="text-sm text-muted hover:text-white transition">
              Sign In
            </Link>
            <a href="#waitlist" className="btn-primary text-sm">
              Join the Waitlist
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-muted hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-black border-t border-border px-6 py-6 space-y-4">
            <a
              href="#features"
              className="block text-muted hover:text-white transition py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </a>
            <a
              href="#pricing"
              className="block text-muted hover:text-white transition py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </a>
            <Link
              href="/login"
              className="block text-muted hover:text-white transition py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>
            <a
              href="#waitlist"
              className="btn-primary block text-center mt-4"
              onClick={() => setMobileMenuOpen(false)}
            >
              Join the Waitlist
            </a>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32 relative overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: 'url(/hero-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        {/* Dark overlay - 92% for subtle texture, text readability priority */}
        <div className="absolute inset-0 bg-black/[0.92] z-[1]" />
        {/* Right-side fade for briefing card */}
        <div
          className="absolute inset-0 z-[2]"
          style={{
            background:
              'linear-gradient(to right, transparent 0%, transparent 50%, rgba(0,0,0,0.5) 70%, black 100%)',
          }}
        />
        {/* Bottom fade */}
        <div
          className="absolute inset-0 z-[3]"
          style={{
            background:
              'linear-gradient(to bottom, transparent 0%, transparent 75%, black 100%)',
          }}
        />

        <div className="max-w-content mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div className="space-y-8">
              <AnimatedSection>
                <h1 className="text-4xl md:text-5xl lg:text-display-lg font-semibold tracking-tight text-balance">
                  The AI that runs your car wash while you sleep
                </h1>
              </AnimatedSection>

              <AnimatedSection delay={100}>
                <p className="text-lg md:text-xl text-muted leading-relaxed max-w-xl">
                  GhostWash predicts which members are about to cancel - and saves them
                  automatically. No dashboards to check. No campaigns to build. Just revenue
                  recovered on autopilot.
                </p>
              </AnimatedSection>

              <AnimatedSection delay={200}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <a href="#waitlist" className="btn-primary inline-flex items-center gap-2">
                    Join the Waitlist
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <a
                    href="#how-it-works"
                    className="text-sm text-muted hover:text-white transition underline underline-offset-4"
                  >
                    See how it works
                  </a>
                </div>
              </AnimatedSection>
            </div>

            {/* Right: Product mock */}
            <AnimatedSection delay={300} className="lg:pl-8">
              <DailyBriefingMock />
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 md:py-32 bg-surface">
        <div className="max-w-content mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl md:text-display font-semibold tracking-tight text-center mb-16">
              Up and running in 3 steps
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Connect your POS',
                description:
                  "Export your member list or connect directly. Works with Washify, DRB, Sonny's, and more. Takes 5 minutes.",
              },
              {
                step: '2',
                title: 'Set your rules',
                description:
                  "Tell GhostWash your boundaries: how much to discount, how often to message, what needs your approval. You are always in control.",
              },
              {
                step: '3',
                title: 'Watch it work',
                description:
                  "GhostWash starts saving members within 24 hours. You get a daily briefing of everything it did. That is it.",
              },
            ].map((item, index) => (
              <AnimatedSection key={item.step} delay={index * 100}>
                <div className="bg-black border border-border rounded-xl p-8 h-full">
                  <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xl font-semibold mb-6">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold mb-4">{item.title}</h3>
                  <p className="text-muted leading-relaxed">{item.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Core Pitch / Comparison Section */}
      <section className="py-20 md:py-32">
        <div className="max-w-content mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl md:text-display font-semibold tracking-tight text-center mb-6">
              Other software shows you the problem.
              <br />
              <span className="text-accent">GhostWash fixes it.</span>
            </h2>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="max-w-4xl mx-auto mt-16">
              {/* Header row */}
              <div className="grid grid-cols-2 gap-4 mb-6 px-4">
                <div className="text-sm text-muted font-medium">Traditional car wash software</div>
                <div className="text-sm text-white font-medium">GhostWash</div>
              </div>

              {/* Comparison rows */}
              <div className="space-y-3">
                {comparisons.map((row, index) => (
                  <AnimatedSection key={index} delay={150 + index * 50}>
                    <div className="grid grid-cols-2 gap-4 bg-surface border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3 text-muted text-sm md:text-base">
                        <span className="text-muted/50 mt-0.5">—</span>
                        <span>{row.traditional}</span>
                      </div>
                      <div className="flex items-start gap-3 text-white text-sm md:text-base font-medium">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{row.ghostwash}</span>
                      </div>
                    </div>
                  </AnimatedSection>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32 bg-surface">
        <div className="max-w-content mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl md:text-display font-semibold tracking-tight text-center mb-16">
              What GhostWash does while you&apos;re not looking
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <AnimatedSection key={feature.title} delay={index * 100}>
                <div className="bg-black border border-border rounded-xl p-8 h-full">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-6">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-accent text-sm font-medium mb-4">{feature.tagline}</p>
                  <p className="text-muted leading-relaxed">{feature.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* 5-Minute Morning Section */}
      <section className="py-20 md:py-32">
        <div className="max-w-content mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl md:text-display font-semibold tracking-tight text-center mb-12">
              Your entire morning with GhostWash
            </h2>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="max-w-md mx-auto">
              {/* Phone mockup */}
              <div className="bg-[#1a1a1a] rounded-3xl p-3 shadow-2xl">
                {/* Phone notch */}
                <div className="flex justify-center mb-2">
                  <div className="w-20 h-5 bg-black rounded-full" />
                </div>

                {/* Notification */}
                <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
                  {/* App header */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                      <Logo className="w-6 h-7 text-accent" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">GhostWash</p>
                      <p className="text-muted text-xs">Daily Briefing</p>
                    </div>
                    <p className="text-muted text-xs ml-auto">7:02 AM</p>
                  </div>

                  {/* Message content */}
                  <div className="space-y-3 text-sm">
                    <p className="text-white leading-relaxed">
                      Good morning. Yesterday: <span className="text-accent font-medium">342 cars</span>,{' '}
                      <span className="text-accent font-medium">$8,450 revenue</span>,{' '}
                      <span className="text-green-500 font-medium">4 members saved</span>.
                    </p>
                    <p className="text-muted leading-relaxed">
                      Today: Sunny, 78F, projecting 380 cars. Schedule is set. Chemicals stocked.
                    </p>
                    <p className="text-white font-medium">No action needed.</p>
                  </div>
                </div>

                {/* Phone home indicator */}
                <div className="flex justify-center mt-4">
                  <div className="w-32 h-1 bg-white/20 rounded-full" />
                </div>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <p className="text-center text-lg text-muted mt-12 max-w-xl mx-auto">
              That&apos;s your 5-minute check-in. GhostWash handled the rest.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 md:py-32">
        <div className="max-w-content mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl md:text-display font-semibold tracking-tight text-center mb-12">
              Built for car wash operators,
              <br />
              by people who understand the business
            </h2>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {trustMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="bg-surface border border-border rounded-xl p-6 text-center"
                >
                  <div className="text-2xl md:text-3xl font-semibold text-accent mb-1">
                    {metric.value}
                  </div>
                  <div className="text-sm text-muted">{metric.label}</div>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <p className="text-center text-muted">
              GhostWash integrates with Washify, DRB Patheon, DRB SiteWatch, Sonny&apos;s, ICS,
              Micrologic, NXT, and more.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Competitive Comparison Section */}
      <section className="py-20 md:py-32 bg-surface">
        <div className="max-w-content mx-auto px-6">
          <AnimatedSection>
            <h2 className="text-3xl md:text-display font-semibold tracking-tight text-center mb-12">
              How GhostWash compares
            </h2>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="overflow-x-auto">
              <table className="w-full max-w-4xl mx-auto">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-4 px-4 text-left text-sm font-medium text-muted"></th>
                    <th className="py-4 px-4 text-center text-sm font-medium text-muted">Traditional Software</th>
                    <th className="py-4 px-4 text-center text-sm font-medium text-muted">Human Call Centers</th>
                    <th className="py-4 px-4 text-center text-sm font-medium text-accent">GhostWash</th>
                  </tr>
                </thead>
                <tbody>
                  {competitiveComparison.map((row, index) => (
                    <tr key={row.row} className="border-b border-border/50">
                      <td className="py-4 px-4 text-sm text-muted">{row.row}</td>
                      <td className="py-4 px-4 text-center text-sm text-muted">{row.traditional}</td>
                      <td className="py-4 px-4 text-center text-sm text-muted">{row.callCenter}</td>
                      <td className="py-4 px-4 text-center text-sm text-white font-medium">{row.ghostwash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-32">
        <div className="max-w-content mx-auto px-6">
          <AnimatedSection>
            <h2 className="text-3xl md:text-display font-semibold tracking-tight text-center mb-4">
              Simple pricing. No surprises.
            </h2>
          </AnimatedSection>

          <AnimatedSection delay={50}>
            <p className="text-center text-muted mb-8">
              No contracts. No setup fees. No commission. Cancel anytime.
            </p>
          </AnimatedSection>

          {/* Founding Operator Banner */}
          <AnimatedSection delay={75}>
            <div className="max-w-4xl mx-auto mb-8">
              <div className="bg-accent/10 border border-accent/30 rounded-lg px-6 py-4 text-center">
                <p className="text-white font-medium">
                  Founding operator pricing: <span className="text-accent">$499/mo locked for life</span>. Limited to first 10 operators.
                </p>
              </div>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan, index) => (
              <AnimatedSection key={plan.name} delay={100 + index * 100}>
                <div
                  className={`bg-black border rounded-xl p-8 h-full flex flex-col ${
                    plan.highlighted ? 'border-accent' : 'border-border'
                  }`}
                >
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-xl text-muted line-through">{plan.price}</span>
                      <span className="text-4xl font-semibold text-accent">{plan.foundingPrice}</span>
                      <span className="text-muted text-sm">{plan.period}</span>
                    </div>
                    <p className="text-muted text-sm">{plan.description}</p>
                  </div>

                  <ul className="space-y-3 mb-8 flex-grow">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm">
                        <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                        <span className="text-muted">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href="#waitlist"
                    className={`block text-center py-3 rounded-lg font-medium transition ${
                      plan.highlighted
                        ? 'bg-accent text-white hover:bg-accent-hover'
                        : 'border border-border text-white hover:border-border-hover hover:bg-surface'
                    }`}
                  >
                    Join the Waitlist
                  </a>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist Section */}
      <section id="waitlist" className="py-20 md:py-32 bg-surface">
        <div className="max-w-content mx-auto">
          <AnimatedSection>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-display font-semibold tracking-tight mb-6">
                Stop losing members in your sleep
              </h2>
              <p className="text-lg text-muted max-w-2xl mx-auto">
                Join the waitlist to be among our founding operators. We&apos;ll connect to your
                POS and show you exactly which members are at risk.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="max-w-2xl mx-auto">
              <p className="text-sm text-muted text-center mb-6">
                We&apos;re onboarding 10 founding operators with priority access and dedicated setup support.
              </p>
              <WaitlistForm />
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-content mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <Logo className="w-8 h-10 text-white" />
              <span className="text-lg font-semibold tracking-tight">GhostWash</span>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
              <a href="#features" className="text-sm text-muted hover:text-white transition">
                Features
              </a>
              <a href="#pricing" className="text-sm text-muted hover:text-white transition">
                Pricing
              </a>
              <a href="#waitlist" className="text-sm text-muted hover:text-white transition">
                Join Waitlist
              </a>
              <Link href="/login" className="text-sm text-muted hover:text-white transition">
                Sign In
              </Link>
            </nav>

            <a
              href="mailto:hello@ghostwash.ai"
              className="text-sm text-muted hover:text-white transition"
            >
              hello@ghostwash.ai
            </a>
          </div>

          <div className="mt-12 pt-8 border-t border-border text-center">
            <p className="text-sm text-muted">&copy; 2026 GhostWash</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
