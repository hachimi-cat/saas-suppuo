import { createHmac, timingSafeEqual } from 'node:crypto';

/*
 * Requester tokens — stateless, HMAC-signed credentials for the
 * customer-facing support portal (a ticket requester proving "these are
 * my tickets"). Two purposes:
 *   - 'login'   short-lived (15 min), emailed as a magic link.
 *   - 'session' long-lived (30 days), set as the portal session cookie.
 * A token is `<base64url(payload)>.<base64url(hmac)>`. No DB row — the
 * signature IS the proof; revocation is by secret rotation / expiry,
 * which is acceptable for a requester (low-privilege) session.
 */

// Read the signing secret LAZILY (per call) — .env is loaded into
// process.env at runtime by Prisma's bundled dotenv (the app has no
// standalone dotenv), so a module-load-time read could race that. The
// chain prefers a dedicated secret but falls back to the workspace's
// existing strong SESSION_SIGNING_SECRET, so the hosted portal is secure
// in prod even before SUPPUO_REQUESTER_SECRET is provisioned.
function secret(): string {
  return (
    process.env.SUPPUO_REQUESTER_SECRET ||
    process.env.SESSION_SIGNING_SECRET ||
    process.env.SESSION_SECRET ||
    'suppuo-dev-requester-secret-change-me'
  );
}

export type RequesterPurpose = 'login' | 'session';

export interface RequesterClaims {
  accountId: string;
  email: string;
  purpose: RequesterPurpose;
  exp: number; // epoch seconds
}

const TTL: Record<RequesterPurpose, number> = {
  login: 15 * 60,
  session: 30 * 24 * 60 * 60,
};

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function sign(payloadB64: string): string {
  return b64url(createHmac('sha256', secret()).update(payloadB64).digest());
}

export function issueRequesterToken(
  accountId: string,
  email: string,
  purpose: RequesterPurpose,
): string {
  const claims: RequesterClaims = {
    accountId,
    email: email.toLowerCase(),
    purpose,
    exp: Math.floor(Date.now() / 1000) + TTL[purpose],
  };
  const payload = b64url(Buffer.from(JSON.stringify(claims)));
  return `${payload}.${sign(payload)}`;
}

export function verifyRequesterToken(
  token: string,
  purpose: RequesterPurpose,
): RequesterClaims | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: RequesterClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (claims.purpose !== purpose) return null;
  if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) return null;
  if (!claims.accountId || !claims.email) return null;
  return claims;
}

export const REQUESTER_COOKIE = 'suppuo_req';
