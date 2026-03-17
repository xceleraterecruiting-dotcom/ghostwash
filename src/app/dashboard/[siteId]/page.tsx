'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/dashboard/Sidebar';
import {
  ChevronDown,
  Bell,
  Play,
  TrendingUp,
  TrendingDown,
  Users,
  UserCheck,
  AlertTriangle,
  DollarSign,
  Circle,
} from 'lucide-react';

interface Site {
  id: string;
  name: string;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  plan_name: string;
  churn_score: number;
  last_wash_date: string | null;
}

interface Action {
  id: string;
  action_type: string;
  status: string;
  created_at: string;
  target_id: string;
  decision_data: any;
  action_data: any;
}

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;

  const [site, setSite] = useState<Site | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSiteSwitcher, setShowSiteSwitcher] = useState(false);
  const [runningChurn, setRunningChurn] = useState(false);

  useEffect(() => {
    fetchData();
  }, [siteId]);

  const fetchData = async () => {
    try {
      const [membersRes, actionsRes, setupRes] = await Promise.all([
        fetch(`/api/members/${siteId}`),
        fetch(`/api/actions/${siteId}`),
        fetch('/api/setup'),
      ]);

      const membersData = await membersRes.json();
      const actionsData = await actionsRes.json();
      const setupData = await setupRes.json();

      setMembers(membersData.members || []);
      setActions(actionsData.actions || []);

      // Find current site and all sites
      const allSites: Site[] = [];
      setupData.organizations?.forEach((org: any) => {
        org.sites?.forEach((s: any) => {
          allSites.push(s);
          if (s.id === siteId) {
            setSite(s);
          }
        });
      });
      setSites(allSites);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runChurnCheck = async () => {
    setRunningChurn(true);
    try {
      await fetch('/api/cron/churn-check', { method: 'POST' });
      await fetchData();
    } catch (error) {
      console.error('Error running churn check:', error);
    } finally {
      setRunningChurn(false);
    }
  };

  // Calculate stats
  const totalMembers = members.length;
  const activeMembers = members.filter((m) => (m.churn_score || 0) < 60).length;
  const atRiskMembers = members.filter((m) => (m.churn_score || 0) >= 60).length;
  const revenueSaved = 0; // Calculate from actions

  // Get at-risk members sorted by churn score
  const atRiskList = members
    .filter((m) => (m.churn_score || 0) >= 40)
    .sort((a, b) => (b.churn_score || 0) - (a.churn_score || 0))
    .slice(0, 5);

  // Recent actions
  const recentActions = actions.slice(0, 8);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatActionDescription = (action: Action) => {
    const type = action.action_type;
    const memberName = action.action_data?.member_name || 'Member';
    const score = action.decision_data?.churn_score;

    switch (type) {
      case 'churn_winback':
        return `Win-back SMS sent to ${memberName}${score ? ` (churn score: ${score})` : ''}`;
      case 'cc_retry':
        return `Payment retry notification sent to ${memberName}`;
      case 'onboarding':
        return `Onboarding message sent to ${memberName}`;
      default:
        return `${type.replace(/_/g, ' ')} for ${memberName}`;
    }
  };

  const getActionStatus = (status: string) => {
    switch (status) {
      case 'executed':
      case 'success':
        return { color: 'bg-success', label: 'Completed' };
      case 'pending':
      case 'pending_approval':
        return { color: 'bg-warning', label: 'Pending' };
      default:
        return { color: 'bg-blue-400', label: 'Info' };
    }
  };

  const getChurnColor = (score: number) => {
    if (score >= 60) return 'bg-danger';
    if (score >= 40) return 'bg-warning';
    return 'bg-success';
  };

  const daysSinceWash = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    return `${days}d`;
  };

  if (loading) {
    return (
      <div className="p-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-48 bg-surface rounded-lg animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="h-10 w-36 bg-surface rounded-lg animate-pulse" />
            <div className="h-8 w-8 bg-surface rounded-full animate-pulse" />
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5 h-32 animate-pulse" />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-3 bg-surface border border-border rounded-xl h-80 animate-pulse" />
          <div className="col-span-2 bg-surface border border-border rounded-xl h-80 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
        {/* Top Bar */}
        <header className="flex items-center justify-between mb-8">
          <div className="relative">
            <button
              onClick={() => setShowSiteSwitcher(!showSiteSwitcher)}
              className="flex items-center gap-2 text-foreground hover:text-muted transition-colors"
            >
              <span className="text-xl font-semibold">{site?.name || 'Dashboard'}</span>
              <ChevronDown size={20} className="text-muted" />
            </button>

            {showSiteSwitcher && sites.length > 1 && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-surface border border-border rounded-xl shadow-xl shadow-black/40 z-50 overflow-hidden animate-scale-in">
                {sites.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      router.push(`/dashboard/${s.id}`);
                      setShowSiteSwitcher(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-surface-hover transition-colors ${
                      s.id === siteId ? 'text-accent bg-accent/5' : 'text-foreground'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={runChurnCheck}
              disabled={runningChurn}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50 active:scale-[0.98]"
            >
              <Play size={16} />
              {runningChurn ? 'Running...' : 'Run Churn Check'}
            </button>

            <button className="p-2 text-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-all duration-150 relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full ring-2 ring-background" />
            </button>

            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center text-white text-sm font-medium ring-2 ring-border">
              A
            </div>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Users size={20} />}
            value={totalMembers}
            label="Total Members"
            trend={{ value: 5, up: true }}
          />
          <StatCard
            icon={<UserCheck size={20} />}
            value={activeMembers}
            label="Active"
            trend={{ value: 2, up: true }}
          />
          <StatCard
            icon={<AlertTriangle size={20} />}
            value={atRiskMembers}
            label="At Risk"
            valueColor="text-danger"
            trend={{ value: 1, up: false }}
          />
          <StatCard
            icon={<DollarSign size={20} />}
            value={`$${revenueSaved}`}
            label="Revenue Saved"
            valueColor="text-accent"
            trend={{ value: 0, up: true }}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-5 gap-6 mb-6">
          {/* Recent Activity - 3 columns */}
          <div className="col-span-3 bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors duration-150">
            <h2 className="text-foreground font-semibold mb-4">Recent Agent Activity</h2>

            {recentActions.length === 0 ? (
              <div className="text-muted text-sm py-8 text-center">
                No recent activity. Run a churn check to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {recentActions.map((action) => {
                  const status = getActionStatus(action.status);
                  return (
                    <div key={action.id} className="flex items-start gap-3 group">
                      <div className="mt-1.5">
                        <Circle size={8} className={`${status.color} fill-current`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm group-hover:text-accent transition-colors">
                          {formatActionDescription(action)}
                        </p>
                        <p className="text-muted text-xs mt-0.5">
                          {formatTime(action.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {actions.length > 8 && (
              <Link
                href={`/dashboard/${siteId}/actions`}
                className="inline-flex items-center gap-1 text-accent text-sm mt-4 hover:underline"
              >
                View all activity <span className="text-xs">→</span>
              </Link>
            )}
          </div>

          {/* At Risk Members - 2 columns */}
          <div className="col-span-2 bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors duration-150">
            <h2 className="text-foreground font-semibold mb-4">At Risk Members</h2>

            {atRiskList.length === 0 ? (
              <div className="text-muted text-sm py-8 text-center">
                No at-risk members detected.
              </div>
            ) : (
              <div className="space-y-3">
                {atRiskList.map((member) => (
                  <Link
                    key={member.id}
                    href={`/dashboard/${siteId}/members/${member.id}`}
                    className="block p-3 rounded-lg hover:bg-surface-hover transition-all duration-150 -mx-3 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-foreground text-sm font-medium group-hover:text-accent transition-colors">
                          {member.first_name} {member.last_name}
                        </p>
                        <p className="text-muted text-xs">{member.plan_name || 'No plan'}</p>
                      </div>
                      <span className="text-muted text-xs">
                        {daysSinceWash(member.last_wash_date)} ago
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getChurnColor(member.churn_score || 0)} rounded-full transition-all`}
                          style={{ width: `${member.churn_score || 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted w-8">
                        {Math.round(member.churn_score || 0)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {members.filter((m) => (m.churn_score || 0) >= 40).length > 5 && (
              <Link
                href={`/dashboard/${siteId}/members?filter=at-risk`}
                className="inline-flex items-center gap-1 text-accent text-sm mt-4 hover:underline"
              >
                View all at-risk members <span className="text-xs">→</span>
              </Link>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-surface border border-border rounded-xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-success text-sm font-medium">Online</span>
            </div>
            <span className="text-muted text-sm">Membership Agent</span>
          </div>
          <div className="text-muted text-sm">
            Monitoring <span className="text-foreground font-mono">{totalMembers}</span> members •{' '}
            <span className="text-danger font-mono">{atRiskMembers}</span> at risk •{' '}
            <span className="text-accent font-mono">0</span> win-backs this week
          </div>
        </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  value,
  label,
  valueColor = 'text-foreground',
  trend,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  valueColor?: string;
  trend?: { value: number; up: boolean };
}) {
  return (
    <div className="group bg-surface border border-border rounded-xl p-5 hover:border-border-hover hover:bg-surface-hover transition-all duration-150 cursor-default">
      <div className="flex items-center justify-between mb-3">
        <div className="text-muted group-hover:text-muted-foreground transition-colors">{icon}</div>
        {trend && trend.value > 0 && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              trend.up ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
            }`}
          >
            {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
      <div className={`text-3xl font-bold font-mono tracking-tight ${valueColor}`}>{value}</div>
      <div className="text-muted text-sm mt-1">{label}</div>
    </div>
  );
}
