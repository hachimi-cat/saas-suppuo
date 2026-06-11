import { prisma } from './db.js';

/** Does this workspace hide "Powered by Suppuo"? (Paid-tier perk;
 *  unenforced during early access.) Fail-open to branding shown. */
export async function accountHidesBranding(accountId: string): Promise<boolean> {
  try {
    const s = await prisma.accountSettings.findUnique({
      where: { accountId },
      select: { hideBranding: true },
    });
    return s?.hideBranding ?? false;
  } catch {
    return false;
  }
}
