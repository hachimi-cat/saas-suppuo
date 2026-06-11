import type { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { newId } from './ids.js';
import { writeOutbox } from './outbox.js';
import { nextStatusOnMessage, generateAccessToken } from './ticket-flow.js';

/** Channel media already fetched by the webhook (e.g. Twilio
 *  MediaUrl{N} bytes) — stored as Attachment rows bound to the inbound
 *  message inside the ingest transaction. */
export interface IngestAttachment {
  filename: string;
  contentType: string;
  data: Buffer;
}

async function createBoundAttachments(
  tx: Prisma.TransactionClient,
  opts: { accountId: string; messageId: string; attachments: IngestAttachment[] },
): Promise<void> {
  for (const a of opts.attachments) {
    await tx.attachment.create({
      data: {
        id: newId('att'),
        accountId: opts.accountId,
        messageId: opts.messageId,
        filename: a.filename,
        contentType: a.contentType,
        size: a.data.length,
        data: new Uint8Array(a.data),
      },
    });
  }
}

// Shared inbound-channel ingestion: a message from a phone-identified
// requester (WhatsApp via Twilio OR Meta Cloud) either appends to the
// latest non-closed ticket for (workspace, phone) — re-opening per the
// normal requester-reply transition — or opens a fresh ticket with the
// subject taken from the first line.

export async function ingestInboundPhoneMessage(opts: {
  accountId: string;
  /** Requester phone, E.164 with + prefix. */
  phone: string;
  /** Profile/display name when the channel provides one. */
  name: string | null;
  body: string;
  channel: 'whatsapp';
  /** Pre-fetched channel media to store on the inbound message. */
  attachments?: IngestAttachment[];
}): Promise<{ ticketId: string; created: boolean }> {
  const { accountId, phone, name, body, channel, attachments = [] } = opts;

  const existing = await prisma.ticket.findFirst({
    where: { accountId, requesterPhone: phone, status: { not: 'closed' } },
    orderBy: { lastMessageAt: 'desc' },
  });

  if (existing) {
    const nextStatus = nextStatusOnMessage(existing.status as never, 'requester', false);
    await prisma.$transaction(async (tx) => {
      const m = await tx.ticketMessage.create({
        data: {
          id: newId('tmsg'),
          ticketId: existing.id,
          authorType: 'requester',
          authorName: name ?? phone,
          body,
        },
      });
      if (attachments.length > 0) {
        await createBoundAttachments(tx, { accountId, messageId: m.id, attachments });
      }
      await tx.ticket.update({
        where: { id: existing.id },
        data: { status: nextStatus, lastMessageAt: new Date() },
      });
      await writeOutbox(tx, {
        type: 'suppuo.ticket.replied.v1',
        accountId,
        aggregateId: existing.id,
        data: { ticketId: existing.id, messageId: m.id, isInternal: false, by: 'requester' },
      });
    });
    return { ticketId: existing.id, created: false };
  }

  const subject = (body.split('\n')[0] ?? '').slice(0, 120) || 'WhatsApp inquiry';
  const ticketId = newId('tkt');
  await prisma.$transaction(async (tx) => {
    const last = await tx.ticket.aggregate({
      where: { accountId },
      _max: { number: true },
    });
    const t = await tx.ticket.create({
      data: {
        id: ticketId,
        accountId,
        number: (last._max.number ?? 0) + 1,
        subject,
        channel,
        requesterEmail: null,
        requesterName: name,
        requesterPhone: phone,
        accessToken: generateAccessToken(),
      },
    });
    const m = await tx.ticketMessage.create({
      data: {
        id: newId('tmsg'),
        ticketId: t.id,
        authorType: 'requester',
        authorName: name ?? phone,
        body,
      },
    });
    if (attachments.length > 0) {
      await createBoundAttachments(tx, { accountId, messageId: m.id, attachments });
    }
    await writeOutbox(tx, {
      type: 'suppuo.ticket.created.v1',
      accountId,
      aggregateId: t.id,
      data: { ticketId: t.id, number: t.number, subject: t.subject, channel },
    });
  });
  return { ticketId, created: true };
}
