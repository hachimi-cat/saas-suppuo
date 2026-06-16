'use client';

/*
 * Widget demo (/widget-demo?account=acc_…) — a bare page that embeds
 * frontend/public/widget.js exactly the way a customer site would, so
 * the team (and the channels-page "Preview" link) can test the live
 * chat widget end-to-end against the real public ticket API.
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function WidgetDemoInner() {
  const params = useSearchParams();
  const account = params.get('account');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!account) return;
    // Inject the script the same way the embed snippet does.
    const script = document.createElement('script');
    script.src = '/widget.js';
    script.async = true;
    script.setAttribute('data-suppuo-account', account);
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);
    return () => {
      script.remove();
      document.getElementById('suppuo-widget-root')?.remove();
    };
  }, [account]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs font-medium uppercase tracking-wider text-primary">Widget demo</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight">Live chat widget preview</h1>
      {account ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            This page embeds the widget for workspace <code className="rounded bg-muted/40 px-1.5 py-0.5 text-xs">{account}</code> —
            exactly what your visitors get when you paste the snippet on your own site. Click the
            blue bubble in the corner to try it; messages land as tickets in that workspace&apos;s
            inbox.
          </p>
          {!loaded && <p className="mt-3 text-sm text-muted-foreground">Loading widget…</p>}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Add <code className="rounded bg-muted/40 px-1.5 py-0.5 text-xs">?account=acc_…</code> to
          the URL (your workspace&apos;s account id — see Dashboard → Channels) to load the widget
          here.
        </p>
      )}
    </div>
  );
}

export default function WidgetDemoPage() {
  return (
    <Suspense fallback={null}>
      <WidgetDemoInner />
    </Suspense>
  );
}
