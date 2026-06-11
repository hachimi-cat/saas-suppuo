import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AuthError, type ForjioClaims } from '@forjio/sdk/auth';
import { resolveSessionForRequest, parseCookie } from '@forjio/sdk/auth-server';
import { authConfig } from '../auth-config.js';
import { sendErr } from '../lib/http.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: ForjioClaims;
  }
}

const issuer = process.env.HUUDIS_ISSUER ?? 'https://huudis.com';
const audience = process.env.HUUDIS_AUDIENCE ?? process.env.FORJIO_SERVICE ?? 'suppuo';

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
    const accountId =
      override && allowed.has(override) ? override : bffSession.accountId;
    req.auth = {
      sub: bffSession.huudisSub,
      accountId,
      scope: '',
      iss: issuer,
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 900,
      iat: Math.floor(Date.now() / 1000),
    } as unknown as ForjioClaims;
    return next();
  }

  const token = req.headers.authorization?.replace(/^Bearer /i, '');
  if (!token) {
    return sendErr(res, req, 401, 'AUTH_REQUIRED', 'Missing Authorization header');
  }
  try {
    req.auth = await verifyAccessToken(token, { issuer, audience });
    next();
  } catch (e) {
    const authErr = e instanceof AuthError ? e : new AuthError('INVALID_TOKEN', 'verification failed');
    return sendErr(res, req, 401, authErr.code, authErr.message);
  }
}
