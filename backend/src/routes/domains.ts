import { Router } from 'express';
import { z } from 'zod';
import { sendOk, sendCreated, sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import * as cd from '../lib/custom-domains.js';

/*
 * Custom domains. Two routers:
 *   - domainsRouter (mounted /api/v1/domains, behind requireAuth): the
 *     workspace manages its domains (add → DNS instructions → verify → status).
 *   - publicDomainsRouter (mounted /api/v1/public/domains): the on-box
 *     provisioner's success/fail callback, and the Host→accountId resolve
 *     the frontend middleware uses to route custom-domain requests.
 */

export const domainsRouter = Router();

const addBody = z.object({ domain: z.string().trim().min(3).max(253) });

domainsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    sendOk(res, req, { domains: await cd.listDomains(req.auth!.accountId as string) });
  }),
);

domainsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { domain } = addBody.parse(req.body);
    sendCreated(res, req, await cd.addDomain(req.auth!.accountId as string, domain));
  }),
);

domainsRouter.post(
  '/:id/verify',
  asyncHandler(async (req, res) => {
    sendOk(res, req, await cd.verifyDomain(String(req.params.id), req.auth!.accountId as string));
  }),
);

domainsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    sendOk(res, req, await cd.removeDomain(String(req.params.id), req.auth!.accountId as string));
  }),
);

// ─── Public ───────────────────────────────────────────────────────────

export const publicDomainsRouter = Router();

// Provisioner callback — auth by the shared provision secret.
const callbackBody = z.object({
  domain: z.string(),
  status: z.enum(['success', 'failed']),
  error: z.string().optional(),
});
publicDomainsRouter.post(
  '/provision-callback',
  asyncHandler(async (req, res) => {
    if (!cd.provisionSecretOk(req.headers['x-provision-secret'] as string | undefined)) {
      return sendErr(res, req, 401, 'AUTH_REQUIRED', 'invalid provision secret');
    }
    const { domain, status } = callbackBody.parse(req.body);
    if (status === 'success') await cd.activateDomain(domain);
    else await cd.failDomain(domain);
    sendOk(res, req, { ok: true });
  }),
);

// Host → accountId — used by the frontend middleware to route a custom
// domain's request to the right workspace. Returns null for Suppuo hosts /
// unknown domains.
publicDomainsRouter.get(
  '/resolve',
  asyncHandler(async (req, res) => {
    const host = typeof req.query.host === 'string' ? req.query.host : '';
    sendOk(res, req, { accountId: host ? await cd.resolveHostToAccount(host) : null });
  }),
);
