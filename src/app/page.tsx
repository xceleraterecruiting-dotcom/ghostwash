'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, ChevronDown, Check, Menu } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { WaitlistForm } from '@/components/WaitlistForm';
import { useState } from 'react';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden relative">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 px-4 sm:px-6 py-4 bg-black/80 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="w-6 h-7 sm:w-7 sm:h-8 text-white" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1 border border-white/10 rounded-full px-2 py-1.5">
            <a href="#" className="px-4 py-1.5 text-sm text-white/60 hover:text-white transition">Home</a>
            <a href="#features" className="px-4 py-1.5 text-sm text-white/60 hover:text-white transition">Features</a>
            <a href="#pricing" className="px-4 py-1.5 text-sm text-white/60 hover:text-white transition">Pricing</a>
            <a href="#waitlist" className="px-4 py-1.5 text-sm bg-white text-black rounded-full hover:bg-white/90 transition font-medium">Get Started</a>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-white/60 hover:text-white transition"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/login" className="hidden md:flex items-center gap-2 text-sm text-white/60 hover:text-white transition">
            Sign In
          </Link>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden absolute top-full left-0 right-0 bg-black/95 backdrop-blur-sm border-b border-white/5 px-4 py-4"
          >
            <div className="flex flex-col gap-3">
              <a href="#" onClick={() => setMobileMenuOpen(false)} className="py-2 text-white/60 hover:text-white transition">Home</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-2 text-white/60 hover:text-white transition">Features</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 text-white/60 hover:text-white transition">Pricing</a>
              <a href="/login" onClick={() => setMobileMenuOpen(false)} className="py-2 text-white/60 hover:text-white transition">Sign In</a>
              <a href="#waitlist" onClick={() => setMobileMenuOpen(false)} className="py-2 px-4 bg-white text-black rounded-full text-center font-medium">Get Started</a>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-20 pb-12 sm:pt-0 sm:pb-0">
        {/* Floating stat nodes - hidden on mobile */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="hidden lg:flex absolute top-[22%] left-[18%] items-center gap-2"
        >
          <div className="w-2 h-2 bg-white rounded-full" />
          <div className="text-sm border border-white/10 rounded px-3 py-1.5">
            <div className="text-white font-medium">Members</div>
            <div className="text-white/50 text-xs">2,847</div>
          </div>
        </motion.div>

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="hidden lg:flex absolute top-[28%] right-[15%] items-center gap-2"
        >
          <div className="w-2 h-2 bg-white rounded-full" />
          <div className="text-sm border border-white/10 rounded px-3 py-1.5">
            <div className="text-white font-medium">Recovered</div>
            <div className="text-white/50 text-xs">$24,580</div>
          </div>
        </motion.div>

        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="hidden lg:flex absolute bottom-[32%] left-[12%] items-center gap-2"
        >
          <div className="w-2 h-2 bg-white rounded-full" />
          <div className="text-sm border border-white/10 rounded px-3 py-1.5">
            <div className="text-white font-medium">Saved</div>
            <div className="text-white/50 text-xs">127 members</div>
          </div>
        </motion.div>

        <motion.div
          animate={{ y: [0, 12, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="hidden lg:flex absolute bottom-[38%] right-[18%] items-center gap-2"
        >
          <div className="w-2 h-2 bg-white rounded-full" />
          <div className="text-sm border border-white/10 rounded px-3 py-1.5">
            <div className="text-white font-medium">Churn Rate</div>
            <div className="text-white/50 text-xs">2.1%</div>
          </div>
        </motion.div>

        {/* Content */}
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <a
              href="#waitlist"
              className="inline-flex items-center gap-2 border border-white/20 rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm mb-6 sm:mb-8 hover:bg-white/5 transition"
            >
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
              Join the founding operators
              <ArrowUpRight className="w-3 h-3" />
            </a>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.1] sm:leading-[1.05] mb-5 sm:mb-6">
              Your car wash
              <br />
              <span className="text-white/40">runs itself now.</span>
            </h1>

            <p className="text-base sm:text-lg text-white/50 max-w-md sm:max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2 sm:px-0">
              Predict churn. Save members. Recover payments. All on autopilot.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center">
              <a
                href="#waitlist"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-black px-6 py-3.5 sm:py-3 rounded-full text-sm font-medium hover:bg-white/90 transition"
              >
                Get Started
                <ArrowUpRight className="w-4 h-4" />
              </a>
              <a
                href="#features"
                className="text-white/50 text-sm hover:text-white transition"
              >
                See how it works
              </a>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator - hidden on mobile */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="hidden sm:flex absolute bottom-8 left-8 items-center gap-3 text-white/40 text-sm"
        >
          <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
            <ChevronDown className="w-4 h-4" />
          </div>
          <span>Scroll down</span>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <p className="text-white/40 text-xs sm:text-sm font-medium mb-3 sm:mb-4 tracking-wider uppercase">Capabilities</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight mb-3 sm:mb-4">
              AI that takes action
            </h2>
            <p className="text-white/50 text-base sm:text-lg max-w-xl mx-auto">
              Not dashboards. Not reports. Results.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-px sm:bg-white/10">
            {[
              {
                stat: '23%',
                title: 'Churn Prevention',
                description: 'Scores every member. Intervenes before they cancel.',
              },
              {
                stat: '40%',
                title: 'Payment Recovery',
                description: 'Learns when your members get paid. Retries at the right moment.',
              },
              {
                stat: '3x',
                title: 'Member Onboarding',
                description: '30-day sequences that build the wash habit. Automatically.',
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-black p-6 sm:p-8 lg:p-10 border border-white/10 sm:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <div className="text-5xl sm:text-6xl font-light text-white mb-4 sm:mb-6">{feature.stat}</div>
                <h3 className="text-lg sm:text-xl font-medium mb-2 sm:mb-3">{feature.title}</h3>
                <p className="text-white/50 text-sm sm:text-base leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <p className="text-white/40 text-xs sm:text-sm font-medium mb-3 sm:mb-4 tracking-wider uppercase">Daily Briefings</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight mb-4 sm:mb-6">
                Five minutes. Every morning.
              </h2>
              <p className="text-white/50 text-base sm:text-lg mb-6 sm:mb-8">
                Wake up to results, not a to-do list.
              </p>

              <div className="space-y-3 sm:space-y-4">
                {[
                  'Members saved from canceling',
                  'Payments recovered automatically',
                  'At-risk members identified',
                  'Actions taken on your behalf'
                ].map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-white/70 text-sm sm:text-base">{item}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Phone mockup */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex justify-center order-1 lg:order-2"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="relative w-64 sm:w-72 bg-white/5 rounded-[2rem] sm:rounded-[2.5rem] p-2.5 sm:p-3 border border-white/10">
                  <div className="bg-black rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden">
                    <div className="flex justify-center pt-2.5 sm:pt-3 pb-3 sm:pb-4">
                      <div className="w-16 sm:w-20 h-4 sm:h-5 bg-white/10 rounded-full" />
                    </div>
                    <div className="px-4 sm:px-5 pb-6 sm:pb-8">
                      <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-5">
                        <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                          <Logo className="w-4 sm:w-5 h-5 sm:h-6 text-white" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-medium text-white">GhostWash</div>
                          <div className="text-[10px] sm:text-xs text-white/40">Daily Briefing</div>
                        </div>
                        <div className="text-[10px] sm:text-xs text-white/30 ml-auto">7:02 AM</div>
                      </div>
                      <div className="border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-1.5 sm:space-y-2">
                        <p className="text-xs sm:text-sm text-white/70">
                          Yesterday: <span className="text-white">342 cars</span>, <span className="text-white">$8,450 revenue</span>.
                        </p>
                        <p className="text-xs sm:text-sm text-white/40">
                          4 members saved. 2 payments recovered.
                        </p>
                        <p className="text-xs sm:text-sm text-white">
                          No action needed.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <p className="text-white/40 text-xs sm:text-sm font-medium mb-3 sm:mb-4 tracking-wider uppercase">Pricing</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight mb-3 sm:mb-4">
              Simple, transparent
            </h2>
            <p className="text-white/50 text-base sm:text-lg">
              No contracts. No commission. Cancel anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Operator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0 }}
              className="border border-white/10 p-6 sm:p-8 hover:border-white/20 transition-colors"
            >
              <div className="mb-5 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-medium mb-2">Operator</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl sm:text-4xl font-light">$849</span>
                  <span className="text-white/40 text-sm">/mo</span>
                </div>
                <p className="text-white/40 text-xs sm:text-sm">per site</p>
                <p className="text-white/60 text-xs sm:text-sm mt-2">For 1-4 locations</p>
              </div>

              <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                {[
                  'Churn prediction + intervention',
                  'Payment recovery',
                  'Member onboarding sequences',
                  'Daily briefings',
                  '0% commission forever',
                  'Unlimited SMS & email',
                  'Works with any POS'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-2.5 sm:gap-3">
                    <Check className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <span className="text-white/60 text-xs sm:text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <a
                href="#waitlist"
                className="block w-full text-center py-3 border border-white/20 text-white text-sm font-medium hover:bg-white/5 transition"
              >
                Join the Waitlist
              </a>
            </motion.div>

            {/* Founding Operator - Highlighted */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="border-2 border-white p-6 sm:p-8 relative"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] sm:text-xs font-medium px-2.5 sm:px-3 py-1">
                RECOMMENDED
              </div>

              <div className="mb-5 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-medium mb-2">Founding Operator</h3>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-base sm:text-xl text-white/40 line-through">$849</span>
                  <span className="text-3xl sm:text-4xl font-light text-white">$499</span>
                  <span className="text-white/40 text-sm">/mo</span>
                </div>
                <p className="text-white/40 text-xs sm:text-sm">per site · locked for life</p>
                <p className="text-white text-xs sm:text-sm mt-2">First 10 operators only</p>
              </div>

              <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                {[
                  'Everything in Operator',
                  'Priority onboarding',
                  'Direct founder access',
                  'Shape the product roadmap'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-2.5 sm:gap-3">
                    <Check className="w-4 h-4 text-white flex-shrink-0" />
                    <span className="text-white/80 text-xs sm:text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <a
                href="#waitlist"
                className="block w-full text-center py-3 bg-white text-black text-sm font-medium hover:bg-white/90 transition"
              >
                Join the Waitlist
              </a>
              <p className="text-center text-[10px] sm:text-xs text-white/40 mt-3">Only 10 spots remaining</p>
            </motion.div>

            {/* Portfolio */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="border border-white/10 p-6 sm:p-8 hover:border-white/20 transition-colors"
            >
              <div className="mb-5 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-medium mb-2">Portfolio</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl sm:text-4xl font-light">$1,249</span>
                  <span className="text-white/40 text-sm">/mo</span>
                </div>
                <p className="text-white/40 text-xs sm:text-sm">per site</p>
                <p className="text-white/60 text-xs sm:text-sm mt-2">For 5+ locations</p>
              </div>

              <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                {[
                  'Everything in Operator',
                  'Multi-site command center',
                  'Cross-site benchmarking',
                  'Dedicated account manager',
                  'Volume discount on 10+ sites'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-2.5 sm:gap-3">
                    <Check className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <span className="text-white/60 text-xs sm:text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <a
                href="#waitlist"
                className="block w-full text-center py-3 border border-white/20 text-white text-sm font-medium hover:bg-white/5 transition"
              >
                Join the Waitlist
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight mb-3 sm:mb-4">
            Stop losing members
          </h2>
          <p className="text-white/50 text-base sm:text-lg mb-8 sm:mb-10">
            Join the waitlist for early access.
          </p>
          <WaitlistForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo className="w-5 h-6 text-white" />
            <span className="font-medium">GhostWash</span>
          </div>
          <div className="flex gap-6 sm:gap-8 text-xs sm:text-sm text-white/40">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="mailto:ghostwash.ai@gmail.com" className="hover:text-white transition">Contact</a>
          </div>
          <div className="text-xs sm:text-sm text-white/40">© 2026 GhostWash</div>
        </div>
      </footer>
    </div>
  );
}
