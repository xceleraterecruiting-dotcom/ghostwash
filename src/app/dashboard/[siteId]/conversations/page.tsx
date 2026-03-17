'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Clock,
  Send,
  X,
  Filter,
  User,
  Phone,
  Tag,
  ChevronRight,
} from 'lucide-react';

interface Thread {
  id: string;
  site_id: string;
  member_id: string | null;
  member_phone: string;
  status: 'open' | 'escalated' | 'resolved';
  intent: string | null;
  outcome: string | null;
  message_count: number;
  last_message_at: string;
  created_at: string;
  escalation_reason: string | null;
  members: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    plan_name: string | null;
    tags: string[] | null;
  } | null;
  last_message: {
    message_text: string;
    direction: string;
    created_at: string;
  } | null;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  message_text: string;
  classified_intent: string | null;
  confidence_score: number | null;
  template_used: string | null;
  status: string;
  created_at: string;
}

interface Summary {
  total: number;
  open: number;
  escalated: number;
  resolved: number;
  saved: number;
  cancelled: number;
}

export default function ConversationsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [threads, setThreads] = useState<Thread[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [intentFilter, setIntentFilter] = useState<string>('');

  useEffect(() => {
    fetchThreads();
  }, [siteId, statusFilter, intentFilter]);

  const fetchThreads = async () => {
    try {
      let url = `/api/conversations/${siteId}?`;
      if (statusFilter) url += `status=${statusFilter}&`;
      if (intentFilter) url += `intent=${intentFilter}&`;

      const res = await fetch(url);
      const data = await res.json();
      setThreads(data.threads || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectThread = async (thread: Thread) => {
    setSelectedThread(thread);
    setLoadingMessages(true);

    try {
      const res = await fetch(`/api/conversations/${siteId}/${thread.id}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedThread) return;

    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${siteId}/${selectedThread.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText }),
      });

      if (res.ok) {
        setReplyText('');
        // Refresh messages
        selectThread(selectedThread);
        fetchThreads();
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  };

  const updateThreadStatus = async (status: string, outcome?: string) => {
    if (!selectedThread) return;

    try {
      await fetch(`/api/conversations/${siteId}/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, outcome }),
      });
      fetchThreads();
      setSelectedThread(null);
    } catch (error) {
      console.error('Error updating thread:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'escalated':
        return <AlertTriangle size={14} className="text-danger" />;
      case 'resolved':
        return <CheckCircle size={14} className="text-success" />;
      default:
        return <Clock size={14} className="text-warning" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'escalated':
        return 'bg-danger/20 text-danger border-danger/30';
      case 'resolved':
        return 'bg-success/20 text-success border-success/30';
      default:
        return 'bg-warning/20 text-warning border-warning/30';
    }
  };

  const getIntentColor = (intent: string) => {
    const colors: Record<string, string> = {
      cancel_request: 'bg-danger/20 text-danger',
      complaint: 'bg-warning/20 text-warning',
      billing_question: 'bg-accent/20 text-accent',
      payment_update: 'bg-accent/20 text-accent',
      compliment: 'bg-success/20 text-success',
      membership_question: 'bg-accent/20 text-accent',
      hours_location: 'bg-surface-hover text-muted',
    };
    return colors[intent] || 'bg-surface-hover text-muted';
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Conversations</h1>
            <p className="text-muted text-sm">Manage customer messages</p>
          </div>
          {summary && (
            <div className="flex gap-6 text-sm">
              <div className="text-center bg-warning/10 border border-warning/20 rounded-xl px-4 py-2">
                <div className="text-2xl font-bold text-warning font-mono">{summary.open}</div>
                <div className="text-muted text-xs">Open</div>
              </div>
              <div className="text-center bg-danger/10 border border-danger/20 rounded-xl px-4 py-2">
                <div className="text-2xl font-bold text-danger font-mono">{summary.escalated}</div>
                <div className="text-muted text-xs">Escalated</div>
              </div>
              <div className="text-center bg-success/10 border border-success/20 rounded-xl px-4 py-2">
                <div className="text-2xl font-bold text-success font-mono">{summary.saved}</div>
                <div className="text-muted text-xs">Saves</div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Thread List */}
        <div className="w-96 border-r border-border overflow-y-auto">
          {/* Filters */}
          <div className="p-4 border-b border-border flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              value={intentFilter}
              onChange={(e) => setIntentFilter(e.target.value)}
              className="flex-1 px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
            >
              <option value="">All Intents</option>
              <option value="cancel_request">Cancel Request</option>
              <option value="complaint">Complaint</option>
              <option value="billing_question">Billing</option>
              <option value="payment_update">Payment</option>
              <option value="compliment">Compliment</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Thread Items */}
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-surface rounded-lg animate-pulse" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
                <MessageSquare size={32} className="text-muted" />
              </div>
              <p className="text-muted">No conversations yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => selectThread(thread)}
                  className={`w-full text-left p-4 hover:bg-surface-hover transition-all duration-150 ${
                    selectedThread?.id === thread.id ? 'bg-surface border-l-2 border-l-accent' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center">
                      <User size={18} className="text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-foreground font-medium truncate">
                          {thread.members
                            ? `${thread.members.first_name || ''} ${thread.members.last_name || ''}`.trim() || 'Unknown'
                            : thread.member_phone}
                        </span>
                        {getStatusIcon(thread.status)}
                      </div>
                      <p className="text-muted text-sm truncate">
                        {thread.last_message?.message_text || 'No messages'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {thread.intent && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${getIntentColor(thread.intent)}`}
                          >
                            {thread.intent.replace(/_/g, ' ')}
                          </span>
                        )}
                        <span className="text-muted-foreground text-xs">
                          {formatTime(thread.last_message_at || thread.created_at)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversation Detail */}
        <div className="flex-1 flex flex-col">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                      <User size={24} className="text-muted" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {selectedThread.members
                          ? `${selectedThread.members.first_name || ''} ${selectedThread.members.last_name || ''}`.trim() ||
                            'Unknown Member'
                          : 'Unknown Member'}
                      </h2>
                      <div className="flex items-center gap-2 text-sm text-muted">
                        <Phone size={12} />
                        <span className="font-mono">{selectedThread.member_phone}</span>
                        {selectedThread.members?.plan_name && (
                          <>
                            <span>•</span>
                            <span>{selectedThread.members.plan_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs border ${getStatusColor(selectedThread.status)}`}>
                      {selectedThread.status}
                    </span>
                    {selectedThread.status !== 'resolved' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateThreadStatus('resolved', 'saved')}
                          className="px-3 py-1.5 bg-success/20 hover:bg-success/30 text-success rounded-lg text-sm transition-all duration-150 active:scale-[0.98]"
                        >
                          Mark Saved
                        </button>
                        <button
                          onClick={() => updateThreadStatus('resolved', 'cancelled')}
                          className="px-3 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger rounded-lg text-sm transition-all duration-150 active:scale-[0.98]"
                        >
                          Mark Cancelled
                        </button>
                        <button
                          onClick={() => updateThreadStatus('resolved', 'resolved')}
                          className="px-3 py-1.5 bg-surface-hover hover:bg-border text-muted rounded-lg text-sm transition-all duration-150 active:scale-[0.98]"
                        >
                          Resolve
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => setSelectedThread(null)}
                      className="p-2 hover:bg-surface-hover rounded-lg transition-all duration-150"
                    >
                      <X size={18} className="text-muted" />
                    </button>
                  </div>
                </div>

                {/* Member Tags */}
                {selectedThread.members?.tags && selectedThread.members.tags.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <Tag size={12} className="text-muted-foreground" />
                    {selectedThread.members.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-accent/20 text-accent rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="space-y-3 w-full max-w-md">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                          <div className="h-16 w-48 bg-surface rounded-2xl animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md px-4 py-3 rounded-2xl ${
                          msg.direction === 'outbound'
                            ? 'bg-accent text-white rounded-br-sm'
                            : 'bg-surface border border-border text-foreground rounded-bl-sm'
                        }`}
                      >
                        <p className="text-sm">{msg.message_text}</p>
                        <div
                          className={`flex items-center gap-2 mt-1 text-xs ${
                            msg.direction === 'outbound' ? 'text-white/60' : 'text-muted-foreground'
                          }`}
                        >
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          {msg.direction === 'inbound' && msg.classified_intent && (
                            <>
                              <span>•</span>
                              <span>{msg.classified_intent.replace(/_/g, ' ')}</span>
                              {msg.confidence_score && (
                                <span className="font-mono">({(msg.confidence_score * 100).toFixed(0)}%)</span>
                              )}
                            </>
                          )}
                          {msg.direction === 'outbound' && msg.template_used && (
                            <>
                              <span>•</span>
                              <span>Auto: {msg.template_used}</span>
                            </>
                          )}
                          {msg.status === 'operator_replied' && (
                            <>
                              <span>•</span>
                              <span>Manual</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply Input */}
              {selectedThread.status !== 'resolved' && (
                <div className="p-4 border-t border-border">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                      placeholder="Type your reply..."
                      className="flex-1 px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/50 transition-all duration-150"
                    />
                    <button
                      onClick={sendReply}
                      disabled={!replyText.trim() || sending}
                      className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl disabled:opacity-50 transition-all duration-150 active:scale-[0.98] flex items-center gap-2"
                    >
                      <Send size={18} />
                      {sending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={40} className="text-muted" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Select a conversation</h2>
                <p className="text-muted">Choose a thread from the list to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
