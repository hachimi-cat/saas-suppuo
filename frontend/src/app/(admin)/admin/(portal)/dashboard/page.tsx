'use client';

/*
 * Admin overview — cross-workspace ticket stats via the CRM endpoints
 * (proxied at /api/v1/console/crm/*, adminGuard resolves the admin
 * session from the role header the console proxy stamps).
 */

import { useEffect, useState } from 'react';

interface Stat {
  key: string;
  label: string;
  value: string;
  accent?: boolean;
}

interface TxRow {
  id: string;
  at: string;
  customer: string | null;
  status: string | null;
  description: string | null;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [rows, setRows] = useState<TxRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/console/crm/stats', { credentials: 'include' })
      .then((r) => r.json())
      .then((b) => setStats((b.data ?? b).stats ?? []))
      .catch(() => setError('Could not load stats'));
    fetch('/api/v1/console/crm/transactions?limit=10', { credentials: 'include' })
      .then((r) => r.json())
      .then((b) => setRows((b.data ?? b).rows ?? []))
      .catch(() => undefined);
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Suppuo Admin</h1>
        <p style={{ color: 'hsl(var(--muted-foreground))' }}>
          Platform-wide ticket activity across every workspace.
        </p>
      </header>

      {error && <p style={{ color: 'hsl(var(--destructive))' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
        {(stats ?? []).map((s) => (
          <div key={s.key} style={{ border: '1px solid hsl(var(--border))', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'hsl(var(--muted-foreground))' }}>
              {s.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: s.accent ? 'hsl(var(--primary))' : undefined }}>
              {s.value}
            </div>
          </div>
        ))}
        {stats === null && !error && <p style={{ color: 'hsl(var(--muted-foreground))' }}>Loading…</p>}
      </div>

      <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'hsl(var(--muted-foreground))', margin: '28px 0 10px' }}>
        Latest tickets
      </h2>
      <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 12, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <p style={{ padding: 20, textAlign: 'center', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
            No tickets yet.
          </p>
        ) : (
          rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderBottom: '1px solid hsl(var(--border))', fontSize: 14 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</span>
              <span style={{ color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
                {r.customer ?? '—'} · {r.status} · {new Date(r.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
