import type { ReactNode } from 'react';

// (public) — the requester-facing surfaces (hosted support form +
// tokenized ticket status). No auth, minimal chrome.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-12">
      {children}
      <p className="mt-10 text-center text-xs text-muted-foreground">
        Powered by <a href="/" className="font-semibold text-primary hover:underline">Suppuo</a> — helpdesk
        for Indonesian SMEs
      </p>
    </main>
  );
}
