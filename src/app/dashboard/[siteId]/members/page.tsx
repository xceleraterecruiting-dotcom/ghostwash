'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users } from 'lucide-react';

interface Member {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  plan_name: string | null;
  plan_price_cents: number | null;
  plan_status: string;
  churn_score: number;
  wash_count_30d: number;
  wash_count_total: number;
  last_wash_date: string | null;
  created_at: string;
}

interface Summary {
  total: number;
  active: number;
  atRisk: number;
  paused: number;
  cancelled: number;
}

function getChurnColor(score: number): string {
  if (score >= 70) return 'text-danger bg-danger/10';
  if (score >= 50) return 'text-warning bg-warning/10';
  if (score >= 30) return 'text-warning bg-warning/10';
  return 'text-success bg-success/10';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'text-success bg-success/10';
    case 'paused':
      return 'text-warning bg-warning/10';
    case 'cancelled':
      return 'text-danger bg-danger/10';
    case 'past_due':
      return 'text-warning bg-warning/10';
    default:
      return 'text-muted bg-surface-hover';
  }
}

export default function MembersPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;

  const [members, setMembers] = useState<Member[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [siteName, setSiteName] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchMembers();
  }, [siteId, search, statusFilter]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        sortBy: 'churn_score',
        sortOrder: 'desc',
      });

      const res = await fetch(`/api/members/${siteId}?${params}`);
      const data = await res.json();

      if (res.ok) {
        setMembers(data.members || []);
        setSummary(data.summary);
        setSiteName(data.site?.name || '');
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (cents: number | null) => {
    if (!cents) return '—';
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{siteName || 'Members'}</h1>
            <p className="text-muted text-sm">Membership Agent Dashboard</p>
          </div>
          <Link
            href={`/dashboard/${siteId}/import`}
            className="bg-surface border border-border hover:border-border-hover hover:bg-surface-hover text-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
          >
            Import More
          </Link>
        </div>
      </header>

      <div className="p-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="group bg-surface border border-border rounded-xl p-4 hover:border-border-hover hover:bg-surface-hover transition-all duration-150">
              <div className="text-2xl font-bold text-foreground font-mono">{summary.total}</div>
              <div className="text-muted text-sm">Total Members</div>
            </div>
            <div className="group bg-surface border border-border rounded-xl p-4 hover:border-border-hover hover:bg-surface-hover transition-all duration-150">
              <div className="text-2xl font-bold text-success font-mono">{summary.active}</div>
              <div className="text-muted text-sm">Active</div>
            </div>
            <div className="group bg-surface border border-border rounded-xl p-4 hover:border-border-hover hover:bg-surface-hover transition-all duration-150">
              <div className="text-2xl font-bold text-danger font-mono">{summary.atRisk}</div>
              <div className="text-muted text-sm">At Risk (60+)</div>
            </div>
            <div className="group bg-surface border border-border rounded-xl p-4 hover:border-border-hover hover:bg-surface-hover transition-all duration-150">
              <div className="text-2xl font-bold text-warning font-mono">{summary.paused}</div>
              <div className="text-muted text-sm">Paused</div>
            </div>
            <div className="group bg-surface border border-border rounded-xl p-4 hover:border-border-hover hover:bg-surface-hover transition-all duration-150">
              <div className="text-2xl font-bold text-muted font-mono">{summary.cancelled}</div>
              <div className="text-muted text-sm">Cancelled</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
            <option value="past_due">Past Due</option>
          </select>
        </div>

        {/* Member Table */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-surface-hover rounded-lg animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
                <Users size={32} className="text-muted" />
              </div>
              <p className="text-foreground font-medium mb-2">No members found</p>
              <p className="text-muted text-sm mb-6">
                Import your member data to get started
              </p>
              <Link
                href={`/dashboard/${siteId}/import`}
                className="inline-block bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-lg font-medium transition-colors duration-150"
              >
                Import Members
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 text-muted text-xs font-medium uppercase tracking-wider">Member</th>
                    <th className="px-4 py-3 text-muted text-xs font-medium uppercase tracking-wider">Plan</th>
                    <th className="px-4 py-3 text-muted text-xs font-medium uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-muted text-xs font-medium uppercase tracking-wider text-center">
                      Churn Score
                    </th>
                    <th className="px-4 py-3 text-muted text-xs font-medium uppercase tracking-wider text-center">
                      Washes (30d)
                    </th>
                    <th className="px-4 py-3 text-muted text-xs font-medium uppercase tracking-wider">Last Wash</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      onClick={() => router.push(`/dashboard/${siteId}/members/${member.id}`)}
                      className="border-b border-border/50 hover:bg-surface-hover cursor-pointer transition-all duration-150 group"
                    >
                      <td className="px-4 py-4">
                        <div className="text-foreground font-medium group-hover:text-accent transition-colors">
                          {member.first_name} {member.last_name}
                        </div>
                        <div className="text-muted text-sm">{member.email || member.phone}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-foreground">{member.plan_name || '—'}</div>
                        <div className="text-muted text-sm">
                          {formatPrice(member.plan_price_cents)}/mo
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            member.plan_status
                          )}`}
                        >
                          {member.plan_status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-sm font-bold font-mono ${getChurnColor(
                            member.churn_score
                          )}`}
                        >
                          {member.churn_score?.toFixed(0) || 0}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-foreground font-mono">
                        {member.wash_count_30d || 0}
                      </td>
                      <td className="px-4 py-4 text-muted">
                        {formatDate(member.last_wash_date)}
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
