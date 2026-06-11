import { Router } from 'express';
import express from 'express';
import { sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import {
  normalizeWhatsAppFrom,
  webhookSecretMatches,
  validateTwilioSignature,
} from '../lib/twilio.js';
import { resolveWhatsAppByNumber } from '../lib/channels.js';
import { ingestInboundPhoneMessage } from '../lib/ticket-ingest.js';

/*
 * POST /api/v1/webhooks/twilio/whatsapp?secret=… — Twilio inbound
 * WhatsApp messages become tickets:
 *
 *   - latest non-closed ticket for (workspace, phone) → append message
 *     (re-opens per the normal requester-reply transition);
 *   - none → create a fresh ticket (channel=whatsapp), subject from the
 *     first line of the message.
 *
 * Auth: shared secret in the query string (timing-safe compare) — the
 * classic Twilio signature scheme needs the account AUTH TOKEN, which
 * we don't hold (API-key-only credential). v1 routes ALL inbound to the
 * SUPPUO_TWILIO_ACCOUNT_ID workspace (one WA number); per-workspace
 * number mapping is the multi-tenant follow-up.
 *
 * Twilio posts application/x-www-form-urlencoded — parsed locally here
 * (the app-level JSON parser ignores it). Responds 200 with empty TwiML
 * so Twilio doesn't auto-reply or retry.
 */

const router = Router();

router.post(
  '/whatsapp',
  express.urlencoded({ extended: false }),
  asyncHandler(async (req, res) => {
    if (!webhookSecretMatches(typeof req.query.secret === 'string' ? req.query.secret : undefined)) {
      return sendErr(res, req, 401, 'AUTH_REQUIRED', 'bad webhook secret');
    }
    // Defense in depth: classic X-Twilio-Signature validation (the URL
    // Twilio signed includes the ?secret= query).
    const publicUrl = `${process.env.SUPPUO_PUBLIC_URL ?? 'https://suppuo.com'}/api/v1/webhooks/twilio/whatsapp?secret=${req.query.secret}`;

    // Multi-tenant routing: the receiving number (To) decides which
    // workspace owns this conversation — BYO integrations first, then
    // the platform number.
    const toNumber = normalizeWhatsAppFrom(req.body?.To);
    const channel = toNumber ? await resolveWhatsAppByNumber(toNumber) : null;
    if (!channel) {
      return sendErr(res, req, 404, 'NOT_FOUND', 'no workspace bound to this WhatsApp number');
    }
    const accountId = channel.accountId;

    // Signature validation with the OWNING account's auth token (BYO
    // numbers are signed by the customer's Twilio account).
    const sigOk = validateTwilioSignature(
      publicUrl,
      (req.body ?? {}) as Record<string, string>,
      req.headers['x-twilio-signature'] as string | undefined,
      channel.creds.authToken,
    );
    if (!sigOk) {
      return sendErr(res, req, 401, 'INVALID_SIGNATURE', 'bad twilio signature');
    }

    const phone = normalizeWhatsAppFrom(req.body?.From);
    const body = typeof req.body?.Body === 'string' ? req.body.Body.trim() : '';
    const name =
      typeof req.body?.ProfileName === 'string' && req.body.ProfileName.trim()
        ? req.body.ProfileName.trim()
        : null;
    if (!phone || !body) {
      return sendErr(res, req, 400, 'VALIDATION_ERROR', 'From (whatsapp:) and Body required');
    }

    // Same find-or-create flow as the WhatsApp Cloud webhook — shared
    // in lib/ticket-ingest.ts.
    await ingestInboundPhoneMessage({ accountId, phone, name, body, channel: 'whatsapp' });

    // Empty TwiML — acknowledge without auto-reply.
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  }),
);

export default router;
