'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function CheckoutSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.siteId as string;
  const sessionId = searchParams.get('session_id');

  const [loading, setLoading] = useState(true);
  const [siteName, setSiteName] = useState('');

  useEffect(() => {
    // Fetch site info
    fetch(`/api/plans/${siteId}`)
      .then((res) => res.json())
      .then((data) => {
        setSiteName(data.site?.name || 'our car wash');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [siteId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy to-brand-navy/90 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Success Animation */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <span className="text-5xl">✓</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to the Family!
          </h1>
          <p className="text-gray-400 text-lg">
            Your membership at {loading ? '...' : siteName} is now active.
          </p>
        </div>

        {/* What's Next */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
          <h2 className="text-xl font-semibold text-white mb-6">What's Next?</h2>

          <div className="space-y-4 text-left">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-brand-gold/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-brand-gold font-bold">1</span>
              </div>
              <div>
                <h3 className="text-white font-medium">Check Your Email</h3>
                <p className="text-gray-400 text-sm">
                  We've sent your welcome email with membership details and receipt.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-brand-gold/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-brand-gold font-bold">2</span>
              </div>
              <div>
                <h3 className="text-white font-medium">Visit Us</h3>
                <p className="text-gray-400 text-sm">
                  Come by to get your RFID tag installed for express lane access.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-brand-gold/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-brand-gold font-bold">3</span>
              </div>
              <div>
                <h3 className="text-white font-medium">Start Washing!</h3>
                <p className="text-gray-400 text-sm">
                  Enjoy unlimited washes whenever you want. No limits, no hassle.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits Reminder */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-2xl mb-1">♾️</div>
            <p className="text-white text-sm font-medium">Unlimited</p>
            <p className="text-gray-500 text-xs">Washes</p>
          </div>
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-2xl mb-1">⚡</div>
            <p className="text-white text-sm font-medium">Express</p>
            <p className="text-gray-500 text-xs">Lane</p>
          </div>
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-2xl mb-1">💳</div>
            <p className="text-white text-sm font-medium">Auto-Pay</p>
            <p className="text-gray-500 text-xs">No Hassle</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href={`/join/${siteId}`}
            className="block w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Sign Up Another Vehicle
          </Link>
        </div>

        <p className="text-gray-500 text-sm mt-8">
          Questions? Contact us anytime at support@ghostwash.ai
        </p>
      </div>
    </div>
  );
}
