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
});

function view(s: {
  businessHours: unknown;
  autoResponseEnabled: boolean;
  autoResponseInside: string | null;
  autoResponseOutside: string | null;
}) {
  return {
    businessHours: s.businessHours ?? null,
    autoResponseEnabled: s.autoResponseEnabled,
    autoResponseInside: s.autoResponseInside,
    autoResponseOutside: s.autoResponseOutside,
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

export default router;
