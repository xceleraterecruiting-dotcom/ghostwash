'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, DollarSign, ShoppingCart, Settings } from 'lucide-react';

interface Guardrail {
  id: string;
  category: string;
  rule_key: string;
  rule_value: { value: number; unit?: string };
  active: boolean;
}

const GUARDRAIL_DEFINITIONS = [
  {
    category: 'comms',
    rules: [
      {
        key: 'max_msgs_per_member_week',
        name: 'Max Messages Per Member Per Week',
        description: 'Prevent over-messaging individual members',
        unit: 'messages',
        default: 3,
        min: 1,
        max: 10,
      },
      {
        key: 'min_days_between_contact',
        name: 'Minimum Days Between Contact',
        description: 'Cooldown period after contacting a member',
        unit: 'days',
        default: 7,
        min: 1,
        max: 30,
      },
    ],
  },
  {
    category: 'pricing',
    rules: [
      {
        key: 'max_retail_price_delta_cents',
        name: 'Max Retail Price Change',
        description: 'Maximum price adjustment from base (in dollars)',
        unit: 'dollars',
        default: 2,
        min: 0,
        max: 10,
      },
      {
        key: 'max_discount_percent',
        name: 'Max Promotional Discount',
        description: 'Maximum discount percentage for promotions',
        unit: '%',
        default: 25,
        min: 5,
        max: 50,
      },
    ],
  },
  {
    category: 'spending',
    rules: [
      {
        key: 'max_chemical_order_cents',
        name: 'Max Chemical Order',
        description: 'Maximum auto-order amount for chemicals',
        unit: 'dollars',
        default: 500,
        min: 100,
        max: 5000,
      },
      {
        key: 'max_maintenance_cents',
        name: 'Max Maintenance Spend',
        description: 'Max auto-approved maintenance expense',
        unit: 'dollars',
        default: 250,
        min: 50,
        max: 1000,
      },
    ],
  },
];

export default function GuardrailsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [guardrails, setGuardrails] = useState<Guardrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [siteId]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/settings/${siteId}`);
      const data = await res.json();
      setGuardrails(data.guardrails || []);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGuardrailValue = (ruleKey: string, defaultValue: number): number => {
    const guardrail = guardrails.find((g) => g.rule_key === ruleKey);
    return guardrail?.rule_value?.value ?? defaultValue;
  };

  const updateGuardrail = async (category: string, ruleKey: string, value: number) => {
    setSaving(ruleKey);
    try {
      await fetch(`/api/settings/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'guardrail',
          data: {
            category,
            rule_key: ruleKey,
            rule_value: { value },
          },
        }),
      });
      await fetchSettings();
    } catch (error) {
      console.error('Error updating guardrail:', error);
    } finally {
      setSaving(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'comms':
        return <MessageSquare size={18} />;
      case 'pricing':
        return <DollarSign size={18} />;
      case 'spending':
        return <ShoppingCart size={18} />;
      default:
        return <Settings size={18} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Guardrails</h1>
            <p className="text-muted text-sm">Set boundaries for AI actions</p>
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
        {loading ? (
          <div className="space-y-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="h-6 w-32 bg-surface rounded animate-pulse" />
                <div className="h-32 bg-surface border border-border rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {GUARDRAIL_DEFINITIONS.map((category) => (
              <div key={category.category}>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="text-accent">{getCategoryIcon(category.category)}</span>
                  <span className="capitalize">{category.category}</span>
                </h2>
                <div className="space-y-4">
                  {category.rules.map((rule) => (
                    <div
                      key={rule.key}
                      className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-foreground font-medium">{rule.name}</h3>
                          <p className="text-muted text-sm">{rule.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={getGuardrailValue(rule.key, rule.default)}
                            onChange={(e) =>
                              updateGuardrail(
                                category.category,
                                rule.key,
                                parseInt(e.target.value) || rule.default
                              )
                            }
                            min={rule.min}
                            max={rule.max}
                            className="w-20 px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-center font-mono focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
                          />
                          <span className="text-muted text-sm w-16">{rule.unit}</span>
                          {saving === rule.key && (
                            <span className="text-accent text-sm">Saving...</span>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        value={getGuardrailValue(rule.key, rule.default)}
                        onChange={(e) =>
                          updateGuardrail(category.category, rule.key, parseInt(e.target.value))
                        }
                        min={rule.min}
                        max={rule.max}
                        className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{rule.min}</span>
                        <span>{rule.max}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-warning/10 border border-warning/20 rounded-xl p-6">
          <h3 className="text-warning font-medium mb-2">Safety First</h3>
          <p className="text-muted text-sm">
            Guardrails ensure the AI never exceeds your comfort zone. These limits are enforced
            before every action. Start conservative — you can always loosen them as you build trust.
          </p>
        </div>
      </div>
    </div>
  );
}
