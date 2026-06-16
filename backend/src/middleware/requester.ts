import type { Request, Response, NextFunction } from 'express';
import { sendErr } from '../lib/http.js';
import { REQUESTER_COOKIE, verifyRequesterToken } from '../lib/requester-token.js';

/*
 * requireRequester — authenticates a ticket REQUESTER (a customer
 * tracking their own tickets), not an agent. Resolves req.requester =
 * { accountId, email } from EITHER:
 *
 *   1. Trusted service call (EMBEDDED path) — a Forjio product's BFF
 *      proxies on behalf of its logged-in user. Headers:
 *        X-Suppuo-Service : the shared SUPPUO_SERVICE_SECRET
 *        X-Suppuo-Account : the product's Suppuo workspace id
 *        X-Suppuo-Requester : the user's (Huudis-verified) email
 *      The BFF is server-side + already authenticated the user, so the
 *      email is trusted once the secret matches.
 *
 *   2. Requester session cookie (HOSTED portal path) — set after the
 *      magic-link login on suppuo.com/portal/<acc>.
 *
 * Either way the requester is scoped to exactly one (accountId, email).
 */

const ACCOUNT_ID_RE = /^acc_[0-9A-Za-z]{24,28}$/;

declare module 'express-serve-static-core' {
  interface Request {
    requester?: { accountId: string; email: string };
  }
}

function serviceSecret(): string | null {
  return process.env.SUPPUO_SERVICE_SECRET || null;
}

function header(req: Request, name: string): string | null {
  const v = req.headers[name.toLowerCase()];
  return typeof v === 'string' ? v : null;
}

export function requireRequester(req: Request, res: Response, next: NextFunction): void {
  // Path 1 — trusted service call (embedded).
  const svc = header(req, 'x-suppuo-service');
  if (svc) {
    const secret = serviceSecret();
    if (!secret || svc !== secret) {
      sendErr(res, req, 401, 'AUTH_REQUIRED', 'invalid service credential');
      return;
    }
    const accountId = header(req, 'x-suppuo-account') ?? '';
    const email = (header(req, 'x-suppuo-requester') ?? '').toLowerCase();
    if (!ACCOUNT_ID_RE.test(accountId) || !email.includes('@')) {
      sendErr(res, req, 400, 'VALIDATION_ERROR', 'service call needs account + requester email');
      return;
    }
    req.requester = { accountId, email };
    next();
    return;
  }

  // Path 2 — requester session cookie (hosted portal).
  const raw = (req as Request & { cookies?: Record<string, string> }).cookies?.[REQUESTER_COOKIE];
  const claims = raw ? verifyRequesterToken(raw, 'session') : null;
  if (!claims) {
    sendErr(res, req, 401, 'AUTH_REQUIRED', 'sign in to view your tickets');
    return;
  }
  req.requester = { accountId: claims.accountId, email: claims.email };
  next();
}
