import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../lib/db.js';
import { h as asyncHandler } from '../lib/async-handler.js';
import {
  parseCloudInboundMessages,
  verifyMetaSignature,
} from '../lib/whatsapp-cloud.js';
import { resolveWhatsAppCloudByPhoneNumberId } from '../lib/channels.js';
import { ingestInboundPhoneMessage } from '../lib/ticket-ingest.js';

/*
 * /api/v1/webhooks/whatsapp-cloud — Meta's WhatsApp Cloud API webhook
 * (BYO channel; one shared endpoint, routed by phone_number_id).
 *
 *   GET  — the Meta verification handshake: hub.mode=subscribe +
 *          hub.verify_token must match ANY active whatsapp_cloud
 *          integration's verifyToken → echo hub.challenge as plain
 *          text.
 *   POST — message events. entry[].changes[].value: each incoming text
 *          message routes by value.metadata.phone_number_id to a
 *          workspace, then runs the same find-or-create ticket flow as
 *          the Twilio webhook (channel='whatsapp'). Status / read-
 *          receipt deliveries are ignored.
 *
 * Auth honestly stated: Meta signs payloads with the APP secret
 * (X-Hub-Signature-256). The connect payload accepts an OPTIONAL
 * appSecret — when the workspace stored one, the signature is
 * verified over the raw bytes and a mismatch drops the delivery;
 * when absent we skip verification and rely on the unguessable
 * verify-token handshake + phone-number-ID routing. We always ACK 200
 * on POST (Meta retries aggressively and eventually disables the
 * subscription on persistent non-2xx).
 */

const router = Router();

// GET — subscription verification handshake.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const mode = typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : '';
    const token =
      typeof req.query['hub.verify_token'] === 'string' ? req.query['hub.verify_token'] : '';
    const challenge =
      typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : '';

    if (mode !== 'subscribe' || !token || !challenge) {
      return res.status(400).type('text/plain').send('bad request');
    }

    const rows = await prisma.channelIntegration.findMany({
      where: { provider: 'whatsapp_cloud', status: 'active' },
    });
    const supplied = Buffer.from(token);
    const matched = rows.some((integ) => {
      const cfg = integ.config as { verifyToken?: string };
      if (typeof cfg?.verifyToken !== 'string' || !cfg.verifyToken) return false;
      const expected = Buffer.from(cfg.verifyToken);
      return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
    });
    if (!matched) {
      return res.status(403).type('text/plain').send('verify token mismatch');
    }
    res.status(200).type('text/plain').send(challenge);
  }),
);

// POST — message events (JSON; raw bytes captured by the app-level
// parser's verify hook for signature checks).
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const messages = parseCloudInboundMessages(req.body);

    for (const msg of messages) {
      try {
        const resolved = await resolveWhatsAppCloudByPhoneNumberId(msg.phoneNumberId);
        if (!resolved) {
          console.warn('[whatsapp-cloud] no integration for phone_number_id', msg.phoneNumberId);
          continue;
        }
        // Optional signature check — only enforceable when the
        // workspace stored its Meta app secret at connect time.
        if (resolved.creds.appSecret) {
          const ok = verifyMetaSignature(
            req.rawBody ?? '',
            req.headers['x-hub-signature-256'] as string | undefined,
            resolved.creds.appSecret,
          );
          if (!ok) {
            console.warn('[whatsapp-cloud] bad X-Hub-Signature-256 for', msg.phoneNumberId);
            continue; // drop, but still ACK 200 below
          }
        }
        await ingestInboundPhoneMessage({
          accountId: resolved.accountId,
          phone: msg.from,
          name: msg.profileName,
          body: msg.body,
          channel: 'whatsapp',
        });
      } catch (e) {
        // Never bubble — a single bad message must not 500 the batch
        // (Meta would retry the whole delivery).
        console.error('[whatsapp-cloud] ingest failed', e);
      }
    }

    // Always ACK — Meta retries aggressively on non-2xx.
    res.status(200).json({ received: true });
  }),
);

export default router;
