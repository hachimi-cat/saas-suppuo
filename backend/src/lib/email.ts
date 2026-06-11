// Requester email notifications — Resend via the shared Forjio account
// (RESEND_API_KEY). Env-gated: silent console no-op when unset (dev,
// tests, fresh deploys). Fire-and-forget at every call site — a mail
// failure must never fail a ticket write.

import { resolveEmailForAccount } from './channels.js';

const PORTAL = process.env.SUPPUO_PUBLIC_URL ?? 'https://suppuo.forjio.com';

async function send(
  accountId: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  // BYO Resend (the workspace's own key + from address) wins over the
  // platform sender.
  const resolved = await resolveEmailForAccount(accountId);
  if (!resolved) {
    console.log(`[email:dev] to=${to} subj="${subject}"`);
    return;
  }
  // Reply-To = the workspace's inbound alias, so a plain email reply
  // threads straight back into the ticket (email-to-ticket webhook).
  const inboundDomain = process.env.SUPPUO_INBOUND_EMAIL_DOMAIN ?? 'in.suppuo.com';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resolved.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: resolved.from,
      to,
      subject,
      html,
      text,
      reply_to: `${accountId}@${inboundDomain}`,
    }),
  });
  if (!res.ok) {
    throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

function statusLink(token: string): string {
  return `${PORTAL}/t/${token}`;
}

export async function sendTicketReceivedEmail(opts: {
  accountId: string;
  to: string;
  ticketNumber: number;
  subject: string;
  accessToken: string;
}): Promise<void> {
  const link = statusLink(opts.accessToken);
  await send(
    opts.accountId,
    opts.to,
    `[#${opts.ticketNumber}] We received your request — ${opts.subject}`,
    `<div style="font-family:sans-serif;max-width:520px"><p>Thanks for reaching out! Your request has been logged as ticket <strong>#${opts.ticketNumber}</strong>.</p><p><strong>${opts.subject}</strong></p><p>We'll reply by email. You can follow progress or add details any time:</p><p><a href="${link}">${link}</a></p><p style="color:#888;font-size:12px">Powered by Suppuo — helpdesk for Indonesian SMEs.</p></div>`,
    `Thanks for reaching out! Your request is ticket #${opts.ticketNumber}: ${opts.subject}\nFollow progress: ${link}`,
  );
}

/** Post-resolve CSAT survey — three one-click emoji links onto the
 *  tokenized /t/<token>/rate page. Sent at most once per ticket (the
 *  outbox consumer guards on tickets.csatSentAt). */
export async function sendCsatSurveyEmail(opts: {
  accountId: string;
  to: string;
  ticketNumber: number;
  subject: string;
  accessToken: string;
}): Promise<void> {
  const rate = (score: number) => `${PORTAL}/t/${opts.accessToken}/rate?score=${score}`;
  await send(
    opts.accountId,
    opts.to,
    `[#${opts.ticketNumber}] How did we do? — ${opts.subject}`,
    `<div style="font-family:sans-serif;max-width:520px"><p>Your ticket <strong>#${opts.ticketNumber}</strong> (${opts.subject}) was resolved.</p><p>How did we do? One click is all it takes:</p><p style="font-size:32px;text-align:center"><a href="${rate(1)}" style="text-decoration:none;margin:0 14px">&#128542;</a><a href="${rate(2)}" style="text-decoration:none;margin:0 14px">&#128528;</a><a href="${rate(3)}" style="text-decoration:none;margin:0 14px">&#128522;</a></p><p style="color:#888;font-size:12px">Powered by Suppuo — helpdesk for Indonesian SMEs.</p></div>`,
    `Your ticket #${opts.ticketNumber} (${opts.subject}) was resolved.\nHow did we do?\n\nBad: ${rate(1)}\nOkay: ${rate(2)}\nGreat: ${rate(3)}`,
  );
}

export async function sendAgentRepliedEmail(opts: {
  accountId: string;
  to: string;
  ticketNumber: number;
  subject: string;
  accessToken: string;
  replyBody: string;
  agentName: string | null;
}): Promise<void> {
  const link = statusLink(opts.accessToken);
  const who = opts.agentName ?? 'Support';
  await send(
    opts.accountId,
    opts.to,
    `[#${opts.ticketNumber}] New reply — ${opts.subject}`,
    `<div style="font-family:sans-serif;max-width:520px"><p><strong>${who}</strong> replied to your ticket <strong>#${opts.ticketNumber}</strong>:</p><blockquote style="border-left:3px solid #F43F5E;margin:0;padding:8px 14px;white-space:pre-wrap">${opts.replyBody.replace(/</g, '&lt;')}</blockquote><p>Reply on the ticket page:</p><p><a href="${link}">${link}</a></p></div>`,
    `${who} replied to ticket #${opts.ticketNumber}:\n\n${opts.replyBody}\n\nReply: ${link}`,
  );
}
