'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Tag,
  MessageSquare,
  Save,
  X,
  Plus,
  Car,
  CreditCard,
  Mail,
  Phone as PhoneIcon,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Star,
} from 'lucide-react';

interface Member {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  plan_name: string | null;
  plan_price_cents: number | null;
  plan_start_date: string | null;
  plan_status: string;
  payment_status: string;
  payment_failure_count: number;
  churn_score: number;
  wash_count_30d: number;
  wash_count_total: number;
  last_wash_date: string | null;
  ltv_cents: number;
  vehicles: any[];
  do_not_contact: boolean;
  created_at: string;
  notes: string | null;
  tags: string[];
  segment: string | null;
}

interface TimelineEvent {
  id: string;
  type: 'action' | 'wash' | 'status_change' | 'note';
  title: string;
  description: string;
  timestamp: string;
  icon: 'message' | 'car' | 'alert' | 'check' | 'note';
  status?: 'success' | 'pending' | 'failed';
}

interface ChurnAnalysis {
  score: number;
  factors: {
    visit_frequency_decay: number;
    days_since_last_wash: number;
    payment_failures: number;
    membership_age: number;
    seasonal: number;
  };
}

interface Action {
  id: string;
  action_type: string;
  status: string;
  created_at: string;
  action_data: any;
}

function getChurnColor(score: number): string {
  if (score >= 70) return 'text-danger';
  if (score >= 50) return 'text-warning';
  if (score >= 30) return 'text-warning';
  return 'text-success';
}

function getSegment(wash30d: number): { label: string; color: string; icon: any } {
  if (wash30d >= 8) return { label: 'Power Washer', color: 'bg-accent/10 text-accent border-accent/20', icon: Zap };
  if (wash30d >= 4) return { label: 'Regular', color: 'bg-accent/10 text-accent border-accent/20', icon: Star };
  if (wash30d >= 1) return { label: 'Light', color: 'bg-warning/10 text-warning border-warning/20', icon: Car };
  return { label: 'Dormant', color: 'bg-danger/10 text-danger border-danger/20', icon: AlertTriangle };
}

const PRESET_TAGS = ['VIP', 'Save Attempt', 'Dormant', 'New', 'At Risk', 'Recovered'];

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;
  const memberId = params.memberId as string;

  const [member, setMember] = useState<Member | null>(null);
  const [churnAnalysis, setChurnAnalysis] = useState<ChurnAnalysis | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Notes & Tags state
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  useEffect(() => {
    fetchMember();
  }, [siteId, memberId]);

  const fetchMember = async () => {
    try {
      const res = await fetch(`/api/members/${siteId}/${memberId}`);
      const data = await res.json();

      if (res.ok) {
        setMember(data.member);
        setChurnAnalysis(data.churnAnalysis);
        setActions(data.actions || []);
        setNotes(data.member?.notes || '');
        setTags(data.member?.tags || []);

        // Build timeline from actions
        const timelineEvents: TimelineEvent[] = (data.actions || []).map((a: Action) => ({
          id: a.id,
          type: 'action',
          title: a.action_type.replace(/_/g, ' '),
          description: a.action_data?.message_preview || `${a.action_data?.channel || ''} ${a.status}`,
          timestamp: a.created_at,
          icon: a.action_data?.channel === 'sms' ? 'message' : 'message',
          status: a.status === 'executed' ? 'success' : a.status === 'pending' ? 'pending' : 'failed',
        }));

        // Add join event
        if (data.member?.created_at) {
          timelineEvents.push({
            id: 'join',
            type: 'status_change',
            title: 'Member Joined',
            description: `${data.member.plan_name || 'Membership'} started`,
            timestamp: data.member.created_at,
            icon: 'check',
            status: 'success',
          });
        }

        // Sort by timestamp descending
        timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setTimeline(timelineEvents);
      }
    } catch (error) {
      console.error('Error fetching member:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await fetch(`/api/members/${siteId}/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      setEditingNotes(false);
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setSavingNotes(false);
    }
  };

  const addTag = async (tag: string) => {
    if (!tag.trim() || tags.includes(tag)) return;
    const newTags = [...tags, tag.trim()];
    setTags(newTags);
    setNewTag('');
    setShowTagInput(false);
    try {
      await fetch(`/api/members/${siteId}/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      });
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  };

  const removeTag = async (tagToRemove: string) => {
    const newTags = tags.filter(t => t !== tagToRemove);
    setTags(newTags);
    try {
      await fetch(`/api/members/${siteId}/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      });
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPrice = (cents: number | null) => {
    if (!cents) return '$0.00';
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-20 bg-surface rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-48 bg-surface rounded-xl" />
              <div className="h-32 bg-surface rounded-xl" />
            </div>
            <div className="h-96 bg-surface rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔍</span>
          </div>
          <p className="text-foreground font-medium mb-4">Member not found</p>
          <Link
            href={`/dashboard/${siteId}/members`}
            className="text-accent hover:underline"
          >
            ← Back to members
          </Link>
        </div>
      </div>
    );
  }

  const segment = getSegment(member.wash_count_30d);
  const SegmentIcon = segment.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-muted hover:text-foreground transition-colors"
            >
              ← Back
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">
                  {member.first_name} {member.last_name}
                </h1>
                {/* Segment Badge */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${segment.color}`}>
                  <SegmentIcon size={14} />
                  {segment.label}
                </span>
              </div>
              <p className="text-muted text-sm">{member.email || member.phone}</p>
            </div>
          </div>
          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-accent/20 text-accent rounded-full text-xs font-medium"
              >
                <Tag size={10} />
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:text-foreground transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {showTagInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTag(newTag);
                    if (e.key === 'Escape') setShowTagInput(false);
                  }}
                  placeholder="Tag name..."
                  className="w-24 px-2 py-1 bg-surface border border-border rounded text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50"
                  autoFocus
                />
                <div className="flex gap-1">
                  {PRESET_TAGS.filter(t => !tags.includes(t)).slice(0, 3).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => addTag(preset)}
                      className="px-2 py-1 bg-surface hover:bg-surface-hover text-muted hover:text-foreground rounded text-xs transition-all duration-150"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                className="inline-flex items-center gap-1 px-2 py-1 bg-surface hover:bg-surface-hover text-muted hover:text-foreground rounded text-xs transition-all duration-150"
              >
                <Plus size={10} />
                Add Tag
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Membership Details */}
            <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors">
              <h2 className="text-lg font-semibold text-foreground mb-4">Membership</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-muted text-sm">Plan</div>
                  <div className="text-foreground font-medium">{member.plan_name || '—'}</div>
                </div>
                <div>
                  <div className="text-muted text-sm">Price</div>
                  <div className="text-foreground font-medium font-mono">
                    {formatPrice(member.plan_price_cents)}/mo
                  </div>
                </div>
                <div>
                  <div className="text-muted text-sm">Status</div>
                  <div className="text-foreground font-medium capitalize">{member.plan_status}</div>
                </div>
                <div>
                  <div className="text-muted text-sm">Member Since</div>
                  <div className="text-foreground font-medium">{formatDate(member.plan_start_date)}</div>
                </div>
                <div>
                  <div className="text-muted text-sm">Payment Status</div>
                  <div
                    className={`font-medium capitalize ${
                      member.payment_status === 'current' ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {member.payment_status}
                  </div>
                </div>
                <div>
                  <div className="text-muted text-sm">Lifetime Value</div>
                  <div className="text-foreground font-medium font-mono">{formatPrice(member.ltv_cents)}</div>
                </div>
              </div>
            </div>

            {/* Wash Activity */}
            <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors">
              <h2 className="text-lg font-semibold text-foreground mb-4">Wash Activity</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center bg-accent/10 border border-accent/20 rounded-xl p-4">
                  <div className="text-3xl font-bold text-accent font-mono">{member.wash_count_30d || 0}</div>
                  <div className="text-muted text-sm">Last 30 Days</div>
                </div>
                <div className="text-center bg-surface-hover border border-border rounded-xl p-4">
                  <div className="text-3xl font-bold text-foreground font-mono">{member.wash_count_total || 0}</div>
                  <div className="text-muted text-sm">Total Washes</div>
                </div>
                <div className="text-center bg-surface-hover border border-border rounded-xl p-4">
                  <div className="text-3xl font-bold text-foreground font-mono">
                    {member.last_wash_date
                      ? Math.floor(
                          (Date.now() - new Date(member.last_wash_date).getTime()) /
                            (24 * 60 * 60 * 1000)
                        )
                      : '—'}
                  </div>
                  <div className="text-muted text-sm">Days Since Last</div>
                </div>
              </div>
            </div>

            {/* Timeline - Full Activity History */}
            <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors">
              <h2 className="text-lg font-semibold text-foreground mb-4">Activity Timeline</h2>
              {timeline.length === 0 ? (
                <p className="text-muted text-sm">No activity yet</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

                  <div className="space-y-4">
                    {timeline.map((event) => {
                      const getIcon = () => {
                        switch (event.icon) {
                          case 'message':
                            return <MessageSquare size={14} />;
                          case 'car':
                            return <Car size={14} />;
                          case 'alert':
                            return <AlertTriangle size={14} />;
                          case 'check':
                            return <CheckCircle size={14} />;
                          case 'note':
                            return <MessageSquare size={14} />;
                          default:
                            return <Clock size={14} />;
                        }
                      };

                      const getStatusColor = () => {
                        switch (event.status) {
                          case 'success':
                            return 'bg-success/20 text-success border-success/30';
                          case 'pending':
                            return 'bg-warning/20 text-warning border-warning/30';
                          case 'failed':
                            return 'bg-danger/20 text-danger border-danger/30';
                          default:
                            return 'bg-surface-hover text-muted border-border';
                        }
                      };

                      return (
                        <div key={event.id} className="relative flex gap-4 pl-2">
                          {/* Icon */}
                          <div className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full border ${getStatusColor()}`}>
                            {getIcon()}
                          </div>

                          {/* Content */}
                          <div className="flex-1 pb-4">
                            <div className="flex items-center justify-between">
                              <span className="text-foreground font-medium text-sm capitalize">
                                {event.title}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {new Date(event.timestamp).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-muted text-sm mt-0.5">
                              {event.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Churn Score */}
          <div className="space-y-6">
            {/* Notes Section */}
            <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Notes</h2>
                {editingNotes ? (
                  <div className="flex gap-2">
                    <button
                      onClick={saveNotes}
                      disabled={savingNotes}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-success/20 hover:bg-success/30 text-success rounded text-xs transition-all duration-150 disabled:opacity-50"
                    >
                      <Save size={12} />
                      {savingNotes ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingNotes(false);
                        setNotes(member.notes || '');
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-surface-hover hover:bg-border text-muted rounded text-xs transition-all duration-150"
                    >
                      <X size={12} />
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="text-muted hover:text-foreground text-xs transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingNotes ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-32 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 resize-none transition-all duration-150"
                  placeholder="Add notes about this member..."
                />
              ) : (
                <p className="text-muted text-sm whitespace-pre-wrap">
                  {notes || 'No notes yet. Click Edit to add notes.'}
                </p>
              )}
            </div>

            {/* Churn Score Card */}
            <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors">
              <h2 className="text-lg font-semibold text-foreground mb-4">Churn Risk</h2>
              <div className="text-center mb-6">
                <div className={`text-6xl font-bold font-mono ${getChurnColor(churnAnalysis?.score || 0)}`}>
                  {churnAnalysis?.score.toFixed(0) || 0}
                </div>
                <div className="text-muted text-sm mt-1">out of 100</div>
              </div>

              {/* Score Breakdown */}
              {churnAnalysis && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted">Score Breakdown</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Visit Frequency Decay</span>
                      <span className="text-foreground font-mono">+{churnAnalysis.factors.visit_frequency_decay}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Days Since Last Wash</span>
                      <span className="text-foreground font-mono">+{churnAnalysis.factors.days_since_last_wash}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Payment Failures</span>
                      <span className="text-foreground font-mono">+{churnAnalysis.factors.payment_failures}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">New Member Risk</span>
                      <span className="text-foreground font-mono">+{churnAnalysis.factors.membership_age}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Seasonal Factor</span>
                      <span className="text-foreground font-mono">+{churnAnalysis.factors.seasonal}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Contact Info */}
            <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors">
              <h2 className="text-lg font-semibold text-foreground mb-4">Contact</h2>
              <div className="space-y-3">
                {member.email && (
                  <div>
                    <div className="text-muted text-sm">Email</div>
                    <div className="text-foreground">{member.email}</div>
                  </div>
                )}
                {member.phone && (
                  <div>
                    <div className="text-muted text-sm">Phone</div>
                    <div className="text-foreground font-mono">{member.phone}</div>
                  </div>
                )}
                <div>
                  <div className="text-muted text-sm">Do Not Contact</div>
                  <div className={member.do_not_contact ? 'text-danger' : 'text-success'}>
                    {member.do_not_contact ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicles */}
            {member.vehicles && member.vehicles.length > 0 && (
              <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors">
                <h2 className="text-lg font-semibold text-foreground mb-4">Vehicles</h2>
                <div className="space-y-2">
                  {member.vehicles.map((v: any, i: number) => (
                    <div key={i} className="text-foreground">
                      {v.year} {v.make} {v.model}
                      {v.plate && <span className="text-muted ml-2">({v.plate})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
