'use client';

import Link from 'next/link';

export default function BillingSuccessPage() {
  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Success Animation */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-6">
            <span className="text-5xl">🎉</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to GhostWash!
          </h1>
          <p className="text-gray-400 text-lg">
            Your subscription is now active. Let's get your AI agent working for you.
          </p>
        </div>

        {/* What's Included */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
          <h2 className="text-xl font-semibold text-white mb-6">
            What's Included
          </h2>

          <div className="grid grid-cols-2 gap-4 text-left">
            {[
              { icon: '🤖', label: 'AI Agents', desc: 'All 5 agents active' },
              { icon: '📱', label: 'SMS & Email', desc: 'Automated outreach' },
              { icon: '📊', label: 'Daily Briefings', desc: 'Morning reports' },
              { icon: '🛡️', label: 'Guardrails', desc: 'Full control' },
              { icon: '🏪', label: 'Unlimited Sites', desc: 'Add any location' },
              { icon: '💳', label: '0% Fees', desc: 'Keep all revenue' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <div className="text-white font-medium text-sm">{item.label}</div>
                  <div className="text-gray-500 text-xs">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-brand-gold/10 border border-brand-gold/20 rounded-2xl p-6 mb-8">
          <h3 className="text-brand-gold font-semibold mb-3">Next Steps</h3>
          <ol className="text-left text-gray-400 space-y-2 text-sm">
            <li>1. Import your member data (CSV or connect your POS)</li>
            <li>2. Review and customize your message templates</li>
            <li>3. Set your guardrails and autonomy tiers</li>
            <li>4. Watch your AI agent work!</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/onboarding"
            className="block w-full bg-brand-gold hover:bg-brand-gold/90 text-brand-navy font-bold py-4 px-6 rounded-lg"
          >
            Complete Setup
          </Link>
          <Link
            href="/dashboard"
            className="block w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-lg"
          >
            Go to Dashboard
          </Link>
        </div>

        <p className="text-gray-500 text-sm mt-8">
          Questions? Email us at support@ghostwash.ai
        </p>
      </div>
    </div>
  );
}
