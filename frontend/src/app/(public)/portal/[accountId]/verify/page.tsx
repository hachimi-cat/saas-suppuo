'use client';

/*
 * Magic-link landing (/portal/<accountId>/verify?token=…) — exchanges the
 * emailed login token for a session cookie, then bounces into the portal.
 */

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { apiRequest } from '@/lib/api';
import { currentHost, portalPath } from '@/lib/host-routing';

function Verify({ accountId }: { accountId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const [failed, setFailed] = useState(false);
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => setHost(currentHost()), []);

  useEffect(() => {
    const token = search.get('token');
    if (!token) {
      setFailed(true);
      return;
    }
    apiRequest<{ ok: boolean }>('/public/requester/verify', { method: 'POST', body: { token } })
      .then(({ data }) => {
        // Host-aware destination: clean `/portal` on a custom domain,
        // `/portal/<handle>` on Suppuo. currentHost() is read synchronously
        // here (window is available — this only runs client-side post-mount).
        if (data.ok) router.replace(portalPath(currentHost(), accountId));
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [accountId, router, search]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 text-center">
      {failed ? (
        <>
          <p className="text-sm text-muted-foreground">
            This sign-in link is invalid or has expired.
          </p>
          <a
            href={portalPath(host, accountId)}
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Get a new link
          </a>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      )}
    </div>
  );
}

export default function VerifyPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = use(params);
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}>
      <Verify accountId={accountId} />
    </Suspense>
  );
}
