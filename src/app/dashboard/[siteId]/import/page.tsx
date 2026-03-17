'use client';

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function ImportPage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params.siteId as string;

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setError('');
      } else {
        setError('Please upload a CSV file');
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('siteId', siteId);

      const res = await fetch('/api/pos/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult({ imported: data.imported });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Import Members</h1>
          <p className="text-muted mt-2">Upload your member list from your POS export</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
          {/* CSV Format Guide */}
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
            <h3 className="text-accent font-medium mb-2">CSV Format</h3>
            <p className="text-muted text-sm mb-2">
              Your CSV should have these columns (headers in first row):
            </p>
            <code className="text-xs text-foreground bg-background px-3 py-2 rounded-lg block overflow-x-auto font-mono">
              member_id, first_name, last_name, email, phone, plan_name, plan_price, start_date, status
            </code>
          </div>

          {/* Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-150 ${
              dragActive
                ? 'border-accent bg-accent/10'
                : file
                ? 'border-success bg-success/10'
                : 'border-border hover:border-border-hover'
            }`}
          >
            {file ? (
              <div>
                <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
                  <span className="text-success text-xl">✓</span>
                </div>
                <p className="text-foreground font-medium">{file.name}</p>
                <p className="text-muted text-sm">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  onClick={() => setFile(null)}
                  className="text-danger text-sm mt-2 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📄</span>
                </div>
                <p className="text-foreground mb-2">Drag & drop your CSV here</p>
                <p className="text-muted text-sm mb-4">or</p>
                <label className="cursor-pointer bg-surface-hover hover:bg-border text-foreground px-4 py-2.5 rounded-lg transition-colors inline-block">
                  Browse Files
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {error && (
            <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg p-3">
              {error}
            </div>
          )}

          {result && (
            <div className="text-success bg-success/10 border border-success/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold font-mono">{result.imported}</div>
              <div className="text-sm">members imported successfully</div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="flex-1 bg-accent hover:bg-accent-hover text-white font-semibold py-3 px-4 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? 'Importing...' : 'Import Members'}
            </button>

            {result && (
              <button
                onClick={() => router.push(`/dashboard/${siteId}/members`)}
                className="flex-1 bg-success hover:bg-success/90 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-150 active:scale-[0.98]"
              >
                View Members →
              </button>
            )}
          </div>
        </div>

        {/* Sample CSV Download */}
        <div className="mt-6 text-center">
          <a
            href="/sample-members.csv"
            download
            className="text-muted hover:text-foreground text-sm underline transition-colors"
          >
            Download sample CSV template
          </a>
        </div>
      </div>
    </div>
  );
}
