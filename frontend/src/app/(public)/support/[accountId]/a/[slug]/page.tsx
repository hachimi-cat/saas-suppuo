'use client';

/*
 * Help-center article reader (/support/<accountId>/a/<slug>) — renders a
 * single published article from the public help API. Body is rendered as
 * pre-wrapped text in v1 (markdown rendering can layer in later).
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useSetHideBranding } from '@/components/public-branding';

interface Article {
  id: string;
  slug: string | null;
  category: string | null;
  title: string;
  body: string;
  updatedAt: string;
}

export default function ArticlePage({
  params,
}: {
  params: Promise<{ accountId: string; slug: string }>;
}) {
  const { accountId, slug } = use(params);
  const [article, setArticle] = useState<Article | null | undefined>(undefined);
  const setHideBranding = useSetHideBranding();

  useEffect(() => {
    // Pick up the workspace branding preference for the footer.
    apiRequest<{ hideBranding: boolean }>(`/public/widget-config?account=${accountId}`)
      .then(({ data }) => {
        if (data.hideBranding) setHideBranding(true);
      })
      .catch(() => undefined);
    apiRequest<{ article: Article | null }>(`/public/help/${accountId}/a/${slug}`)
      .then(({ data }) => setArticle(data.article))
      .catch(() => setArticle(null));
  }, [accountId, slug, setHideBranding]);

  if (article === undefined) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/support/${accountId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Help center
      </Link>
      {article === null ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">This article doesn’t exist (or isn’t published).</p>
        </div>
      ) : (
        <article className="mt-4">
          {article.category && (
            <p className="text-xs font-medium uppercase tracking-wide text-primary">{article.category}</p>
          )}
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{article.title}</h1>
          <div className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {article.body}
          </div>
        </article>
      )}
    </div>
  );
}
