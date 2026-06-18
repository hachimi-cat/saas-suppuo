import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { sendOk } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { sendRequesterLoginEmail } from '../lib/email.js';
import { resolveAccountId } from '../lib/resolve-account.js';
import { isDefaultHostname, resolveHostToAccount } from '../lib/custom-domains.js';
import {
  issueRequesterToken,
  verifyRequesterToken,
  REQUESTER_COOKIE,
} from '../lib/requester-token.js';

/*
 * /api/v1/public/requester — unauthenticated entry to the HOSTED customer
 * portal. Passwordless: POST /login emails a magic link; POST /verify
 * exchanges its token for a 30-day session cookie. The authenticated
 * "my tickets" API lives at /api/v1/requester (see requireRequester).
 *
 * Privacy + anti-enumeration: /login always returns ok (never reveals
 * whether the email has tickets) and is per-IP rate limited so it can't
 * be used to email-bomb an address.
 */

const router = Router();

// Per-IP rate limit on the email-sending login endpoint (in-process).
const RL_MS = 15 * 60 * 1000;
const RL_MAX = 8; // ≤8 login emails / IP / 15 min
const ipHits = new Map<string, number[]>();
function clientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0]!.trim();
  return req.ip || 'unknown';
}
function limited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < RL_MS);
  if (hits.length >= RL_MAX) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of ipHits) {
    const live = hits.filter((t) => now - t < RL_MS);
    if (live.length === 0) ipHits.delete(ip);
    else ipHits.set(ip, live);
  }
}, RL_MS).unref();

const loginBody = z.object({
  // A handle: acc_… id OR a workspace slug (resolved below).
  accountId: z.string().trim().min(3).max(64),
  email: z.string().trim().email(),
  // The origin the user is signing in from (window.location.origin) —
  // used for the verify link so a custom-domain login's session cookie
  // lands on that domain. Validated below (must be a Suppuo host or an
  // ACTIVE custom domain for THIS workspace) to prevent open-redirect.
  origin: z.string().trim().max(255).optional(),
});

async function validatedVerifyBase(
  origin: string | undefined,
  accountId: string,
): Promise<string | undefined> {
  if (!origin) return undefined;
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return undefined;
  }
  if (isDefaultHostname(host)) return origin.replace(/\/$/, '');
  const acc = await resolveHostToAccount(host);
  return acc === accountId ? origin.replace(/\/$/, '') : undefined;
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginBody.parse(req.body);
    if (limited(clientIp(req))) {
      // Still 200 (don't leak), just skip sending.
      return sendOk(res, req, { ok: true });
    }
    // Resolve the handle (slug or acc_…) to the real workspace id; the
    // token + email are keyed on the resolved accountId. Still always-200.
    const accountId = await resolveAccountId(input.accountId);
    if (!accountId) return sendOk(res, req, { ok: true });
    const token = issueRequesterToken(accountId, input.email, 'login');
    // On a custom domain, the verify link must point back to that domain
    // (root /portal/verify) so the session cookie lands there; otherwise
    // the suppuo.com /portal/<handle>/verify link.
    const verifyBase = await validatedVerifyBase(input.origin, accountId);
    void sendRequesterLoginEmail({
      accountId,
      handle: input.accountId,
      customBase: verifyBase,
      to: input.email.toLowerCase(),
      loginToken: token,
    }).catch((e) => console.error('[public-requester] login-email failed', e));
    // Always ok — never reveal whether the address has any tickets.
    sendOk(res, req, { ok: true });
  }),
);

const verifyBody = z.object({ token: z.string().min(10).max(2000) });

router.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const { token } = verifyBody.parse(req.body);
    const claims = verifyRequesterToken(token, 'login');
    if (!claims) {
      return sendOk(res, req, { ok: false });
    }
    const session = issueRequesterToken(claims.accountId, claims.email, 'session');
    res.cookie(REQUESTER_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    sendOk(res, req, { ok: true, email: claims.email, accountId: claims.accountId });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    res.clearCookie(REQUESTER_COOKIE, { path: '/' });
    sendOk(res, req, { ok: true });
  }),
);

export default router;
