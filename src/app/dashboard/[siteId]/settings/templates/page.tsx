'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Mail } from 'lucide-react';

interface Template {
  id: string;
  template_type: string;
  channel: string;
  name: string;
  subject: string | null;
  body: string;
  offer_type: string | null;
  offer_value: string | null;
  priority: number;
  active: boolean;
}

const TEMPLATE_TYPES = [
  { type: 'churn_winback', label: 'Churn Win-back' },
  { type: 'cc_decline', label: 'CC Decline' },
  { type: 'onboarding_day0', label: 'Onboarding Day 0' },
  { type: 'onboarding_day3', label: 'Onboarding Day 3' },
  { type: 'onboarding_day7', label: 'Onboarding Day 7' },
  { type: 'onboarding_day14', label: 'Onboarding Day 14' },
  { type: 'onboarding_day30', label: 'Onboarding Day 30' },
  { type: 'review_request', label: 'Review Request' },
];

const VARIABLES = [
  { var: '{{first_name}}', desc: 'Member first name' },
  { var: '{{last_name}}', desc: 'Member last name' },
  { var: '{{plan_name}}', desc: 'Membership plan name' },
  { var: '{{plan_price}}', desc: 'Plan price (e.g., $29.99)' },
  { var: '{{wash_count}}', desc: 'Total washes' },
  { var: '{{savings_amount}}', desc: 'Savings vs retail' },
  { var: '{{site_name}}', desc: 'Car wash location name' },
  { var: '{{offer_details}}', desc: 'Current offer details' },
];

export default function TemplatesPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchSettings();
  }, [siteId]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/settings/${siteId}`);
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    setSaving(true);
    try {
      await fetch(`/api/settings/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'template',
          data: editingTemplate,
        }),
      });
      await fetchSettings();
      setEditingTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter(
    (t) => filterType === 'all' || t.template_type === filterType
  );

  const getChannelIcon = (channel: string) => {
    return channel === 'sms' ? <MessageSquare size={16} /> : <Mail size={16} />;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Message Templates</h1>
            <p className="text-muted text-sm">Customize your AI's messages</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Template List */}
          <div className="lg:col-span-2">
            {/* Filter */}
            <div className="mb-4">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
              >
                <option value="all">All Templates</option>
                {TEMPLATE_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-surface border border-border rounded-xl p-4 h-24 animate-pulse" />
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12 bg-surface border border-border rounded-xl">
                <p className="text-muted">No templates found. Run the seed script to create defaults.</p>
                <code className="text-sm text-muted-foreground mt-2 block font-mono">npm run db:seed</code>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setEditingTemplate(template)}
                    className={`bg-surface border rounded-xl p-4 cursor-pointer transition-all duration-150 ${
                      editingTemplate?.id === template.id
                        ? 'border-accent bg-accent/5 ring-1 ring-accent/20'
                        : 'border-border hover:border-border-hover hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-accent">{getChannelIcon(template.channel)}</span>
                        <span className="text-foreground font-medium">{template.name}</span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          template.active
                            ? 'bg-success/10 text-success'
                            : 'bg-surface-hover text-muted'
                        }`}
                      >
                        {template.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-muted text-sm line-clamp-2">{template.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit Panel */}
          <div className="lg:col-span-1">
            {editingTemplate ? (
              <div className="bg-surface border border-border rounded-xl p-6 sticky top-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
                <h3 className="text-lg font-semibold text-foreground mb-4">Edit Template</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-muted mb-2">Name</label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, name: e.target.value })
                      }
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
                    />
                  </div>

                  {editingTemplate.channel === 'email' && (
                    <div>
                      <label className="block text-sm text-muted mb-2">Subject</label>
                      <input
                        type="text"
                        value={editingTemplate.subject || ''}
                        onChange={(e) =>
                          setEditingTemplate({ ...editingTemplate, subject: e.target.value })
                        }
                        className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-muted mb-2">Message Body</label>
                    <textarea
                      value={editingTemplate.body}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, body: e.target.value })
                      }
                      rows={6}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150 resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {editingTemplate.channel === 'sms' ? 'SMS: Keep under 160 chars' : 'Email body'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingTemplate.active}
                        onChange={(e) =>
                          setEditingTemplate({ ...editingTemplate, active: e.target.checked })
                        }
                        className="w-4 h-4 rounded accent-accent"
                      />
                      <span className="text-foreground text-sm">Active</span>
                    </label>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={saveTemplate}
                      disabled={saving}
                      className="flex-1 bg-accent hover:bg-accent-hover text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-150 disabled:opacity-50 active:scale-[0.98]"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditingTemplate(null)}
                      className="px-4 py-2.5 text-muted hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Available Variables</h3>
                <div className="space-y-3">
                  {VARIABLES.map((v) => (
                    <div key={v.var} className="flex justify-between text-sm gap-2">
                      <code className="text-accent font-mono text-xs">{v.var}</code>
                      <span className="text-muted text-xs text-right">{v.desc}</span>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs mt-4">
                  Click a template to edit it. Variables are replaced with real data when sent.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
