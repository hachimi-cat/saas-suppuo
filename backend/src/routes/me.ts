import { Router } from 'express';
import { sendOk } from '../lib/http.js';
import { h as asyncHandler } from '../lib/async-handler.js';

// GET /api/v1/me — the caller's RESOLVED identity: accountId is
// override-aware (the workspace switcher cookie), unlike the sdk's
// /auth/me which reports the session's default. Portal pages that need
// the active workspace id (settings form URL, etc.) read this.

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    sendOk(res, req, {
      sub: req.auth!.sub,
      accountId: req.auth!.accountId,
    });
  }),
);

export default router;
