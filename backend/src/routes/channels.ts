import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { newId } from '../lib/ids.js';
import { sendOk, sendCreated, sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { encryptCredentials } from '../lib/channel-crypto.js';

/*
 * /api/v1/channels — per-workspace BYO channel integrations (ripllo's
 * ChannelIntegration pattern). v1 providers:
 *
 *   whatsapp_twilio — the workspace's OWN Twilio account + WA number;
 *                     inbound webhooks route by number, outbound replies
 *                     use their creds (= unlimited messages, the Bisnis
 *                     "BYO" promise).
 *   email_resend    — the workspace's OWN Resend key + from address for
 *                     branded requester notifications.
 *
 * Credentials are validated LIVE against the provider before the
 * integration activates, then stored AES-256-GCM-encrypted. List
 * responses never include credentials.
 */

const router = Router();

const PROVIDERS = ['whatsapp_twilio', 'email_resend'] as const;

function publicShape(row: {
  id: string;
  provider: string;
  externalId: string | null;
  displayName: string;
  status: string;
  config: unknown;
  lastError: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    provider: row.provider,
    externalId: row.externalId,
    displayName: row.displayName,
    status: row.status,
    config: row.config,
    lastError: row.lastError,
    createdAt: row.createdAt,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await prisma.channelIntegration.findMany({
      where: { accountId: req.auth!.accountId as string },
      orderBy: { createdAt: 'asc' },
    });
    sendOk(res, req, {
      integrations: rows.map(publicShape),
      platform: {
        whatsapp:
          Boolean(process.env.TWILIO_WHATSAPP_FROM) && Boolean(process.env.TWILIO_AUTH_TOKEN),
        email: Boolean(process.env.RESEND_API_KEY),
      },
    });
  }),
);

const createBody = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('whatsapp_twilio'),
    accountSid: z.string().regex(/^AC[a-f0-9]{32}$/),
    authToken: z.string().min(16),
    whatsappNumber: z.string().regex(/^\+\d{6,16}$/),
    displayName: z.string().trim().max(120).optional(),
  }),
  z.object({
    provider: z.literal('email_resend'),
    apiKey: z.string().min(8),
    fromEmail: z.string().email(),
    fromName: z.string().trim().max(120).optional(),
  }),
]);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const input = createBody.parse(req.body);

    if (input.provider === 'whatsapp_twilio') {
      // Live validation: can these creds read their own account?
      const check = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}.json`,
        {
          headers: {
            Authorization:
              'Basic ' +
              Buffer.from(`${input.accountSid}:${input.authToken}`).toString('base64'),
          },
        },
      );
      if (!check.ok) {
        return sendErr(res, req, 400, 'VALIDATION_ERROR', `Twilio rejected the credentials (${check.status}) — check the Account SID + auth token.`);
      }
      const row = await prisma.channelIntegration.upsert({
        where: {
          accountId_provider_externalId: {
            accountId,
            provider: 'whatsapp_twilio',
            externalId: input.whatsappNumber,
          },
        },
        create: {
          id: newId('chn'),
          accountId,
          provider: 'whatsapp_twilio',
          externalId: input.whatsappNumber,
          displayName: input.displayName ?? `WhatsApp ${input.whatsappNumber}`,
          status: 'active',
          credentials: encryptCredentials({
            accountSid: input.accountSid,
            authToken: input.authToken,
          }),
          config: { whatsappNumber: input.whatsappNumber },
        },
        update: {
          status: 'active',
          lastError: null,
          credentials: encryptCredentials({
            accountSid: input.accountSid,
            authToken: input.authToken,
          }),
        },
      });
      return sendCreated(res, req, {
        ...publicShape(row),
        webhookUrl: `${process.env.SUPPUO_PUBLIC_URL ?? 'https://suppuo.com'}/api/v1/webhooks/twilio/whatsapp?secret=${process.env.SUPPUO_TWILIO_WEBHOOK_SECRET ?? ''}`,
        note: "Point your Twilio number's incoming-message webhook at webhookUrl (POST).",
      });
    }

    // email_resend
    const check = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${input.apiKey}` },
    });
    if (!check.ok) {
      return sendErr(res, req, 400, 'VALIDATION_ERROR', `Resend rejected the API key (${check.status}).`);
    }
    const row = await prisma.channelIntegration.upsert({
      where: {
        accountId_provider_externalId: {
          accountId,
          provider: 'email_resend',
          externalId: input.fromEmail,
        },
      },
      create: {
        id: newId('chn'),
        accountId,
        provider: 'email_resend',
        externalId: input.fromEmail,
        displayName: input.fromName ?? input.fromEmail,
        status: 'active',
        credentials: encryptCredentials({ apiKey: input.apiKey }),
        config: { fromEmail: input.fromEmail, fromName: input.fromName ?? null },
      },
      update: {
        status: 'active',
        lastError: null,
        credentials: encryptCredentials({ apiKey: input.apiKey }),
        config: { fromEmail: input.fromEmail, fromName: input.fromName ?? null },
      },
    });
    sendCreated(res, req, publicShape(row));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const existing = await prisma.channelIntegration.findFirst({
      where: { id: String(req.params.id), accountId },
    });
    if (!existing) return sendErr(res, req, 404, 'NOT_FOUND', 'integration not found');
    await prisma.channelIntegration.delete({ where: { id: existing.id } });
    sendOk(res, req, { deleted: true });
  }),
);

export default router;

export type ChannelProvider = (typeof PROVIDERS)[number];
