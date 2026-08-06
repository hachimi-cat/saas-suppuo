import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AuthError, type ForjioClaims } from '@forjio/sdk/auth';
import { resolveSessionForRequest, parseCookie } from '@forjio/sdk/auth-server';
import { authConfig } from '../auth-config.js';
import { sendErr } from '../lib/http.js';
import { prisma } from '../lib/db.js';
import { API_KEY_PREFIX, hashApiKey } from '../lib/api-keys.js';
import { recordIdentitySeen } from '../lib/identity-roster.js';
import {
  DELEGATION_DENIED_PATHS as EMBED_DENIED_PATHS,
  getDelegationSecret,
  verifyDelegationToken,
} from '@forjio/catentio-embed';
import { SUPPUO_DELEGATION_PREFIX } from '../lib/catentio-profile.js';

/**
 * Allowlist-first, as on storlaunch: an embedded agent run may reach
 * these prefixes and NOTHING else, whatever the method. These are
 * exactly the resources in SUPPUO_PROFILE.
 *
 * What this keeps closed matters more here than on a catalog product:
 * /tickets and /requester are live conversations with real end users,
 * and /channels holds the encrypted provider credentials that send on
 * the workspace's behalf.
 */
const DELEGATION_ALLOWED_PATHS = ['/api/v1/help', '/api/v1/canned-replies'];

/**
 * Denied BEFORE the allowlist is consulted, so a future allowlist entry
 * can never re-open one of them. `EMBED_DENIED_PATHS` (the package's
 * floor: /auth, /api-keys, /billing, /catentio) is inherited rather
 * than copied, so a later addition there lands here for free — and on
 * suppuo those four DO match real mounts, unlike storlaunch where
 * /api/v1/api-keys matched nothing.
 */
const DELEGATION_DENIED_PATHS = [
  ...EMBED_DENIED_PATHS,
  '/api/v1/tickets',
  '/api/v1/requester',
  '/api/v1/public',
  '/api/v1/channels',
  '/api/v1/attachments',
  '/api/v1/webhooks',
  '/api/v1/admin',
  '/api/v1/huudis',
  '/api/v1/settings',
  '/api/v1/domains',
  '/api/v1/csat',
  '/api/v1/reports',
  '/api/v1/me',
  '/api/v1/profile',
];

declare module 'express-serve-static-core' {
  interface Request {
    auth?: ForjioClaims;
  }
}

const issuer = process.env.HUUDIS_ISSUER ?? 'https://huudis.com';
const audience = process.env.HUUDIS_AUDIENCE ?? process.env.FORJIO_SERVICE ?? 'suppuo';

/** Live Huudis membership check — only hit on the stale-session path
 *  (override cookie not in the login-time accountIds snapshot). */
async function liveWorkspaceIds(accessToken: string): Promise<Set<string> | null> {
  try {
    const res = await fetch(`${issuer}/api/v1/account/workspaces`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: Array<{ id?: string }> };
    return new Set((body.data ?? []).map((w) => w.id).filter((x): x is string => !!x));
  } catch {
    return null;
  }
}

/** Extracts `Authorization: Bearer <jwt>` and verifies via @forjio/sdk.
 *  Attaches claims to `req.auth`. Rejects with a standard envelope on
 *  failure. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Path 0 — browser session cookie (the BFF path, fulkruma pattern):
  // the backend is the Huudis OAuth client; resolve the merchant role
  // session minted by routes/auth.ts. Portal fetches ride this.
  const bffSession = resolveSessionForRequest(authConfig, req);
  if (bffSession && bffSession.role !== 'admin') {
    // Workspace switcher override (fulkruma pattern): honor the
    // `suppuo_active_workspace` cookie when it names a workspace the
    // session is actually a member of (accountIds from Huudis), else
    // fall back to the personal derived accountId.
    const override = parseCookie(req.headers.cookie, 'suppuo_active_workspace');
    const allowed = new Set([bffSession.accountId, ...(bffSession.accountIds ?? [])]);
    let accountId = override && allowed.has(override) ? override : bffSession.accountId;
    if (override && !allowed.has(override) && bffSession.huudisAccessToken) {
      // STALE-SESSION CLASS (serront round 4): accountIds are
      // snapshotted at LOGIN, so a workspace created after sign-in is
      // in the switcher (live list) but not the session — the old code
      // silently served the WRONG workspace (empty data, free tier).
      // Re-check live membership once before falling back; fail-closed
      // to the default on non-membership, timeout, or fetch error.
      const live = await liveWorkspaceIds(bffSession.huudisAccessToken);
      if (live?.has(override)) accountId = override;
    }
    // Identity-roster capture (admin-CRM blind-spot fix): note who is
    // acting under the ACTIVE accountId — covers workspaces switched
    // into post-login and sessions that predate the roster. Throttled
    // in-process (≤1 write per sub+account per hour), fire-and-forget,
    // never throws — zero added latency on the hot path.
    void recordIdentitySeen({
      huudisSub: bffSession.huudisSub,
      email: bffSession.email,
      name: bffSession.name,
      accountIds: [accountId],
    });
    req.auth = {
      sub: bffSession.huudisSub,
      accountId,
      // email/name ride along for the catentio flag allowlist (which
      // matches on either the usr_ id or the address) and for display.
      email: bffSession.email,
      name: bffSession.name,
      scope: '',
      iss: issuer,
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 900,
      iat: Math.floor(Date.now() / 1000),
    } as unknown as ForjioClaims;
    return next();
  }

  // Path 3 — catentio delegation (`Authorization: Delegation <token>`):
  // an embedded agent run acting for a signed-in member (see
  // routes/catentio.ts; token minted there via @forjio/catentio-embed).
  // Checked before the Bearer requirement below because a delegation
  // header is not a Bearer header.
  //
  // Review mode mints the token WITHOUT the write bit, and refusing
  // non-GET here is what makes the review step un-promptable: the agent
  // cannot talk its way past an auth layer that never reads what it
  // said.
  const delegationHeader = req.headers.authorization;
  if (delegationHeader?.startsWith('Delegation ')) {
    // requireAuth runs inside mounted routers, where req.path alone is
    // router-relative — match on baseUrl+path or every rule is a no-op.
    const fullPath = `${req.baseUrl || ''}${req.path || ''}`;
    const denied = DELEGATION_DENIED_PATHS.some(
      (p) => fullPath === p || fullPath.startsWith(`${p}/`),
    );
    const allowed =
      !denied &&
      DELEGATION_ALLOWED_PATHS.some((p) => fullPath === p || fullPath.startsWith(`${p}/`));
    if (!allowed) {
      return sendErr(res, req, 403, 'FORBIDDEN', 'This resource is not available to delegated agents');
    }
    let secret: string;
    try {
      secret = getDelegationSecret();
    } catch {
      return sendErr(res, req, 401, 'INVALID_TOKEN', 'Invalid or expired delegation token');
    }
    const claims = verifyDelegationToken(delegationHeader.slice('Delegation '.length), secret, {
      prefix: SUPPUO_DELEGATION_PREFIX,
    });
    if (!claims) {
      return sendErr(res, req, 401, 'INVALID_TOKEN', 'Invalid or expired delegation token');
    }
    if (!claims.writes && req.method !== 'GET' && req.method !== 'HEAD') {
      return sendErr(
        res,
        req,
        403,
        'FORBIDDEN',
        'This assistant proposes changes for your approval — it cannot write directly',
      );
    }
    req.auth = {
      sub: claims.sub,
      accountId: claims.workspaceId,
      email: claims.email,
      name: claims.name,
      scope: '',
      iss: issuer,
      aud: audience,
      exp: claims.exp,
      iat: claims.iat,
    } as unknown as ForjioClaims;
    return next();
  }

  const token = req.headers.authorization?.replace(/^Bearer /i, '');
  if (!token) {
    return sendErr(res, req, 401, 'AUTH_REQUIRED', 'Missing Authorization header');
  }

  // Path 1 — API key (`Authorization: Bearer sk_live_…`). Checked on
  // the `sk_` prefix BEFORE JWT verification: keys are opaque random
  // strings, not JWTs, and would always fail verifyAccessToken.
  if (token.startsWith('sk_')) {
    if (!token.startsWith(API_KEY_PREFIX)) {
      return sendErr(res, req, 401, 'INVALID_TOKEN', 'Unknown API key format');
    }
    const row = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(token) } });
    if (!row) {
      return sendErr(res, req, 401, 'INVALID_TOKEN', 'Invalid API key');
    }
    req.auth = {
      sub: `api_key:${row.id}`,
      accountId: row.accountId,
      scope: '',
      iss: issuer,
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 900,
      iat: Math.floor(Date.now() / 1000),
    } as unknown as ForjioClaims;
    // Fire-and-forget freshness marker — never blocks the request.
    void prisma.apiKey
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch((e) => console.error('[auth] lastUsedAt update failed', e));
    return next();
  }

  // Path 2 — Huudis-issued Bearer JWT.
  try {
    req.auth = await verifyAccessToken(token, { issuer, audience });
    next();
  } catch (e) {
    const authErr = e instanceof AuthError ? e : new AuthError('INVALID_TOKEN', 'verification failed');
    return sendErr(res, req, 401, authErr.code, authErr.message);
  }
}
