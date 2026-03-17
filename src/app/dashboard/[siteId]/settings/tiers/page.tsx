'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface TierAssignment {
  id: string;
  decision_type: string;
  tier: number;
  consecutive_correct: number;
}

const DECISION_TYPES = [
  {
    type: 'churn_winback',
    name: 'Churn Win-back',
    description: 'Send messages to at-risk members',
    defaultTier: 1,
  },
  {
    type: 'cc_retry',
    name: 'Credit Card Retry',
    description: 'Retry declined payments and send update requests',
    defaultTier: 1,
  },
  {
    type: 'onboarding',
    name: 'New Member Onboarding',
    description: '30-day drip sequence for new members',
    defaultTier: 1,
  },
  {
    type: 'review_request',
    name: 'Review Requests',
    description: 'Ask satisfied members for Google reviews',
    defaultTier: 1,
  },
  {
    type: 'price_adjustment',
    name: 'Price Adjustments',
    description: 'Adjust retail pricing based on demand',
    defaultTier: 3,
  },
  {
    type: 'campaign_launch',
    name: 'Promotional Campaigns',
    description: 'Launch targeted promotional offers',
    defaultTier: 2,
  },
];

const TIER_INFO = [
  {
    tier: 1,
    name: 'Fully Autonomous',
    description: 'AI decides and executes immediately',
    color: 'bg-success',
  },
  {
    tier: 2,
    name: 'Act & Notify',
    description: 'AI executes but notifies you',
    color: 'bg-warning',
  },
  {
    tier: 3,
    name: 'Recommend Only',
    description: 'AI recommends, you approve',
    color: 'bg-accent',
  },
];

export default function TiersPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [tiers, setTiers] = useState<TierAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [siteId]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/settings/${siteId}`);
      const data = await res.json();
      setTiers(data.tiers || []);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierForDecision = (decisionType: string): number => {
    const assignment = tiers.find((t) => t.decision_type === decisionType);
    return assignment?.tier || DECISION_TYPES.find((d) => d.type === decisionType)?.defaultTier || 2;
  };

  const updateTier = async (decisionType: string, tier: number) => {
    setSaving(decisionType);
    try {
      await fetch(`/api/settings/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'tier',
          data: { decision_type: decisionType, tier },
        }),
      });
      await fetchSettings();
    } catch (error) {
      console.error('Error updating tier:', error);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tier Controls</h1>
            <p className="text-muted text-sm">Configure autonomy levels for each decision</p>
          </div>
          <Link
            href={`/dashboard/${siteId}/settings`}
            className="text-muted hover:text-foreground text-sm transition-colors"
          >
            ← Back to Settings
          </Link>
        </div>
      </header>

      <div className="p-6">
        {/* Tier Legend */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {TIER_INFO.map((info) => (
            <div
              key={info.tier}
              className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4 hover:border-border-hover transition-colors"
            >
              <div className={`w-3 h-3 rounded-full ${info.color}`}></div>
              <div>
                <div className="text-foreground font-medium">
                  Tier {info.tier}: {info.name}
                </div>
                <div className="text-muted text-sm">{info.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Decision Types */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-xl p-6 h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {DECISION_TYPES.map((decision) => (
              <div
                key={decision.type}
                className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-foreground">{decision.name}</h3>
                    <p className="text-muted text-sm">{decision.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map((tier) => (
                      <button
                        key={tier}
                        onClick={() => updateTier(decision.type, tier)}
                        disabled={saving === decision.type}
                        className={`w-12 h-12 rounded-lg font-bold transition-all duration-150 ${
                          getTierForDecision(decision.type) === tier
                            ? tier === 1
                              ? 'bg-success text-white'
                              : tier === 2
                              ? 'bg-warning text-black'
                              : 'bg-accent text-white'
                            : 'bg-surface-hover text-muted hover:bg-border hover:text-foreground'
                        } ${saving === decision.type ? 'opacity-50' : ''}`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-accent/10 border border-accent/20 rounded-xl p-6">
          <h3 className="text-accent font-medium mb-2">How Tiers Work</h3>
          <p className="text-muted text-sm">
            As the AI proves reliable (10+ consecutive correct decisions without override),
            you can promote decisions to higher autonomy tiers. Start conservative and
            let the AI earn trust over time.
          </p>
        </div>
      </div>
    </div>
  );
}
