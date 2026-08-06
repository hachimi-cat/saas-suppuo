import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Shared dashboard page header — single source of truth for page-title
 * layout so every portal page matches. Title + optional description on
 * the left, optional action cluster on the right.
 *
 * Phone: icon, title, subtitle and each action stack — one per row,
 * actions full-width. sm+ restores the classic title-left/action-right
 * line. Pass multiple actions as siblings (a fragment), not wrapped in
 * your own flex div, so each one gets its own row on phones.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start">
      {Icon && (
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon size={18} strokeWidth={2} />
        </span>
      )}
      <div className="min-w-0 sm:flex-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {action && (
        <div className="flex flex-col items-stretch gap-2 max-sm:[&>*]:justify-center sm:flex-row sm:items-center sm:shrink-0">
          {action}
        </div>
      )}
    </header>
  );
}
