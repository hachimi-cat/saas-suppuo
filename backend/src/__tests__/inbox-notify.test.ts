import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findTicket: vi.fn(),
  findMemberships: vi.fn(),
  sendInboxNotificationEmail: vi.fn(async () => undefined),
}));

vi.mock('../lib/db.js', () => ({
  prisma: {
    ticket: { findUnique: mocks.findTicket },
    rosterMembership: { findMany: mocks.findMemberships },
  },
}));

vi.mock('../lib/email.js', () => ({
  sendInboxNotificationEmail: mocks.sendInboxNotificationEmail,
}));

const { notifyInboxMembers } = await import('../lib/inbox-notify.js');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findTicket.mockResolvedValue({
    id: 'tkt_1',
    accountId: 'acc_1',
    number: 42,
    subject: 'Order never arrived',
    requesterName: 'Budi',
    requesterEmail: 'budi@example.com',
    requesterPhone: null,
  });
  mocks.findMemberships.mockResolvedValue([
    { identity: { email: 'Owner@Example.com' } },
    { identity: { email: 'agent@example.com' } },
    { identity: { email: 'owner@example.com' } },
  ]);
});

describe('workspace inbox email notifications', () => {
  it('emails every unique workspace member when a ticket is created', async () => {
    await notifyInboxMembers({
      type: 'suppuo.ticket.created.v1',
      accountId: 'acc_1',
      data: { ticketId: 'tkt_1' },
    });

    expect(mocks.sendInboxNotificationEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendInboxNotificationEmail).toHaveBeenCalledWith({
      accountId: 'acc_1',
      to: 'owner@example.com',
      kind: 'created',
      ticketId: 'tkt_1',
      ticketNumber: 42,
      subject: 'Order never arrived',
      requester: 'Budi',
    });
    expect(mocks.sendInboxNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'agent@example.com' }),
    );
  });

  it('emails members for customer replies but ignores agent replies and internal notes', async () => {
    await notifyInboxMembers({
      type: 'suppuo.ticket.replied.v1',
      accountId: 'acc_1',
      data: { ticketId: 'tkt_1', by: 'requester', isInternal: false },
    });
    expect(mocks.sendInboxNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'replied' }),
    );

    vi.clearAllMocks();
    await notifyInboxMembers({
      type: 'suppuo.ticket.replied.v1',
      accountId: 'acc_1',
      data: { ticketId: 'tkt_1', by: 'agent', isInternal: false },
    });
    await notifyInboxMembers({
      type: 'suppuo.ticket.replied.v1',
      accountId: 'acc_1',
      data: { ticketId: 'tkt_1', by: 'requester', isInternal: true },
    });
    expect(mocks.findTicket).not.toHaveBeenCalled();
    expect(mocks.sendInboxNotificationEmail).not.toHaveBeenCalled();
  });
});
