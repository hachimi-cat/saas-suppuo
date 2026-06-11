import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { DashboardShell } from '@/components/dashboard-shell';
import type { SessionUser } from '@forjio/portal-ui';

/*
 * Dashboard route-group layout — the auth gate. No session cookie →
 * bounce to /login. With one, resolve the user via the backend's
 * /auth/me and hand it to the portal shell.
 *
 * Cookie name is `suppuo_session` (rename.sh rewrites the
 * `suppuo` slug).
 */

const SESSION_COOKIE = 'suppuo_session';
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4170';

type Resolved = { user: SessionUser; accountId: string };

async function fetchCurrentUser(cookieHeader: string): Promise<Resolved | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    // /api/v1/auth/me comes from @forjio/sdk/auth-server — identity is
    // nested under `user`, with the accountId exposed as `user.id`.
    const body = (await res.json()) as {
      data?: { user?: { id?: string; name?: string; email?: string } };
    };
    const u = body.data?.user;
    if (!u?.email || !u.id) return null;
    return {
      user: { name: u.name ?? u.email, email: u.email },
      accountId: u.id,
    };
  } catch {
    return null;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  if (!jar.get(SESSION_COOKIE)) {
    redirect('/login?return_to=/dashboard');
  }

  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const resolved = await fetchCurrentUser(cookieHeader);

  // Cookie present but the session didn't resolve (expired / signing-key
  // change) — send them back through login to mint a fresh one.
  if (!resolved) {
    redirect('/login?return_to=/dashboard');
  }

  return (
    <DashboardShell user={resolved.user} accountId={resolved.accountId}>
      {children}
    </DashboardShell>
  );
}
