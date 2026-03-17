'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Link2, SlidersHorizontal, Shield, FileText, ChevronRight } from 'lucide-react';

export default function SettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const settingsSections = [
    {
      title: 'POS Integration',
      description: 'Connect your point-of-sale system for live data sync',
      href: `/dashboard/${siteId}/settings/pos`,
      icon: Link2,
    },
    {
      title: 'Tier Controls',
      description: 'Configure autonomy levels for each AI decision type',
      href: `/dashboard/${siteId}/settings/tiers`,
      icon: SlidersHorizontal,
    },
    {
      title: 'Guardrails',
      description: 'Set boundaries and limits for AI actions',
      href: `/dashboard/${siteId}/settings/guardrails`,
      icon: Shield,
    },
    {
      title: 'Message Templates',
      description: 'Customize SMS and email templates',
      href: `/dashboard/${siteId}/settings/templates`,
      icon: FileText,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-muted text-sm">Configure your AI agent</p>
          </div>
          <Link
            href={`/dashboard/${siteId}`}
            className="text-muted hover:text-foreground text-sm transition-colors"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group bg-surface border border-border rounded-xl p-6 hover:border-accent/50 hover:bg-surface-hover transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <Icon size={20} className="text-accent" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2 group-hover:text-accent transition-colors">
                  {section.title}
                </h2>
                <p className="text-muted text-sm mb-4">{section.description}</p>
                <div className="flex items-center text-accent text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Configure</span>
                  <ChevronRight size={16} className="ml-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
