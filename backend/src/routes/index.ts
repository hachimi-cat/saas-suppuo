import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { sendOk } from '../lib/http.js';
import { prisma } from '../lib/db.js';
import authRouter from './auth.js';
import huudisProxyRouter from './huudis-proxy.js';
import { adminGuard } from '../middleware/admin-guard.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import ticketsRouter from './tickets.js';
import meRouter from './me.js';
import profileRouter from './profile.js';
import channelsRouter from './channels.js';
import adminCrmRouter from './admin-crm.js';
import cannedRepliesRouter from './canned-replies.js';
import publicTicketsRouter from './public-tickets.js';
import webhooksTwilioRouter from './webhooks-twilio.js';
import webhooksWhatsappCloudRouter from './webhooks-whatsapp-cloud.js';
import webhooksTelegramRouter from './webhooks-telegram.js';
import webhooksPlugipayRouter from './webhooks-plugipay.js';
import webhooksResendRouter from './webhooks-resend.js';
import adminCustomersRouter from './admin-customers.js';
import billingRouter from './billing.js';
import attachmentsRouter from './attachments.js';
import apiKeysRouter from './api-keys.js';
import webhookSubscriptionsRouter from './webhook-subscriptions.js';
import settingsRouter from './settings.js';
import csatRouter from './csat.js';
import reportsRouter from './reports.js';

/**
 * Route factory. Ported from saas-plugipay.
 *
 * Every product's `app.ts` calls this with `createApp({
 * enableTestOnlyRoutes })`; pass `true` in tests that need the
 * `/test-only/*` mount (e.g. to stub auth context). Never enable in
 * production.
 */
export interface RoutesOptions {
  enableTestOnlyRoutes?: boolean;
}

async function checkDb(): Promise<'ok' | 'error'> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkOutbox(): Promise<'ok' | 'error'> {
  try {
    await prisma.outboxEvent.count();
    return 'ok';
  } catch {
    return 'error';
  }
}

export default function routes(_opts: RoutesOptions = {}): ExpressRouter {
  const router = Router();

  /** GET /api/v1/health — no auth, returns service name + status +
   *  dependency checks. Every Forjio service exposes the same shape
   *  so uptime monitors are uniform. */
  router.get('/health', async (req, res) => {
    const [db, outbox] = await Promise.all([checkDb(), checkOutbox()]);
    sendOk(res, req, {
      service: process.env.FORJIO_SERVICE ?? 'suppuo',
      status: 'ok',
      version: process.env.npm_package_version ?? '0.0.1',
      checks: { db, outbox },
    });
  });

  /** Auth — cookie-first Huudis SSO. Login/signup/password-reset/OIDC.
   *  Powers the `(auth)` pages + the `(dashboard)` gate. */
  router.use('/auth', authRouter);

  /** Huudis IAM proxy — account + workspace management. The frontend
   *  calls /api/v1/huudis/{account,account/workspaces,iam/users} and
   *  the kit forwards them to Huudis with the server-side token. */
  router.use('/huudis', huudisProxyRouter);

  /** Admin "Customers" — this product's own users, pulled from Huudis
   *  via the product's OIDC client creds. Proxied from the admin portal
   *  at /api/v1/console/customers. */
  router.use('/admin/customers', adminGuard, adminCustomersRouter);
  router.use('/admin/crm', adminGuard, adminCrmRouter);

  /** Suppuo domain — agent surfaces (BFF session or Bearer JWT). */
  router.use('/me', requireAuth, meRouter);
  /** Agent profile — own avatar upload/remove + any member's avatar
   *  fetch. Display name edits go through /huudis/account instead. */
  router.use('/profile', requireAuth, profileRouter);
  router.use('/channels', requireAuth, channelsRouter);
  router.use('/tickets', requireAuth, ticketsRouter);
  /** Ticket-message attachments — staged upload + account-scoped
   *  download (the public token-scoped surface lives under /public). */
  router.use('/attachments', requireAuth, attachmentsRouter);
  router.use('/canned-replies', requireAuth, cannedRepliesRouter);
  /** Feature wave: CSAT + automation — workspace automation settings
   *  (business hours + auto-response) and CSAT aggregates. */
  router.use('/settings', requireAuth, settingsRouter);
  router.use('/csat', requireAuth, csatRouter);
  /** Reports — on-the-fly support analytics (volume, response times,
   *  CSAT). Read-only aggregates; powers /dashboard/reports. */
  router.use('/reports', requireAuth, reportsRouter);
  /** Requester-facing public surface — tokenized, rate-limited. */
  router.use('/public', rateLimit('ingress'), publicTicketsRouter);
  /** Billing — Plugipay-powered plan subscriptions. */
  router.use('/billing', requireAuth, billingRouter);
  /** Inbound channel webhooks (Twilio WhatsApp, Telegram bots). */
  router.use('/webhooks/twilio', webhooksTwilioRouter);
  /** WhatsApp Cloud API (Meta direct) — handshake GET + message POST. */
  router.use('/webhooks/whatsapp-cloud', webhooksWhatsappCloudRouter);
  /** Telegram bot updates — per-integration path + secret. */
  router.use('/webhooks/telegram', webhooksTelegramRouter);
  /** Plugipay billing webhooks (HMAC-signed, no session auth). */
  router.use('/webhooks/plugipay', webhooksPlugipayRouter);
  /** Resend inbound email → tickets (svix-signed, no session auth). */
  router.use('/webhooks/resend', webhooksResendRouter);
  /** Programmatic access keys (session callers manage; keys themselves
   *  authenticate via the sk_live_ Bearer path in middleware/auth.ts). */
  router.use('/api-keys', requireAuth, apiKeysRouter);
  /** Outbound webhook endpoints — suppuo.ticket.* event delivery. */
  router.use('/webhook-subscriptions', requireAuth, webhookSubscriptionsRouter);

  // Products mount their own routers here, e.g.:
  //   router.use('/widgets', widgetsRouter);
  //
  // Admin surfaces — mount product admin routers under `/admin`,
  // behind `adminGuard` (middleware/admin-guard.ts). The built-in
  // admin portal proxies to them via `/api/v1/console/*`:
  //   import { adminGuard } from '../middleware/admin-guard.js';
  //   router.use('/admin/widgets', adminGuard, adminWidgetsRouter);
  //
  // if (opts.enableTestOnlyRoutes) {
  //   router.use('/test-only', testOnlyRouter);
  // }

  return router;
}
