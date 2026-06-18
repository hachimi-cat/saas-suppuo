/**
 * Host routing — the bridge between Suppuo's slug/`acc_…` URLs and a
 * workspace's own CUSTOM DOMAIN.
 *
 * On a Suppuo host (suppuo.com, *.suppuo.com, the .forjio.com mirror,
 * localhost, staging) the public help center + portal live under
 * `/support/<handle>/…` and `/portal/<handle>` where <handle> is a slug
 * or an `acc_…` id.
 *
 * On a CUSTOM DOMAIN (e.g. help.plugipay.com) the middleware
 * (src/middleware.ts) rewrites the CLEAN paths (`/`, `/new`, `/a/<slug>`,
 * `/portal`, …) INTO those same `[accountId]` routes — but the browser URL
 * stays clean. So every internal LINK inside the help-center + portal
 * subtrees must emit the CLEAN path on a custom domain and the
 * `/support|/portal/<handle>` path on a Suppuo host. A hardcoded
 * `/support/<handle>/…` href on a custom domain would be double-prefixed
 * by the rewrite (→ `/support/<acc>/support/<acc>/…`) and 404 — the
 * exact trap that bit mambo's buyer pages.
 *
 * This module is the single source of truth for "which kind of host am I
 * on, and what href should this link be". The pages are `'use client'`,
 * so they read `window.location.host`; guard for SSR (default to the
 * Suppuo/handle style until mounted, then recompute in an effect).
 */

/** Hosts that are Suppuo's own (NOT a customer custom domain). Mirrors
 *  the matcher logic in src/middleware.ts — keep the two in sync. */
export function isSuppuoHost(host: string | null | undefined): boolean {
  if (!host) return true; // SSR / unknown → treat as Suppuo (handle paths)
  const h = host.split(':')[0].toLowerCase().trim();
  if (!h) return true;
  if (h === 'suppuo.com' || h === 'www.suppuo.com') return true;
  if (h === 'suppuo.forjio.com' || h === 'www.suppuo.forjio.com') return true;
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0') return true;
  if (h.endsWith('.suppuo.com')) return true; // staging-suppuo.suppuo.com etc.
  if (h.endsWith('.suppuo.forjio.com')) return true;
  // Tailscale MagicDNS staging host (e.g. staging-suppuo) — single label.
  if (h === 'staging-suppuo') return true;
  if (h.endsWith('.local')) return true;
  return false;
}

/** Inverse of {@link isSuppuoHost} — a custom domain is anything NOT a
 *  Suppuo host. SSR / unknown host → false (default to handle paths). */
export function isCustomDomain(host: string | null | undefined): boolean {
  if (!host) return false;
  return !isSuppuoHost(host);
}

/** The current browser host, or `null` during SSR / before mount. */
export function currentHost(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.host || null;
}

// ── Link helpers ───────────────────────────────────────────────────────
// Each takes the current host + the workspace handle (the `[accountId]`
// route param value — a slug or `acc_…`). On a custom domain they drop the
// `/support|/portal/<handle>` prefix; on a Suppuo host they keep it.

/** Help-center home: `/` on a custom domain, `/support/<handle>` else. */
export function hcHome(host: string | null | undefined, handle: string): string {
  return isCustomDomain(host) ? '/' : `/support/${handle}`;
}

/**
 * A path UNDER the help center. `sub` is the clean tail WITHOUT a leading
 * slash, e.g. `''` (home), `'new'`, `'a/my-slug'`.
 *   custom domain → `/`, `/new`, `/a/my-slug`
 *   suppuo host   → `/support/<handle>`, `/support/<handle>/new`, …
 */
export function hcPath(host: string | null | undefined, handle: string, sub = ''): string {
  const tail = sub.replace(/^\/+/, '');
  if (isCustomDomain(host)) return tail ? `/${tail}` : '/';
  return tail ? `/support/${handle}/${tail}` : `/support/${handle}`;
}

/**
 * A path UNDER the customer portal. `sub` is the clean tail WITHOUT a
 * leading slash, e.g. `''` (portal home), `'verify'`.
 *   custom domain → `/portal`, `/portal/verify`
 *   suppuo host   → `/portal/<handle>`, `/portal/<handle>/verify`
 */
export function portalPath(host: string | null | undefined, handle: string, sub = ''): string {
  const tail = sub.replace(/^\/+/, '');
  if (isCustomDomain(host)) return tail ? `/portal/${tail}` : '/portal';
  return tail ? `/portal/${handle}/${tail}` : `/portal/${handle}`;
}
