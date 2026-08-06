import type { Request } from 'express';
import { createCatentioRouter, type CatentioEmbedUser } from '@forjio/catentio-embed';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';
import { sendOk, sendErr } from '../lib/http.js';
import { catentioPilotEnabled } from '../lib/feature-flag-registry.js';
import {
  SUPPUO_DELEGATION_PREFIX,
  SUPPUO_PROFILE,
  type SuppuoLimits,
} from '../lib/catentio-profile.js';

/**
 * The catentio BFF — suppuo's consumption of @forjio/catentio-embed
 * (the shared router extracted from linksnap's reference integration).
 * Everything mechanical (gates, buckets, credit pre-flight, delegation
 * minting, sanitizers, attachment/media serving) lives in the package;
 * this file is the product adapter: envelope, auth, flag, settings
 * storage, plan, and the resource profile.
 */

/** Suppuo tier → the CP's plan-grant tier. The CP's monthly credit
 *  grants are keyed on the linksnap-era names (free 50 / pro 500 /
 *  business 1200, still DRAFT); suppuo's own tier name stays in
 *  `limits.plan` for the prompt. */
function grantPlan(tier: string): string {
  if (tier === 'business') return 'BUSINESS';
  if (tier === 'free' || tier === 'gratis') return 'FREE';
  return 'PRO'; // starter, growth
}

async function resolveTier(accountId: string): Promise<string> {
  const sub = await prisma.billingSubscription.findUnique({ where: { accountId } });
  return sub?.tier ?? 'free';
}

async function resolveUser(req: Request): Promise<CatentioEmbedUser | null> {
  const auth = req.auth as
    | { sub?: string; accountId?: string; email?: string; name?: string }
    | undefined;
  // API-key auth stamps `api_key:` subs — the assistant is per-user
  // (the flag allowlist holds usr_… ids) and acts as a person, never
  // as a workspace credential.
  if (!auth?.sub || !auth.accountId || auth.sub.startsWith('api_key:')) return null;
  return {
    sub: auth.sub,
    email: auth.email ?? '',
    name: auth.name ?? '',
    workspaceId: auth.accountId,
    plan: grantPlan(await resolveTier(auth.accountId)),
  };
}

const embed = createCatentioRouter<SuppuoLimits>({
  product: 'suppuo',
  profile: SUPPUO_PROFILE,
  knownApiBases: ['https://suppuo.forjio.com', 'https://staging-suppuo.forjio.com'],
  authenticate: requireAuth,
  getUser: resolveUser,
  flagEnabled: (u) => catentioPilotEnabled(u.sub, u.email),
  envelope: {
    ok: (res, data) => sendOk(res, (res as any).req, data),
    err: (res, e) => sendErr(res, (res as any).req, e.status, e.code, e.message),
  },
  settings: {
    async getAutoApply(accountId) {
      const row = await prisma.assistantSettings.findUnique({ where: { accountId } });
      return row?.autoApply !== false;
    },
    async setAutoApply(accountId, autoApply) {
      await prisma.assistantSettings.upsert({
        where: { accountId },
        create: { accountId, autoApply },
        update: { autoApply },
      });
    },
  },
  async planLimits(u) {
    return { plan: await resolveTier(u.workspaceId) };
  },
  // Suppuo keeps no local roles (membership is Huudis-side); any
  // signed-in member of the workspace may flip the assistant setting.
  canWriteSettings: () => true,
  delegationPrefix: SUPPUO_DELEGATION_PREFIX,
});

export const clearCatentioGateState = embed.clearGateState;
export default embed.router;
