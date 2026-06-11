'use client';

/*
 * Member avatar — tries the suppuo-local profile picture
 * (GET /api/v1/profile/avatar/:sub) and falls back to initials when
 * the member has none (404 → img onError → initials chip). Used by
 * the inbox assignee chip, the ticket detail assignee control and the
 * Settings "Your profile" preview.
 */

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';
import { initials } from '@/lib/members';

export function avatarUrl(sub: string): string {
  return apiUrl(`/profile/avatar/${encodeURIComponent(sub)}`);
}

export function Avatar({
  sub,
  nameOrEmail,
  size = 24,
  className = '',
  /** Bump to re-try the image after the viewer uploads/removes one. */
  version = 0,
}: {
  sub: string | null | undefined;
  nameOrEmail: string | null | undefined;
  size?: number;
  className?: string;
  version?: number;
}) {
  const [failed, setFailed] = useState(false);

  // A new sub (or a version bump after upload) deserves a fresh try.
  useEffect(() => {
    setFailed(false);
  }, [sub, version]);

  const dim = { width: size, height: size };

  if (!sub || failed) {
    return (
      <span
        title={nameOrEmail ?? undefined}
        style={dim}
        className={`flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ${className}`}
      >
        {initials(nameOrEmail)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={version > 0 ? `${avatarUrl(sub)}?v=${version}` : avatarUrl(sub)}
      alt={nameOrEmail ?? 'avatar'}
      title={nameOrEmail ?? undefined}
      style={dim}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}
