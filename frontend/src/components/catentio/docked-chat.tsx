'use client';

import { useCallback, useMemo, useState } from 'react';
import { LogoMark } from '@/components/brand/logo';
import { DockedChat, createBffChatAdapters, type ChatAction } from '@forjio/agent-ui';
import { catentioHttp } from '@/lib/catentio-http';
import { applyChatAction } from '@/components/catentio/chat-actions';
import { useCatentioStatus, ASSISTANT_ACTIVITY_EVENT } from '@/hooks/use-catentio';
import { ApiRequestError } from '@/lib/api';

/**
 * The docked product chat — suppuo's mount of the embedded agent layer
 * (linksnap's docked-chat.tsx is the reference). Renders nothing unless
 * the catentio pilot flag is on for this account (the backend re-checks
 * on every call regardless). Docked bottom-right: resting, only the
 * composer bar shows; focus/submit grows the panel in place.
 */
export function CatentioDockedChat() {
  const { enabled } = useCatentioStatus();
  const [open, setOpen] = useState(false);
  // ONE adapter set per mount — an inline object per render would
  // restart the package's poll/save machinery.
  const adapters = useMemo(
    () => createBffChatAdapters(catentioHttp, { activityEventName: ASSISTANT_ACTIVITY_EVENT }),
    [],
  );

  // The chat's Apply path (review mode): the agent PROPOSED the card,
  // this executes it with the user's own session via the same
  // api-client calls the dashboard pages use (chat-actions.ts).
  const onApplyAction = useCallback(async (action: ChatAction) => {
    try {
      return await applyChatAction(action);
    } catch (err) {
      // Surface what the SERVER said — a bare "Request failed" hides
      // the exact rejection the user needs to see on the card.
      throw new Error(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : 'That change could not be applied',
      );
    }
  }, []);

  if (!enabled) return null;

  // Insets mirror <main>'s padding so the dock lines up with the page
  // content (linksnap's layout decision, 2026-08-05). suppuo's shell
  // pads `p-4 md:p-6` (dashboard-shell.tsx), so the step is at `md:`
  // here — copying linksnap's `sm:` verbatim left the dock 8px inside
  // the content between 640 and 767px. Expanded: full SCREEN below md
  // (fixed inset-0 over everything), full column height above it at
  // the same content width.
  return (
    <div
      className={
        open
          ? 'fixed inset-0 z-50 flex flex-col md:absolute md:inset-x-6 md:bottom-6 md:top-6 md:z-40 md:mx-auto md:max-w-4xl'
          : 'absolute inset-x-4 bottom-4 z-40 mx-auto flex max-w-4xl flex-col md:inset-x-6 md:bottom-6'
      }
    >
      <DockedChat
        adapters={adapters}
        product="suppuo"
        open={open}
        onOpenChange={setOpen}
        title="Suppuo Assistant"
        // The assistant's bubble avatar. Served from public/ — until
        // 2026-08-19 this pointed at a file suppuo never shipped (the
        // value was copied from linksnap, which ships one), and every
        // reply carried the browser's broken-image glyph.
        avatarUrl="/apple-touch-icon.png"
        // The detached circle left of the resting dock, on the product's
        // primary fill (bang, 2026-08-06). A life ring is suppuo's
        // support mark — LogoMark is already a bare currentColor glyph
        // on lucide's 24-box, exactly what this slot expects.
        brandIcon={<LogoMark />}
        // Starter prompts on a new session (bang, 2026-08-08: a greeting
        // and three ways in). Phrased as the support team talking, not as
        // menu items, and drawn from what the agent can actually finish
        // here: help-centre articles/FAQs and canned replies (created as
        // drafts), plus listing them. Tickets, channels and reports are
        // refused at the auth layer — no chip may open on a refusal.
        // Clicking SENDS.
        suggestions={[
          'Draft a FAQ explaining our refund policy',
          'Write a canned reply for delayed-order apologies',
          'Show me my help centre articles and their status',
        ]}
        onApplyAction={onApplyAction}
      />
    </div>
  );
}
