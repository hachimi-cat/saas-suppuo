import { prisma } from './db.js';
import { newId } from './ids.js';
import { writeOutbox } from './outbox.js';
import { nextStatusOnMessage, generateAccessToken } from './ticket-flow.js';

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
}): Promise<{ ticketId: string; created: boolean }> {
  const { accountId, phone, name, body, channel } = opts;

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
    await tx.ticketMessage.create({
      data: {
        id: newId('tmsg'),
        ticketId: t.id,
        authorType: 'requester',
        authorName: name ?? phone,
        body,
      },
    });
    await writeOutbox(tx, {
      type: 'suppuo.ticket.created.v1',
      accountId,
      aggregateId: t.id,
      data: { ticketId: t.id, number: t.number, subject: t.subject, channel },
    });
  });
  return { ticketId, created: true };
}
