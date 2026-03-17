'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Users, Building2, Calendar, LogIn } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { createClient } from '@supabase/supabase-js';

type WaitlistEntry = {
  id: string;
  name: string;
  email: string;
  wash_name: string;
  location_count: string;
  pos_type: string;
  created_at: string;
};

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    if (user.email !== 'ghostwash.ai@gmail.com') {
      setIsAuthorized(false);
      setError('Access denied. This page is restricted.');
      setLoading(false);
      return;
    }

    setIsAuthorized(true);
    fetchWaitlist();
  };

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/waitlist');
      const data = await res.json();

      if (res.status === 401) {
        setIsAuthorized(false);
        setError('Please sign in to access this page.');
      } else if (res.status === 403) {
        setIsAuthorized(false);
        setError('Access denied. This page is restricted.');
      } else if (data.error) {
        setError(data.error);
      } else {
        setEntries(data.entries || []);
      }
    } catch (err) {
      setError('Failed to fetch waitlist');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Not authorized - show login prompt
  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <Logo className="w-12 h-14 text-white mx-auto mb-6" />
          <h1 className="text-2xl font-medium mb-2">Admin Access Required</h1>
          <p className="text-white/50 mb-8">
            {error || 'Please sign in with an authorized account to view the waitlist.'}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full text-sm font-medium hover:bg-white/90 transition"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
          <div className="mt-6">
            <Link href="/" className="text-white/40 text-sm hover:text-white transition">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Logo className="w-6 h-7 text-white" />
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-white/60">Admin</span>
            <span className="text-white/20">/</span>
            <span>Waitlist</span>
          </div>
          <button
            onClick={fetchWaitlist}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/20 rounded text-sm hover:bg-white/5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-white/40" />
              <span className="text-white/40 text-sm">Total Signups</span>
            </div>
            <div className="text-4xl font-light">{entries.length}</div>
          </div>
          <div className="border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 text-white/40" />
              <span className="text-white/40 text-sm">Total Locations</span>
            </div>
            <div className="text-4xl font-light">
              {entries.reduce((acc, e) => {
                const count = e.location_count === '15+' ? 15 :
                  e.location_count === '2-5' ? 3 :
                  e.location_count === '6-15' ? 10 : 1;
                return acc + count;
              }, 0)}+
            </div>
          </div>
          <div className="border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-white/40" />
              <span className="text-white/40 text-sm">Latest Signup</span>
            </div>
            <div className="text-lg font-light">
              {entries.length > 0 ? formatDate(entries[0].created_at) : '—'}
            </div>
          </div>
        </div>

        {/* Table */}
        {loading && isAuthorized ? (
          <div className="border border-white/10 p-12 text-center text-white/40">
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div className="border border-white/10 p-12 text-center text-white/40">
            No signups yet
          </div>
        ) : (
          <div className="border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left text-white/40 text-sm">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Car Wash</th>
                    <th className="px-4 py-3 font-medium">Locations</th>
                    <th className="px-4 py-3 font-medium">POS</th>
                    <th className="px-4 py-3 font-medium">Signed Up</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr
                      key={entry.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-4 text-white/40 text-sm">{index + 1}</td>
                      <td className="px-4 py-4 font-medium">{entry.name}</td>
                      <td className="px-4 py-4">
                        <a
                          href={`mailto:${entry.email}`}
                          className="text-white/70 hover:text-white transition"
                        >
                          {entry.email}
                        </a>
                      </td>
                      <td className="px-4 py-4 text-white/70">{entry.wash_name}</td>
                      <td className="px-4 py-4 text-white/70">{entry.location_count}</td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">
                          {entry.pos_type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white/40 text-sm">
                        {formatDate(entry.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/40 hover:text-white transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to site
          </Link>
        </div>
      </main>
    </div>
  );
}
