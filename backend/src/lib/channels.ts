import { prisma } from './db.js';
import { decryptCredentials } from './channel-crypto.js';
import type { CloudChannelCreds } from './whatsapp-cloud.js';

// Channel resolution — BYO provider creds per workspace, with platform
// fallbacks. Consumers: the Twilio webhook (inbound routing by WA
// number), the WhatsApp Cloud webhook (inbound routing by phone number
// ID), the ticket reply path (outbound WA), and the email sender.

export interface TwilioChannelCreds {
  accountSid: string;
  authToken: string;
}

/** A workspace's WhatsApp send path — discriminated on the provider.
 *  `twilio` = Twilio REST (BYO account or the platform number);
 *  `cloud` = Meta's Cloud API direct (always BYO). */
export type ResolvedWhatsApp = ResolvedWhatsAppTwilio | ResolvedWhatsAppCloud;

export interface ResolvedWhatsAppTwilio {
  kind: 'twilio';
  accountId: string; // suppuo workspace
  creds: TwilioChannelCreds;
  from: string; // whatsapp:+62…
  byo: boolean;
}

export interface ResolvedWhatsAppCloud {
  kind: 'cloud';
  accountId: string; // suppuo workspace
  accessToken: string;
  phoneNumberId: string;
  /** Display number in E.164 (the integration's externalId). */
  from: string;
  byo: true;
}

/** Inbound routing (Twilio webhook): which workspace owns this WA
 *  number? BYO Twilio integrations first (matched on the `To` number),
 *  then the platform number → SUPPUO_TWILIO_ACCOUNT_ID. */
export async function resolveWhatsAppByNumber(
  to: string,
): Promise<ResolvedWhatsAppTwilio | null> {
  const integ = await prisma.channelIntegration.findFirst({
    where: { provider: 'whatsapp_twilio', externalId: to, status: 'active' },
  });
  if (integ) {
    try {
      const creds = decryptCredentials<TwilioChannelCreds>(integ.credentials);
      return { kind: 'twilio', accountId: integ.accountId, creds, from: `whatsapp:${to}`, byo: true };
    } catch (e) {
      console.error('[channels] credential decrypt failed', integ.id, e);
    }
  }
  const platformFrom = process.env.TWILIO_WHATSAPP_FROM?.replace(/^whatsapp:/, '');
  const platformAccount = process.env.SUPPUO_TWILIO_ACCOUNT_ID;
  if (
    platformFrom === to &&
    platformAccount &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  ) {
    return {
      kind: 'twilio',
      accountId: platformAccount,
      creds: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
      },
      from: `whatsapp:${to}`,
      byo: false,
    };
  }
  return null;
}

/** Inbound routing (Meta Cloud webhook): which workspace owns this
 *  phone number ID? Matched on config.phoneNumberId of active
 *  whatsapp_cloud integrations. Returns the decrypted creds too so the
 *  webhook can check X-Hub-Signature-256 when an appSecret is stored. */
export async function resolveWhatsAppCloudByPhoneNumberId(
  phoneNumberId: string,
): Promise<{ accountId: string; creds: CloudChannelCreds } | null> {
  const rows = await prisma.channelIntegration.findMany({
    where: { provider: 'whatsapp_cloud', status: 'active' },
  });
  for (const integ of rows) {
    const cfg = integ.config as { phoneNumberId?: string };
    if (cfg?.phoneNumberId !== phoneNumberId) continue;
    try {
      return {
        accountId: integ.accountId,
        creds: decryptCredentials<CloudChannelCreds>(integ.credentials),
      };
    } catch (e) {
      console.error('[channels] credential decrypt failed', integ.id, e);
    }
  }
  return null;
}

/** Outbound: how does THIS workspace send WhatsApp? BYO integration
 *  first (whatsapp_cloud or whatsapp_twilio, newest wins), else the
 *  platform Twilio number. */
export async function resolveWhatsAppForAccount(
  accountId: string,
): Promise<ResolvedWhatsApp | null> {
  const integ = await prisma.channelIntegration.findFirst({
    where: {
      accountId,
      provider: { in: ['whatsapp_twilio', 'whatsapp_cloud'] },
      status: 'active',
    },
    orderBy: { createdAt: 'desc' },
  });
  if (integ?.externalId) {
    try {
      if (integ.provider === 'whatsapp_cloud') {
        const creds = decryptCredentials<CloudChannelCreds>(integ.credentials);
        const cfg = integ.config as { phoneNumberId?: string };
        if (creds.accessToken && cfg?.phoneNumberId) {
          return {
            kind: 'cloud',
            accountId,
            accessToken: creds.accessToken,
            phoneNumberId: cfg.phoneNumberId,
            from: integ.externalId,
            byo: true,
          };
        }
      } else {
        const creds = decryptCredentials<TwilioChannelCreds>(integ.credentials);
        return { kind: 'twilio', accountId, creds, from: `whatsapp:${integ.externalId}`, byo: true };
      }
    } catch (e) {
      console.error('[channels] credential decrypt failed', integ.id, e);
    }
  }
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM
  ) {
    return {
      kind: 'twilio',
      accountId,
      creds: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
      },
      from: process.env.TWILIO_WHATSAPP_FROM,
      byo: false,
    };
  }
  return null;
}

export interface ResolvedEmail {
  apiKey: string;
  from: string;
  byo: boolean;
}

/** Outbound email: workspace's BYO Resend (their key + from address)
 *  else the platform Resend. */
export async function resolveEmailForAccount(accountId: string): Promise<ResolvedEmail | null> {
  const integ = await prisma.channelIntegration.findFirst({
    where: { accountId, provider: 'email_resend', status: 'active' },
  });
  if (integ) {
    try {
      const creds = decryptCredentials<{ apiKey: string }>(integ.credentials);
      const cfg = integ.config as { fromEmail?: string; fromName?: string };
      if (creds.apiKey && cfg.fromEmail) {
        const from = cfg.fromName ? `${cfg.fromName} <${cfg.fromEmail}>` : cfg.fromEmail;
        return { apiKey: creds.apiKey, from, byo: true };
      }
    } catch (e) {
      console.error('[channels] credential decrypt failed', integ.id, e);
    }
  }
  const platformKey = process.env.RESEND_API_KEY;
  if (platformKey) {
    return {
      apiKey: platformKey,
      from: process.env.EMAIL_FROM ?? 'Suppuo <noreply@suppuo.forjio.com>',
      byo: false,
    };
  }
  return null;
}

export interface ResolvedTelegram {
  accountId: string;
  botToken: string;
  byo: true;
}

/** Outbound Telegram: the workspace's own bot (no platform fallback —
 *  Telegram is BYO-only). */
export async function resolveTelegramForAccount(
  accountId: string,
): Promise<ResolvedTelegram | null> {
  const integ = await prisma.channelIntegration.findFirst({
    where: { accountId, provider: 'telegram_bot', status: 'active' },
  });
  if (!integ) return null;
  try {
    const creds = decryptCredentials<{ botToken?: string }>(integ.credentials);
    if (creds.botToken) return { accountId, botToken: creds.botToken, byo: true };
  } catch (e) {
    console.error('[channels] credential decrypt failed', integ.id, e);
  }
  return null;
}
