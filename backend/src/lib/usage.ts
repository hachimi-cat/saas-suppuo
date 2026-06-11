import { prisma } from './db.js';
import { newId } from './ids.js';

/*
 * Usage metering — v1 counts outbound platform-WhatsApp messages so
 * the tier quotas (Warung 500 / Toko 1.500 / Bisnis 4.000 per month)
 * are countable before the shared number goes live. BYO traffic
 * (customer's own Twilio / Meta Cloud) is never metered — it's their
 * provider bill. Counting only; enforcement comes at launch.
 */

export const WA_PLATFORM_OUT = 'wa_platform_out';

/** Billing period key 'YYYY-MM' — month boundaries in WIB
 *  (Asia/Jakarta), matching the business-hours timezone. */
export function currentPeriod(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}

/** Atomic increment for (account, period, metric). Fire-and-forget at
 *  call sites — a metering failure must never fail a send. */
export async function incrementUsage(
  accountId: string,
  metric: string,
  by = 1,
  now: Date = new Date(),
): Promise<void> {
  const period = currentPeriod(now);
  await prisma.channelUsage.upsert({
    where: { accountId_period_metric: { accountId, period, metric } },
    create: { id: newId('usg'), accountId, period, metric, count: by },
    update: { count: { increment: by } },
  });
}

export async function getUsage(
  accountId: string,
  metric: string,
  now: Date = new Date(),
): Promise<{ period: string; count: number }> {
  const period = currentPeriod(now);
  const row = await prisma.channelUsage.findUnique({
    where: { accountId_period_metric: { accountId, period, metric } },
  });
  return { period, count: row?.count ?? 0 };
}

/** Meter a WhatsApp send IF it went over the shared platform number.
 *  Shape-matches `resolveWhatsAppForAccount` results: only the Twilio
 *  kind can be platform (`byo: false`); cloud is always BYO. */
export function meterWhatsAppSend(
  accountId: string,
  ch: { kind: 'twilio' | 'cloud'; byo?: boolean },
): void {
  if (ch.kind !== 'twilio' || ch.byo) return;
  void incrementUsage(accountId, WA_PLATFORM_OUT).catch((e) =>
    console.error('[usage] wa metering failed', accountId, e),
  );
}
