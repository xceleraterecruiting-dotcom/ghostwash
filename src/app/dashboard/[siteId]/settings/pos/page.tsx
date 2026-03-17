'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface SyncLog {
  id: string;
  sync_type: string;
  records_synced: number;
  members_synced: number;
  washes_synced: number;
  payments_synced: number;
  status: string;
  error_message: string | null;
  started_at: string;
  completed_at: string;
  duration_ms: number;
}

interface POSStatus {
  site: {
    id: string;
    name: string;
    posType: string;
    companyId: string | null;
    locationId: string | null;
    lastSync: string | null;
    syncStatus: string;
  };
  syncLogs: SyncLog[];
  stats: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    recordsSynced: number;
  };
}

const POS_OPTIONS = [
  { value: 'csv_import', label: 'CSV Import', available: true },
  { value: 'washify', label: 'Washify', available: true },
  { value: 'drb', label: 'DRB / Patheon', available: false },
  { value: 'rinsed', label: 'Rinsed', available: false },
  { value: 'everwash', label: 'Everwash', available: false },
];

export default function POSSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<POSStatus | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [posType, setPosType] = useState('csv_import');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [locationId, setLocationId] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/pos/${siteId}`);
      const data = await res.json();

      if (!res.ok) {
        // Don't show error for CSV imports - it's expected
        if (data.site?.posType === 'csv_import' || !data.site?.posType) {
          setStatus({
            site: {
              id: siteId,
              name: '',
              posType: 'csv_import',
              companyId: null,
              locationId: null,
              lastSync: null,
              syncStatus: 'connected',
            },
            syncLogs: [],
            stats: { totalSyncs: 0, successfulSyncs: 0, failedSyncs: 0, recordsSynced: 0 },
          });
          setPosType('csv_import');
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch POS status');
      }

      setStatus(data);
      setPosType(data.site.posType || 'csv_import');
      setCompanyId(data.site.companyId || '');
      setLocationId(data.site.locationId || '');
    } catch (err: any) {
      // For CSV import, don't show error - just set defaults
      setStatus({
        site: {
          id: siteId,
          name: '',
          posType: 'csv_import',
          companyId: null,
          locationId: null,
          lastSync: null,
          syncStatus: 'connected',
        },
        syncLogs: [],
        stats: { totalSyncs: 0, successfulSyncs: 0, failedSyncs: 0, recordsSynced: 0 },
      });
      setPosType('csv_import');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [siteId]);

  const handleTestConnection = async () => {
    setTesting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/pos/${siteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          credentials: { posType, apiKey, apiSecret, companyId, locationId },
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Connection successful! ${data.details?.companyName || ''}`);
      } else {
        setError(data.message || 'Connection test failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/pos/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posType,
          apiKey: apiKey || undefined,
          apiSecret: apiSecret || undefined,
          companyId: companyId || undefined,
          locationId: locationId || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('POS settings saved successfully');
        setApiKey('');
        setApiSecret('');
        fetchStatus();
      } else {
        setError(data.error || 'Failed to save settings');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (fullSync = false) => {
    setSyncing(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/pos/${siteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', fullSync }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(
          `Sync complete: ${data.membersCreated} new, ${data.membersUpdated} updated`
        );
        fetchStatus();
      } else {
        setError(data.errors?.join(', ') || 'Sync failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const getSyncStatusIcon = (syncStatus: string) => {
    switch (syncStatus) {
      case 'connected':
        return <Wifi className="text-success" size={20} />;
      case 'syncing':
        return <Loader2 className="text-accent animate-spin" size={20} />;
      case 'failed':
        return <XCircle className="text-danger" size={20} />;
      case 'stale':
        return <AlertCircle className="text-warning" size={20} />;
      default:
        return <WifiOff className="text-muted" size={20} />;
    }
  };

  const getSyncStatusText = (syncStatus: string) => {
    switch (syncStatus) {
      case 'connected':
        return 'Connected';
      case 'syncing':
        return 'Syncing...';
      case 'failed':
        return 'Sync Failed';
      case 'stale':
        return 'Stale Data';
      default:
        return 'Not Configured';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">POS Integration</h1>
            <p className="text-muted text-sm">
              Connect your point-of-sale system for live member data
            </p>
          </div>
          <Link
            href={`/dashboard/${siteId}/settings`}
            className="text-muted hover:text-foreground text-sm transition-colors"
          >
            ← Settings
          </Link>
        </div>
      </header>

      <div className="p-6 max-w-4xl">
        {/* Status Card - CSV Import */}
        {status && status.site.posType === 'csv_import' && (
          <div className="bg-surface border border-border rounded-xl p-6 mb-6 hover:border-border-hover transition-colors">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-success" size={20} />
              <div>
                <h2 className="text-foreground font-semibold">CSV Import</h2>
                <p className="text-muted text-sm">Connected — Upload member data via the Import page</p>
              </div>
            </div>
          </div>
        )}

        {/* Status Card - API Integration */}
        {status && status.site.posType !== 'csv_import' && status.site.syncStatus !== 'not_configured' && (
          <div className="bg-surface border border-border rounded-xl p-6 mb-6 hover:border-border-hover transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {getSyncStatusIcon(status.site.syncStatus)}
                <div>
                  <h2 className="text-foreground font-semibold">
                    {POS_OPTIONS.find((p) => p.value === status.site.posType)?.label || status.site.posType}
                  </h2>
                  <p className="text-muted text-sm">{getSyncStatusText(status.site.syncStatus)}</p>
                </div>
              </div>
              <button
                onClick={() => handleSync(false)}
                disabled={syncing}
                className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-medium px-4 py-2.5 rounded-lg disabled:opacity-50 transition-all duration-150 active:scale-[0.98]"
              >
                {syncing ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <RefreshCw size={16} />
                )}
                Sync Now
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted">Last Sync</p>
                <p className="text-foreground">{formatDate(status.site.lastSync)}</p>
              </div>
              <div>
                <p className="text-muted">24h Syncs</p>
                <p className="text-foreground font-mono">{status.stats.totalSyncs}</p>
              </div>
              <div>
                <p className="text-muted">Successful</p>
                <p className="text-success font-mono">{status.stats.successfulSyncs}</p>
              </div>
              <div>
                <p className="text-muted">Records</p>
                <p className="text-foreground font-mono">{status.stats.recordsSynced}</p>
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 mb-6 text-danger">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-4 mb-6 text-success">
            {success}
          </div>
        )}

        {/* Configuration */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-6 hover:border-border-hover transition-colors">
          <h2 className="text-lg font-semibold text-foreground mb-4">Configuration</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                POS System
              </label>
              <select
                value={posType}
                onChange={(e) => setPosType(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
              >
                {POS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={!opt.available}>
                    {opt.label} {!opt.available && '(Coming Soon)'}
                  </option>
                ))}
              </select>
            </div>

            {posType === 'washify' && (
              <>
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 text-accent text-sm">
                  Washify integration available — enter your API credentials below or{' '}
                  <a href="mailto:support@ghostwash.ai" className="underline hover:text-foreground">
                    contact support@ghostwash.ai
                  </a>{' '}
                  to set up the connection.
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">
                      Company ID
                    </label>
                    <input
                      type="text"
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      placeholder="Your Washify Company ID"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">
                      Location ID
                    </label>
                    <input
                      type="text"
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      placeholder="Your Location ID"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter API key to update"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    API Secret (optional)
                  </label>
                  <input
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="Enter API secret if required"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-150"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleTestConnection}
                    disabled={testing || !apiKey}
                    className="flex items-center gap-2 bg-surface-hover hover:bg-border text-foreground font-medium px-4 py-2.5 rounded-lg disabled:opacity-50 transition-all duration-150"
                  >
                    {testing ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Wifi size={16} />
                    )}
                    Test Connection
                  </button>
                </div>
              </>
            )}

            {posType === 'csv_import' && (
              <div className="bg-surface-hover border border-border rounded-lg p-4 text-muted text-sm">
                CSV import is the default method. Upload member data through the{' '}
                <Link href={`/dashboard/${siteId}/import`} className="text-accent hover:underline">
                  Import page
                </Link>
                .
              </div>
            )}

            {(posType === 'drb' || posType === 'rinsed' || posType === 'everwash') && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-warning text-sm">
                {posType === 'drb'
                  ? "We're in DRB/Patheon certification. Use CSV import for now."
                  : `${POS_OPTIONS.find((p) => p.value === posType)?.label} integration coming soon. Use CSV import for now.`}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-2.5 rounded-lg disabled:opacity-50 transition-all duration-150 active:scale-[0.98]"
            >
              {saving && <Loader2 className="animate-spin" size={16} />}
              Save Configuration
            </button>
          </div>
        </div>

        {/* Sync Logs */}
        {status?.syncLogs && status.syncLogs.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-6 hover:border-border-hover transition-colors">
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Syncs</h2>

            <div className="space-y-2">
              {status.syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {log.status === 'success' ? (
                      <CheckCircle className="text-success" size={18} />
                    ) : log.status === 'partial' ? (
                      <AlertCircle className="text-warning" size={18} />
                    ) : (
                      <XCircle className="text-danger" size={18} />
                    )}
                    <div>
                      <p className="text-foreground text-sm">
                        {log.sync_type === 'full' ? 'Full Sync' : 'Incremental Sync'}
                      </p>
                      <p className="text-muted text-xs">
                        {formatDate(log.started_at)} • <span className="font-mono">{log.duration_ms}ms</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-foreground text-sm font-mono">
                      {log.members_synced} members, {log.washes_synced} washes
                    </p>
                    {log.error_message && (
                      <p className="text-danger text-xs truncate max-w-xs">
                        {log.error_message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
