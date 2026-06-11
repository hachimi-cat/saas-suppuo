import { prisma } from './db.js';
import { decryptCredentials } from './channel-crypto.js';

// Channel resolution — BYO provider creds per workspace, with platform
// fallbacks. Consumers: the Twilio webhook (inbound routing by WA
// number), the ticket reply path (outbound WA), and the email sender.

export interface TwilioChannelCreds {
  accountSid: string;
  authToken: string;
}

export interface ResolvedWhatsApp {
  accountId: string; // suppuo workspace
  creds: TwilioChannelCreds;
  from: string; // whatsapp:+62…
  byo: boolean;
}

/** Inbound routing: which workspace owns this WA number? BYO
 *  integrations first (matched on the `To` number), then the platform
 *  number → SUPPUO_TWILIO_ACCOUNT_ID. */
export async function resolveWhatsAppByNumber(to: string): Promise<ResolvedWhatsApp | null> {
  const integ = await prisma.channelIntegration.findFirst({
    where: { provider: 'whatsapp_twilio', externalId: to, status: 'active' },
  });
  if (integ) {
    try {
      const creds = decryptCredentials<TwilioChannelCreds>(integ.credentials);
      return { accountId: integ.accountId, creds, from: `whatsapp:${to}`, byo: true };
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

/** Outbound: how does THIS workspace send WhatsApp? BYO integration
 *  first, else the platform number. */
export async function resolveWhatsAppForAccount(
  accountId: string,
): Promise<ResolvedWhatsApp | null> {
  const integ = await prisma.channelIntegration.findFirst({
    where: { accountId, provider: 'whatsapp_twilio', status: 'active' },
  });
  if (integ?.externalId) {
    try {
      const creds = decryptCredentials<TwilioChannelCreds>(integ.credentials);
      return { accountId, creds, from: `whatsapp:${integ.externalId}`, byo: true };
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
