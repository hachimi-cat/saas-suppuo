import { Router } from 'express';
import express from 'express';
import { sendErr } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import {
  fetchTwilioMedia,
  normalizeWhatsAppFrom,
  webhookSecretMatches,
  validateTwilioSignature,
} from '../lib/twilio.js';
import { resolveWhatsAppByNumber } from '../lib/channels.js';
import { ingestInboundPhoneMessage, type IngestAttachment } from '../lib/ticket-ingest.js';
import {
  ingestFilename,
  isIngestAllowedContentType,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from '../lib/attachments.js';

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
    let body = typeof req.body?.Body === 'string' ? req.body.Body.trim() : '';
    const name =
      typeof req.body?.ProfileName === 'string' && req.body.ProfileName.trim()
        ? req.body.ProfileName.trim()
        : null;
    const numMedia = Math.min(
      Number.parseInt(String(req.body?.NumMedia ?? '0'), 10) || 0,
      MAX_ATTACHMENTS_PER_MESSAGE,
    );
    if (!phone || (!body && numMedia === 0)) {
      return sendErr(res, req, 400, 'VALIDATION_ERROR', 'From (whatsapp:) and Body required');
    }

    // Inbound media: fetch each MediaUrl{N} from Twilio (basic auth
    // with the owning account's creds) and store as attachments on the
    // inbound message. Oversize/unsupported items are skipped
    // gracefully — a bad photo must never drop the conversation.
    const attachments: IngestAttachment[] = [];
    for (let i = 0; i < numMedia; i++) {
      const url = req.body?.[`MediaUrl${i}`];
      if (typeof url !== 'string' || !/^https:\/\/api\.twilio\.com\//.test(url)) continue;
      const media = await fetchTwilioMedia({
        url,
        accountSid: channel.creds.accountSid,
        authToken: channel.creds.authToken,
        maxBytes: MAX_ATTACHMENT_BYTES,
      });
      if (!media) continue;
      const contentType =
        typeof req.body?.[`MediaContentType${i}`] === 'string' &&
        req.body[`MediaContentType${i}`].trim()
          ? String(req.body[`MediaContentType${i}`]).split(';')[0]!.trim().toLowerCase()
          : media.contentType;
      if (!isIngestAllowedContentType(contentType)) {
        console.warn(`[twilio] inbound media type ${contentType} not allowed — skipped`);
        continue;
      }
      attachments.push({
        filename: ingestFilename(contentType, attachments.length),
        contentType,
        data: media.data,
      });
    }
    if (!body && attachments.length === 0 && numMedia > 0) {
      // Media-only message where every item failed/was skipped — still
      // record the conversation turn rather than dropping it.
      body = '[attachment could not be retrieved]';
    }
    if (!body && attachments.length > 0) {
      body = attachments.map((a) => `[attachment: ${a.filename}]`).join('\n');
    }

    // Same find-or-create flow as the WhatsApp Cloud webhook — shared
    // in lib/ticket-ingest.ts.
    await ingestInboundPhoneMessage({
      accountId,
      phone,
      name,
      body,
      channel: 'whatsapp',
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    // Empty TwiML — acknowledge without auto-reply.
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  }),
);

export default router;
