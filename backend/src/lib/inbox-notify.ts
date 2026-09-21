import { prisma } from './db.js';
import { sendInboxNotificationEmail } from './email.js';
import { shouldNotifyTeam } from './team-notify.js';

/** Email every known Suppuo member of a workspace when a customer adds
 *  something to the inbox. Memberships are the local, display-only SSO
 *  roster captured at sign-in; duplicate addresses are collapsed. */
export async function notifyInboxMembers(ev: {
  type: string;
  accountId: string | null;
  data: unknown;
}): Promise<void> {
  if (!ev.accountId || !shouldNotifyTeam(ev.type, ev.data)) return;

  const ticketId = (ev.data as { ticketId?: unknown } | null | undefined)?.ticketId;
  if (typeof ticketId !== 'string') return;

  const [ticket, memberships] = await Promise.all([
    prisma.ticket.findUnique({ where: { id: ticketId } }),
    prisma.rosterMembership.findMany({
      where: { accountId: ev.accountId },
      include: { identity: { select: { email: true } } },
    }),
  ]);
  if (!ticket) return;

  const recipients = [
    ...new Set(
      memberships
        .map((membership) => membership.identity.email.trim().toLowerCase())
        .filter((email) => email.includes('@')),
    ),
  ];
  if (recipients.length === 0) {
    console.warn('[inbox-notify] no known workspace members for', ev.accountId);
    return;
  }

  const requester =
    ticket.requesterName ??
    ticket.requesterEmail ??
    ticket.requesterPhone ??
    'Unknown requester';
  const kind = ev.type === 'suppuo.ticket.created.v1' ? 'created' : 'replied';

  await Promise.all(
    recipients.map((to) =>
      sendInboxNotificationEmail({
        accountId: ev.accountId!,
        to,
        kind,
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        subject: ticket.subject,
        requester,
      }),
    ),
  );
}
