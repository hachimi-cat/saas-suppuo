import type { ChatAction } from '@forjio/agent-ui';
import { api } from '@/lib/api';

/**
 * The docked chat's Apply path (review mode) — executes a BFF-sanitized
 * ChatAction with the USER's own session via the same api-client calls
 * the dashboard pages use (the agent only ever proposed it). Ported
 * from linksnap's chat-actions.ts.
 *
 * Suppuo's two writable resources are flat — neither references the
 * other — so there is no `$n` cross-reference resolution here.
 */

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v ? v : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
/** Nullable pass-through: null clears, string sets, absent stays. */
const strOrNull = (v: unknown): string | null | undefined =>
  v === null ? null : typeof v === 'string' ? v : undefined;

/** Build a payload of only the fields the action actually set —
 *  omitted keys stay untouched on PATCH. */
function defined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export async function applyChatAction(action: ChatAction): Promise<unknown> {
  const f = action.fields ?? {};

  if (action.resource === 'help') {
    const payload = defined({
      kind: str(f.kind),
      slug: strOrNull(f.slug),
      category: strOrNull(f.category),
      title: str(f.title),
      body: str(f.body),
      status: str(f.status),
      position: num(f.position),
    });
    if (action.mode === 'edit') {
      const id = str(action.id);
      if (!id) throw new Error('Missing help article id');
      return (await api.patch(`/help/${encodeURIComponent(id)}`, payload)).data;
    }
    if (!payload.title || !payload.body) {
      throw new Error('A help article needs a title and a body');
    }
    return (await api.post('/help', payload)).data;
  }

  if (action.resource === 'canned-replies') {
    const payload = defined({ title: str(f.title), body: str(f.body) });
    if (action.mode === 'edit') {
      const id = str(action.id);
      if (!id) throw new Error('Missing canned reply id');
      return (await api.patch(`/canned-replies/${encodeURIComponent(id)}`, payload)).data;
    }
    if (!payload.title || !payload.body) {
      throw new Error('A canned reply needs a title and a body');
    }
    return (await api.post('/canned-replies', payload)).data;
  }

  throw new Error('This action type is not supported');
}
