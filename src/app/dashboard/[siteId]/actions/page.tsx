'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Activity } from 'lucide-react';

interface Action {
  id: string;
  agent: string;
  action_type: string;
  tier: number;
  status: string;
  target_type: string;
  target_id: string;
  decision_data: any;
  action_data: any;
  outcome_data: any;
  created_at: string;
  members?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface Summary {
  total_7d: number;
  executed: number;
  pending: number;
  failed: number;
  by_type: Record<string, number>;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'executed':
      return 'text-success bg-success/10';
    case 'pending_approval':
      return 'text-warning bg-warning/10';
    case 'failed':
      return 'text-danger bg-danger/10';
    case 'overridden':
      return 'text-accent bg-accent/10';
    default:
      return 'text-muted bg-surface-hover';
  }
}

function getTierLabel(tier: number): string {
  switch (tier) {
    case 1:
      return 'Auto';
    case 2:
      return 'Notify';
    case 3:
      return 'Approve';
    default:
      return `T${tier}`;
  }
}

function formatActionType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ActionsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [actions, setActions] = useState<Action[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchActions();
  }, [siteId, agentFilter, statusFilter]);

  const fetchActions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        agent: agentFilter,
        status: statusFilter,
      });

      const res = await fetch(`/api/actions/${siteId}?${params}`);
      const data = await res.json();

      if (res.ok) {
        setActions(data.actions || []);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agent Actions</h1>
            <p className="text-muted text-sm">Audit trail of all AI decisions</p>
          </div>
          <Link
            href={`/dashboard/${siteId}/members`}
            className="text-muted hover:text-foreground text-sm transition-colors"
          >
            ← Back to Members
          </Link>
        </div>
      </header>

      <div className="p-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="group bg-surface border border-border rounded-xl p-4 hover:border-border-hover transition-all duration-150">
              <div className="text-2xl font-bold text-foreground font-mono">{summary.total_7d}</div>
              <div className="text-muted text-sm">Actions (7 days)</div>
            </div>
            <div className="group bg-surface border border-border rounded-xl p-4 hover:border-border-hover transition-all duration-150">
              <div className="text-2xl font-bold text-success font-mono">{summary.executed}</div>
              <div className="text-muted text-sm">Executed</div>
            </div>
            <div className="group bg-surface border border-border rounded-xl p-4 hover:border-border-hover transition-all duration-150">
              <div className="text-2xl font-bold text-warning font-mono">{summary.pending}</div>
              <div className="text-muted text-sm">Pending</div>
            </div>
            <div className="group bg-surface border border-border rounded-xl p-4 hover:border-border-hover transition-all duration-150">
              <div className="text-2xl font-bold text-danger font-mono">{summary.failed}</div>
              <div className="text-muted text-sm">Failed</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
          >
            <option value="all">All Agents</option>
            <option value="membership">Membership</option>
            <option value="customer">Customer</option>
            <option value="revenue">Revenue</option>
            <option value="operations">Operations</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
          >
            <option value="all">All Status</option>
            <option value="executed">Executed</option>
            <option value="pending_approval">Pending</option>
            <option value="failed">Failed</option>
            <option value="overridden">Overridden</option>
          </select>
        </div>

        {/* Actions Table */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-surface-hover rounded-lg animate-pulse" />
              ))}
            </div>
          ) : actions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
                <Activity size={32} className="text-muted" />
              </div>
              <p className="text-foreground font-medium mb-2">No actions yet</p>
              <p className="text-muted text-sm">
                Actions will appear here when the AI starts saving members
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 text-muted text-xs font-medium uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-muted text-xs font-medium uppercase tracking-wider">Action</th>
                    <th className="px-4 py-3 text-muted text-xs font-medium uppercase tracking-wider">Member</th>
                    <th className="px-4 py-3 text-muted text-xs font-medium uppercase tracking-wider">Channel</th>
                    <th className="px-4 py-3 text-muted text-xs font-medium uppercase tracking-wider text-center">Tier</th>
                    <th className="px-4 py-3 text-muted text-xs font-medium uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action) => (
                    <tr
                      key={action.id}
                      className="border-b border-border/50 hover:bg-surface-hover transition-all duration-150 group"
                    >
                      <td className="px-4 py-4 text-muted text-sm">
                        {formatDate(action.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-foreground font-medium group-hover:text-accent transition-colors">
                          {formatActionType(action.action_type)}
                        </div>
                        <div className="text-muted text-sm capitalize">{action.agent} agent</div>
                      </td>
                      <td className="px-4 py-4">
                        {action.members ? (
                          <Link
                            href={`/dashboard/${siteId}/members/${action.target_id}`}
                            className="text-accent hover:underline"
                          >
                            {action.members.first_name} {action.members.last_name}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-foreground capitalize">
                        {action.action_data?.channel || '—'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                            action.tier === 1
                              ? 'bg-success/10 text-success'
                              : action.tier === 2
                              ? 'bg-warning/10 text-warning'
                              : 'bg-accent/10 text-accent'
                          }`}
                        >
                          {getTierLabel(action.tier)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            action.status
                          )}`}
                        >
                          {action.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
