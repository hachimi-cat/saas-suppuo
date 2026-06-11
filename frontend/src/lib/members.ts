/**
 * Workspace members via the Huudis IAM proxy
 * (`GET /api/v1/huudis/iam/users` — see backend routes/huudis-proxy.ts).
 * The member `id` is the Huudis sub — the same value tickets store in
 * `assigneeSub`. Best-effort: callers degrade gracefully on failure.
 */

export interface Member {
  /** Huudis sub (usable as Ticket.assigneeSub). */
  id: string;
  email: string;
  name: string | null;
  role?: string;
  /** Set by Huudis on the caller's own row. */
  isYou?: boolean;
}

export async function fetchMembers(): Promise<Member[]> {
  const res = await fetch('/api/v1/huudis/iam/users', { credentials: 'include' });
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
  const raw = body?.data;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u): u is Record<string, unknown> => !!u && typeof u === 'object')
    .map((u) => ({
      id: String(u.id ?? ''),
      email: String(u.email ?? ''),
      name: typeof u.name === 'string' && u.name ? u.name : null,
      role: typeof u.role === 'string' ? u.role : undefined,
      isYou: u.isYou === true,
    }))
    .filter((m) => m.id);
}

/** "Naila Putri" → "NP"; falls back to the email's first two letters. */
export function initials(nameOrEmail: string | null | undefined): string {
  const s = (nameOrEmail ?? '').trim();
  if (!s) return '?';
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return s.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
}

/** Display label for an assignee sub given the member roster. */
export function memberLabel(sub: string | null | undefined, members: Member[]): string | null {
  if (!sub) return null;
  const m = members.find((x) => x.id === sub);
  return m ? (m.name ?? m.email) : sub;
}
