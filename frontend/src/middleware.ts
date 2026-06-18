/**
 * Custom-domain host routing.
 *
 * A workspace can map its own domain (e.g. help.plugipay.com) to its
 * hosted help center + portal. The customer CNAMEs it → suppuo.com (→ the
 * Suppuo box) + a TXT token; once the backend verifies + provisions a
 * cert, the box serves the domain. On that custom domain the ROOT `/` is
 * the workspace's help center and `/portal` its portal — NO `acc_…`/slug
 * in the URL.
 *
 * This middleware:
 *   1. reads the Host (port stripped),
 *   2. for a Suppuo host → `NextResponse.next()` (normal),
 *   3. for any other host → resolves Host→accountId via the backend
 *      `/public/domains/resolve` endpoint (with a 60s in-process cache so
 *      it's not a fetch per request),
 *   4. if an active custom domain resolved → `NextResponse.rewrite()`
 *      mapping the CLEAN path to the internal `/support/<acc>` /
 *      `/portal/<acc>` route. rewrite keeps the browser URL clean (the
 *      custom domain) — which is the whole point.
 *
 * The CLEAN→internal mapping (acc = the resolved accountId):
 *   /              → /support/<acc>
 *   /new           → /support/<acc>/new
 *   /a/<slug>      → /support/<acc>/a/<slug>
 *   /portal        → /portal/<acc>
 *   /portal/<rest> → /portal/<acc>/<rest>   (e.g. /portal/verify)
 *   <anything>     → /support/<acc><pathname>
 *
 * Links inside those subtrees emit CLEAN paths on a custom domain (see
 * src/lib/host-routing.ts) so the rewrite never double-prefixes.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { isSuppuoHost } from '@/lib/host-routing';

// Server-side backend base. In prod NEXT_PUBLIC_API_URL is the relative
// '/api/v1' (nginx owns /api) — useless from middleware, which runs on
// the Edge/Node runtime with no relative origin. Use an absolute internal
// base if one is configured, else fall back to the local backend port.
const RESOLVE_BASE = (() => {
  const internal = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || '';
  if (/^https?:\/\//.test(internal)) {
    // strip a trailing /api/v1 if present so we can append it uniformly
    return internal.replace(/\/+$/, '').replace(/\/api\/v1$/, '') + '/api/v1';
  }
  return 'http://127.0.0.1:4170/api/v1';
})();

// host (lowercased, no port) → { acc, exp } with a ~60s TTL. Module-level
// so it survives across requests in a warm runtime, capping the resolve
// fetch to ~once/minute/host.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { acc: string | null; exp: number }>();

async function resolveAccount(host: string): Promise<string | null> {
  const now = Date.now();
  const hit = cache.get(host);
  if (hit && hit.exp > now) return hit.acc;

  let acc: string | null = null;
  try {
    const res = await fetch(
      `${RESOLVE_BASE}/public/domains/resolve?host=${encodeURIComponent(host)}`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' },
    );
    if (res.ok) {
      const env = (await res.json()) as { data?: { accountId?: string | null } | null };
      acc = env?.data?.accountId ?? null;
    }
  } catch {
    // Backend unreachable — fail open (treat as unknown host → next()).
    acc = null;
  }
  cache.set(host, { acc, exp: now + CACHE_TTL_MS });
  return acc;
}

function rewriteTarget(acc: string, pathname: string): string {
  if (pathname === '/' || pathname === '') return `/support/${acc}`;
  if (pathname === '/portal') return `/portal/${acc}`;
  if (pathname.startsWith('/portal/')) return `/portal/${acc}${pathname.slice('/portal'.length)}`;
  // Everything else (/, /new, /a/<slug>, …) hangs off the help center.
  return `/support/${acc}${pathname}`;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never touch framework/asset/API paths, or paths already prefixed into
  // the internal routes (defensive — the matcher excludes most of these).
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/support/') ||
    pathname.startsWith('/portal/acc_') ||
    /\.[a-zA-Z0-9]+$/.test(pathname) // has a file extension
  ) {
    return NextResponse.next();
  }

  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  if (isSuppuoHost(host)) return NextResponse.next();

  const acc = await resolveAccount(host);
  if (!acc) return NextResponse.next(); // unknown / inactive custom domain

  const url = req.nextUrl.clone();
  url.pathname = rewriteTarget(acc, pathname);
  return NextResponse.rewrite(url);
}

export const config = {
  // Exclude _next internals, the API, the widget/static files, and common
  // static assets. Everything else flows through so a custom-domain root
  // (`/`, `/new`, `/a/…`, `/portal…`) can be rewritten.
  matcher: ['/((?!_next/|api/|widget.js|.*\\.[a-zA-Z0-9]+$).*)'],
};
