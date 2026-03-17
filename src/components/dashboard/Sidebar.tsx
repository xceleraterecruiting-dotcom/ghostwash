'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Activity,
  FileText,
  Shield,
  Settings,
  Sun,
  MessageSquare,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

interface SidebarProps {
  siteId: string;
}

const navItems = [
  { href: '', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/briefing', icon: Sun, label: 'Daily Briefing' },
  { href: '/conversations', icon: MessageSquare, label: 'Conversations' },
  { href: '/members', icon: Users, label: 'Members' },
  { href: '/actions', icon: Activity, label: 'Agent Actions' },
  { href: '/settings/templates', icon: FileText, label: 'Templates' },
  { href: '/settings/guardrails', icon: Shield, label: 'Guardrails' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ siteId }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/${siteId}`;
  const { user, signOut } = useAuth();

  const isActive = (href: string) => {
    const fullPath = `${basePath}${href}`;
    if (href === '') {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname.startsWith(fullPath);
  };

  return (
    <aside className="w-60 h-screen bg-surface fixed left-0 top-0 border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link href={basePath} className="flex items-center gap-3">
          <Image src="/logo.svg" alt="GhostWash" width={32} height={45} />
          <span className="text-foreground font-semibold text-lg">GhostWash</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <li key={item.label}>
                <Link
                  href={`${basePath}${item.href}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative ${
                    active
                      ? 'text-foreground bg-surface-hover'
                      : 'text-muted hover:text-foreground hover:bg-surface-hover hover:translate-x-0.5'
                  }`}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r" />
                  )}
                  <Icon size={18} strokeWidth={1.5} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span>Agent Online</span>
        </div>

        {user && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted truncate mb-2" title={user.email}>
              {user.email}
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors w-full"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
