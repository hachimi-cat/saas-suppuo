import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { newId } from '../lib/ids.js';
import { sendOk, sendCreated, sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import { encryptCredentials } from '../lib/channel-crypto.js';
import { GRAPH_BASE, generateVerifyToken } from '../lib/whatsapp-cloud.js';
import {
  telegramGetMe,
  telegramSetWebhook,
  generateTelegramWebhookSecret,
} from '../lib/telegram.js';
import {
  isSlackWebhookUrl,
  isDiscordWebhookUrl,
  sendTeamConnectedTest,
} from '../lib/team-notify.js';

/*
 * /api/v1/channels — per-workspace BYO channel integrations (ripllo's
 * ChannelIntegration pattern). Providers:
 *
 *   whatsapp_twilio — the workspace's OWN Twilio account + WA number;
 *                     inbound webhooks route by number, outbound replies
 *                     use their creds (= unlimited messages, the Business
 *                     "BYO" promise).
 *   whatsapp_cloud  — the workspace's OWN Meta WhatsApp Business account
 *                     (Cloud API direct, no Twilio): access token +
 *                     phone number ID. Inbound routes by phone_number_id
 *                     via /webhooks/whatsapp-cloud; outbound goes to
 *                     graph.facebook.com.
 *   email_resend    — the workspace's OWN Resend key + from address for
 *                     branded requester notifications.
 *   telegram_bot    — the workspace's OWN Telegram bot (@BotFather
 *                     token); two-way: inbound chats become tickets via
 *                     a per-integration webhook (registered automatically
 *                     with setWebhook), agent replies go back over
 *                     sendMessage.
 *   slack_webhook   — Slack incoming webhook; outbound-only team
 *                     notifications on new tickets + customer replies.
 *   discord_webhook — Discord webhook; same team notifications.
 *
 * Credentials are validated LIVE against the provider before the
 * integration activates, then stored AES-256-GCM-encrypted. List
 * responses never include credentials.
 */

const router = Router();

const PROVIDERS = [
  'whatsapp_twilio',
  'whatsapp_cloud',
  'email_resend',
  'telegram_bot',
  'slack_webhook',
  'discord_webhook',
] as const;

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
    provider: z.literal('whatsapp_cloud'),
    accessToken: z.string().min(16),
    phoneNumberId: z.string().regex(/^\d{5,20}$/),
    wabaId: z.string().regex(/^\d{5,20}$/).optional(),
    /** The number's human-facing E.164 (+62…) — becomes externalId so
     *  the inbound router + reply path can match on it. */
    displayNumber: z.string().regex(/^\+\d{6,16}$/),
    /** Webhook handshake token — generated when absent. */
    verifyToken: z.string().min(8).max(128).optional(),
    /** Meta APP secret — optional; enables X-Hub-Signature-256
     *  verification on inbound webhooks when provided. */
    appSecret: z.string().min(8).max(128).optional(),
    displayName: z.string().trim().max(120).optional(),
  }),
  z.object({
    provider: z.literal('email_resend'),
    apiKey: z.string().min(8),
    fromEmail: z.string().email(),
    fromName: z.string().trim().max(120).optional(),
  }),
  z.object({
    provider: z.literal('telegram_bot'),
    botToken: z.string().regex(/^\d+:[A-Za-z0-9_-]{20,}$/, 'must look like 123456789:AA…'),
    displayName: z.string().trim().max(120).optional(),
  }),
  z.object({
    provider: z.literal('slack_webhook'),
    webhookUrl: z.string().url().max(500),
    displayName: z.string().trim().max(120).optional(),
  }),
  z.object({
    provider: z.literal('discord_webhook'),
    webhookUrl: z.string().url().max(500),
    displayName: z.string().trim().max(120).optional(),
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

    if (input.provider === 'whatsapp_cloud') {
      // Live validation: can this token read its own phone number?
      const check = await fetch(
        `${GRAPH_BASE}/${input.phoneNumberId}?fields=display_phone_number`,
        { headers: { Authorization: `Bearer ${input.accessToken}` } },
      );
      if (!check.ok) {
        return sendErr(res, req, 400, 'VALIDATION_ERROR', `Meta rejected the credentials (${check.status}) — check the access token + phone number ID.`);
      }
      const verifyToken = input.verifyToken ?? generateVerifyToken();
      const config = {
        phoneNumberId: input.phoneNumberId,
        verifyToken,
        ...(input.wabaId ? { wabaId: input.wabaId } : {}),
      };
      const credentials = encryptCredentials({
        accessToken: input.accessToken,
        ...(input.appSecret ? { appSecret: input.appSecret } : {}),
      });
      const row = await prisma.channelIntegration.upsert({
        where: {
          accountId_provider_externalId: {
            accountId,
            provider: 'whatsapp_cloud',
            externalId: input.displayNumber,
          },
        },
        create: {
          id: newId('chn'),
          accountId,
          provider: 'whatsapp_cloud',
          externalId: input.displayNumber,
          displayName: input.displayName ?? `WhatsApp Cloud ${input.displayNumber}`,
          status: 'active',
          credentials,
          config,
        },
        update: {
          status: 'active',
          lastError: null,
          credentials,
          config,
        },
      });
      return sendCreated(res, req, {
        ...publicShape(row),
        webhookUrl: `${process.env.SUPPUO_PUBLIC_URL ?? 'https://suppuo.com'}/api/v1/webhooks/whatsapp-cloud`,
        verifyToken,
        note: 'Meta App dashboard → WhatsApp → Configuration → Webhook: set the Callback URL + Verify token above, then subscribe to the "messages" field.',
      });
    }

    if (input.provider === 'telegram_bot') {
      // Live validation: who is this bot? (also proves the token works)
      const me = await telegramGetMe(input.botToken);
      if (!me) {
        return sendErr(res, req, 400, 'VALIDATION_ERROR', 'Telegram rejected the bot token — check the token from @BotFather.');
      }
      const handle = me.username ? `@${me.username}` : (me.firstName ?? `bot ${me.id}`);
      const webhookSecret = generateTelegramWebhookSecret();
      const row = await prisma.channelIntegration.upsert({
        where: {
          accountId_provider_externalId: {
            accountId,
            provider: 'telegram_bot',
            externalId: String(me.id),
          },
        },
        create: {
          id: newId('chn'),
          accountId,
          provider: 'telegram_bot',
          externalId: String(me.id),
          displayName: input.displayName ?? handle,
          status: 'active',
          credentials: encryptCredentials({ botToken: input.botToken }),
          config: { botUsername: me.username, webhookSecret },
        },
        update: {
          status: 'active',
          lastError: null,
          displayName: input.displayName ?? handle,
          credentials: encryptCredentials({ botToken: input.botToken }),
          config: { botUsername: me.username, webhookSecret },
        },
      });
      // Register the per-integration inbound webhook with Telegram.
      const webhookUrl = `${process.env.SUPPUO_PUBLIC_URL ?? 'https://suppuo.com'}/api/v1/webhooks/telegram/${row.id}?secret=${webhookSecret}`;
      const hooked = await telegramSetWebhook(input.botToken, webhookUrl);
      if (!hooked) {
        await prisma.channelIntegration.update({
          where: { id: row.id },
          data: { status: 'error', lastError: 'telegram setWebhook failed' },
        });
        return sendErr(res, req, 400, 'VALIDATION_ERROR', 'Telegram accepted the token but setWebhook failed — try again in a minute.');
      }
      return sendCreated(res, req, {
        ...publicShape(row),
        note: `Webhook registered with Telegram automatically — messages to ${handle} will open tickets here.`,
      });
    }

    if (input.provider === 'slack_webhook' || input.provider === 'discord_webhook') {
      const isSlack = input.provider === 'slack_webhook';
      const shapeOk = isSlack
        ? isSlackWebhookUrl(input.webhookUrl)
        : isDiscordWebhookUrl(input.webhookUrl);
      if (!shapeOk) {
        return sendErr(res, req, 400, 'VALIDATION_ERROR', isSlack ? 'That does not look like a Slack incoming-webhook URL (https://hooks.slack.com/services/…).' : 'That does not look like a Discord webhook URL (https://discord.com/api/webhooks/…).');
      }
      // Live validation IS the test message: post "connected ✓".
      const delivered = await sendTeamConnectedTest(input.provider, input.webhookUrl);
      if (!delivered) {
        return sendErr(res, req, 400, 'VALIDATION_ERROR', `${isSlack ? 'Slack' : 'Discord'} rejected the test message — check the webhook URL.`);
      }
      // Stable per-URL identity without persisting the URL in plaintext.
      const externalId = crypto
        .createHash('sha256')
        .update(input.webhookUrl)
        .digest('hex')
        .slice(0, 16);
      const row = await prisma.channelIntegration.upsert({
        where: {
          accountId_provider_externalId: {
            accountId,
            provider: input.provider,
            externalId,
          },
        },
        create: {
          id: newId('chn'),
          accountId,
          provider: input.provider,
          externalId,
          displayName:
            input.displayName ?? (isSlack ? 'Slack notifications' : 'Discord notifications'),
          status: 'active',
          credentials: encryptCredentials({ webhookUrl: input.webhookUrl }),
          config: {},
        },
        update: {
          status: 'active',
          lastError: null,
          ...(input.displayName ? { displayName: input.displayName } : {}),
          credentials: encryptCredentials({ webhookUrl: input.webhookUrl }),
        },
      });
      return sendCreated(res, req, publicShape(row));
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
