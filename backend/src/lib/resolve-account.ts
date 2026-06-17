import { prisma } from './db.js';

/*
 * A public "handle" in a URL or request is EITHER a raw Huudis account id
 * (acc_…) OR a workspace's readable slug (suppuo.com/portal/<slug>).
 * resolveAccountId() maps a handle to the real accountId so the public
 * surfaces accept both — old acc-id links keep working, new slug links
 * resolve. Returns null when a slug doesn't match any workspace.
 */

export const ACCOUNT_ID_RE = /^acc_[0-9A-Za-z]{24,28}$/;

export async function resolveAccountId(handle: string): Promise<string | null> {
  if (!handle) return null;
  if (ACCOUNT_ID_RE.test(handle)) return handle;
  const s = await prisma.accountSettings.findUnique({
    where: { slug: handle.toLowerCase() },
    select: { accountId: true },
  });
  return s?.accountId ?? null;
}
