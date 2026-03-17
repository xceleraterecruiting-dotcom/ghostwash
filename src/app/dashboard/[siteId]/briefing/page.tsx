'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Briefing {
  id: string;
  briefing_date: string;
  briefing_text: string | null;
  metrics: {
    cars_washed: number;
    revenue_cents: number;
    members_saved: number;
    members_lost: number;
    new_members: number;
    active_members: number;
    at_risk_members: number;
  };
  actions_summary: Array<{
    agent: string;
    action_type: string;
    count: number;
    success_count: number;
  }>;
  recommendations: Array<{
    type: string;
    priority: string;
    title: string;
    description: string;
  }>;
  weather_forecast: {
    description: string;
    temp_f: number | null;
    good_for_washing: boolean;
  } | null;
  sent_at: string | null;
  created_at: string;
}

export default function BriefingPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [selectedBriefing, setSelectedBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchBriefings();
  }, [siteId]);

  const fetchBriefings = async () => {
    try {
      const res = await fetch(`/api/briefings/${siteId}`);
      const data = await res.json();
      setBriefings(data.briefings || []);
      if (data.briefings?.length > 0) {
        setSelectedBriefing(data.briefings[0]);
      }
    } catch (error) {
      console.error('Error fetching briefings:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateBriefing = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/briefings/${siteId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchBriefings();
      }
    } catch (error) {
      console.error('Error generating briefing:', error);
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-danger/10 border-danger/20 text-danger';
      case 'medium':
        return 'bg-warning/10 border-warning/20 text-warning';
      default:
        return 'bg-success/10 border-success/20 text-success';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Daily Briefings</h1>
            <p className="text-muted text-sm">Your morning reports</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={generateBriefing}
              disabled={generating}
              className="bg-accent hover:bg-accent-hover text-white font-semibold px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 transition-all duration-150 active:scale-[0.98]"
            >
              {generating ? 'Generating...' : 'Generate Now'}
            </button>
            <Link
              href={`/dashboard/${siteId}`}
              className="text-muted hover:text-foreground px-4 py-2 text-sm transition-colors"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-surface rounded-lg animate-pulse" />
              ))}
            </div>
            <div className="lg:col-span-3">
              <div className="h-96 bg-surface border border-border rounded-xl animate-pulse" />
            </div>
          </div>
        ) : briefings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📊</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No Briefings Yet</h2>
            <p className="text-muted mb-6">
              Generate your first briefing to see yesterday's summary
            </p>
            <button
              onClick={generateBriefing}
              disabled={generating}
              className="bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-lg transition-all duration-150 active:scale-[0.98]"
            >
              Generate First Briefing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Briefing List */}
            <div className="lg:col-span-1 space-y-2">
              <h3 className="text-sm font-medium text-muted mb-3">Recent Briefings</h3>
              {briefings.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBriefing(b)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-150 ${
                    selectedBriefing?.id === b.id
                      ? 'bg-accent/10 border border-accent/30 ring-1 ring-accent/20'
                      : 'bg-surface border border-border hover:border-border-hover hover:bg-surface-hover'
                  }`}
                >
                  <div className="text-foreground font-medium">{formatDate(b.briefing_date)}</div>
                  <div className="text-muted text-sm">
                    {b.metrics.cars_washed} cars • {formatCurrency(b.metrics.revenue_cents)}
                  </div>
                </button>
              ))}
            </div>

            {/* Briefing Detail */}
            {selectedBriefing && (
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors">
                  <h2 className="text-xl font-bold text-foreground mb-1">
                    {formatDate(selectedBriefing.briefing_date)}
                  </h2>
                  <p className="text-muted text-sm mb-6">
                    {selectedBriefing.sent_at
                      ? `Sent ${new Date(selectedBriefing.sent_at).toLocaleTimeString()}`
                      : 'Not sent yet'}
                  </p>

                  {/* AI-Generated Briefing Text - The Hero */}
                  {selectedBriefing.briefing_text && (
                    <div className="bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 rounded-xl p-6 mb-8">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">☀️</div>
                        <div>
                          <p className="text-foreground text-lg leading-relaxed">
                            {selectedBriefing.briefing_text}
                          </p>
                          {selectedBriefing.weather_forecast?.temp_f && (
                            <p className="text-accent text-sm mt-3">
                              🌤️ {selectedBriefing.weather_forecast.temp_f}°F, {selectedBriefing.weather_forecast.description}
                              {selectedBriefing.weather_forecast.good_for_washing
                                ? ' — Great day for washing!'
                                : ' — Expect lighter traffic'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-accent font-mono">
                        {selectedBriefing.metrics.cars_washed}
                      </div>
                      <div className="text-muted text-sm">Cars Washed</div>
                    </div>
                    <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-success font-mono">
                        {formatCurrency(selectedBriefing.metrics.revenue_cents)}
                      </div>
                      <div className="text-muted text-sm">Revenue</div>
                    </div>
                    <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-warning font-mono">
                        {selectedBriefing.metrics.members_saved}
                      </div>
                      <div className="text-muted text-sm">Members Saved</div>
                    </div>
                    <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-accent font-mono">
                        {selectedBriefing.metrics.new_members}
                      </div>
                      <div className="text-muted text-sm">New Members</div>
                    </div>
                  </div>

                  {/* Membership Health */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-foreground mb-3">Membership Health</h3>
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-muted">Active:</span>{' '}
                        <span className="text-foreground font-medium font-mono">
                          {selectedBriefing.metrics.active_members}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted">At Risk:</span>{' '}
                        <span className="text-danger font-medium font-mono">
                          {selectedBriefing.metrics.at_risk_members}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted">Lost:</span>{' '}
                        <span className="text-danger font-medium font-mono">
                          {selectedBriefing.metrics.members_lost}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Agent Actions */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-foreground mb-3">Agent Actions</h3>
                    {selectedBriefing.actions_summary.length > 0 ? (
                      <div className="space-y-2">
                        {selectedBriefing.actions_summary.map((a, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-2 border-b border-border/50"
                          >
                            <span className="text-foreground capitalize">
                              {a.action_type.replace(/_/g, ' ')}
                            </span>
                            <span className="text-muted font-mono">
                              {a.success_count}/{a.count} successful
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted">No agent actions this day</p>
                    )}
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">Recommendations</h3>
                    {selectedBriefing.recommendations.length > 0 ? (
                      <div className="space-y-3">
                        {selectedBriefing.recommendations.map((r, i) => (
                          <div
                            key={i}
                            className={`p-4 rounded-xl border ${getPriorityColor(r.priority)}`}
                          >
                            <div className="font-medium">{r.title}</div>
                            <div className="text-sm opacity-80 mt-1">{r.description}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted">No recommendations — all systems go!</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
