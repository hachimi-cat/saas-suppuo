import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { sendOk } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';

/*
 * /api/v1/settings — workspace settings (behind requireAuth).
 *
 * Feature wave: CSAT + automation. v1 ships the automation section:
 * business hours (WIB-aware) + the inside/outside auto-response
 * templates. One AccountSettings row per workspace; absence = defaults
 * (automation off, no hours configured).
 */

const router = Router();

const DEFAULTS = {
  businessHours: null as unknown,
  autoResponseEnabled: false,
  autoResponseInside: null as string | null,
  autoResponseOutside: null as string | null,
  hideBranding: false,
};

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:mm');

const businessHoursSchema = z.object({
  tz: z.string().min(1).max(64),
  days: z
    .array(z.union([z.object({ dow: z.number().int().min(0).max(6), open: hhmm, close: hhmm }), z.null()]))
    .length(7),
});

const putBody = z.object({
  businessHours: businessHoursSchema.nullable().optional(),
  autoResponseEnabled: z.boolean().optional(),
  autoResponseInside: z.string().trim().max(5000).nullable().optional(),
  autoResponseOutside: z.string().trim().max(5000).nullable().optional(),
  /** Hide "Powered by Suppuo" in requester emails, the widget, and the
   *  public form/status pages. Paid-tier perk; unenforced in early
   *  access. */
  hideBranding: z.boolean().optional(),
});

function view(s: {
  businessHours: unknown;
  autoResponseEnabled: boolean;
  autoResponseInside: string | null;
  autoResponseOutside: string | null;
  hideBranding: boolean;
}) {
  return {
    businessHours: s.businessHours ?? null,
    autoResponseEnabled: s.autoResponseEnabled,
    autoResponseInside: s.autoResponseInside,
    autoResponseOutside: s.autoResponseOutside,
    hideBranding: s.hideBranding,
  };
}

router.get(
  '/automation',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const settings = await prisma.accountSettings.findUnique({ where: { accountId } });
    sendOk(res, req, view(settings ?? DEFAULTS));
  }),
);

router.put(
  '/automation',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const input = putBody.parse(req.body);

    const data: Record<string, unknown> = {};
    if (input.businessHours !== undefined) {
      // undefined = leave alone; explicit null = clear (Prisma needs
      // the DbNull sentinel to write SQL NULL into a Json? column).
      data.businessHours = input.businessHours === null ? Prisma.DbNull : input.businessHours;
    }
    if (input.autoResponseEnabled !== undefined) data.autoResponseEnabled = input.autoResponseEnabled;
    if (input.autoResponseInside !== undefined) {
      data.autoResponseInside = emptyToNull(input.autoResponseInside);
    }
    if (input.autoResponseOutside !== undefined) {
      data.autoResponseOutside = emptyToNull(input.autoResponseOutside);
    }
    if (input.hideBranding !== undefined) data.hideBranding = input.hideBranding;

    const saved = await prisma.accountSettings.upsert({
      where: { accountId },
      create: { accountId, ...data },
      update: data,
    });
    sendOk(res, req, view(saved));
  }),
);

function emptyToNull(v: string | null): string | null {
  return v === null || v === '' ? null : v;
}

// ─── Help-center config: public contact profile + product deep-links ──

const HELP_DEFAULTS = {
  contactEmail: null as string | null,
  contactPhone: null as string | null,
  contactAddress: null as string | null,
  docsUrl: null as string | null,
  contactUrl: null as string | null,
  helpIntro: null as string | null,
};

const urlOrEmpty = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'must be an http(s) URL');

const helpPutBody = z.object({
  contactEmail: z.string().trim().email().or(z.literal('')).nullable().optional(),
  contactPhone: z.string().trim().max(40).nullable().optional(),
  contactAddress: z.string().trim().max(500).nullable().optional(),
  docsUrl: urlOrEmpty.nullable().optional(),
  contactUrl: urlOrEmpty.nullable().optional(),
  helpIntro: z.string().trim().max(280).nullable().optional(),
});

function helpView(s: typeof HELP_DEFAULTS): typeof HELP_DEFAULTS {
  return {
    contactEmail: s.contactEmail ?? null,
    contactPhone: s.contactPhone ?? null,
    contactAddress: s.contactAddress ?? null,
    docsUrl: s.docsUrl ?? null,
    contactUrl: s.contactUrl ?? null,
    helpIntro: s.helpIntro ?? null,
  };
}

router.get(
  '/help',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const settings = await prisma.accountSettings.findUnique({ where: { accountId } });
    sendOk(res, req, helpView(settings ?? HELP_DEFAULTS));
  }),
);

router.put(
  '/help',
  asyncHandler(async (req, res) => {
    const accountId = req.auth!.accountId as string;
    const input = helpPutBody.parse(req.body);
    const data: Record<string, unknown> = {};
    for (const k of [
      'contactEmail',
      'contactPhone',
      'contactAddress',
      'docsUrl',
      'contactUrl',
      'helpIntro',
    ] as const) {
      if (input[k] !== undefined) data[k] = emptyToNull(input[k] ?? null);
    }
    const saved = await prisma.accountSettings.upsert({
      where: { accountId },
      create: { accountId, ...data },
      update: data,
    });
    sendOk(res, req, helpView(saved));
  }),
);

export default router;
