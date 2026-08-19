import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The docked assistant's chrome, held as tests (ripllo's Phase 5 pass,
 * e919d93 there, ported 2026-08-19). suppuo's docked-chat.tsx was copied
 * from linksnap verbatim, which carried two defects here — none of which
 * type-checks:
 *
 * - `avatarUrl="/apple-touch-icon.png"` pointed at a file suppuo never
 *   shipped (linksnap ships one), so every assistant reply rendered the
 *   browser's broken-image glyph — /apple-touch-icon.png was a live 404
 *   on prod. Next serves public/ verbatim and nothing else checks the
 *   path. The iOS home-screen link ships separately as
 *   src/app/apple-icon.png (the file convention, NOT metadata.icons —
 *   which on Next 15.5 suppresses the convention's rel="icon" link).
 * - The dock's insets are meant to mirror <main>'s padding so the pill
 *   lines up with the page content. linksnap's shell steps at `sm:`;
 *   suppuo's dashboard-shell steps at `md:` — the copied `sm:inset-x-6`
 *   sat 8px inside the content between 640 and 767px. Same reason
 *   `pb-52` needs the variant at the SAME breakpoint: `md:p-6` sets
 *   padding-bottom too and emits after a bare `pb-52`, so without
 *   `md:pb-52` the reservation silently disappears at ≥768px.
 * - No `suggestions` → no starter chips at all. bang asked for a
 *   greeting and three ways in (2026-08-08); the package renders chips
 *   only when the product passes them.
 *
 * (ripllo's glyph case is dropped: suppuo's LogoMark is already a bare
 * currentColor glyph on lucide's 24-box — exactly what the dock's brand
 * circle expects — so there was nothing to fix.)
 */

const FRONTEND = resolve(__dirname, '../../../frontend');
const PUBLIC = resolve(FRONTEND, 'public');
const DOCKED = resolve(FRONTEND, 'src/components/catentio/docked-chat.tsx');
const SHELL = resolve(FRONTEND, 'src/components/dashboard-shell.tsx');
const LAYOUT = resolve(FRONTEND, 'src/app/layout.tsx');

const read = (p: string) => readFileSync(p, 'utf8');
/** A "/foo.png" public URL → does frontend/public/foo.png exist? */
const servedFromPublic = (url: string) => /^\/[^/]/.test(url) && existsSync(resolve(PUBLIC, `.${url}`));

describe('the docked assistant chrome', () => {
  it('CONTROL — the frontend tree is where this test thinks it is', () => {
    for (const f of [DOCKED, SHELL, LAYOUT]) expect(existsSync(f), f).toBe(true);
    // and the public resolver is real: a never-shipped file is NOT found
    expect(servedFromPublic('/zzz-never-shipped.png')).toBe(false);
    expect(servedFromPublic('/logo.svg')).toBe(true);
  });

  it('the assistant avatar is a file public/ actually serves', () => {
    const src = read(DOCKED);
    const m = src.match(/avatarUrl="([^"]+)"/);
    expect(m, 'avatarUrl is set on <DockedChat>').not.toBeNull();
    expect(servedFromPublic(m![1]!), `${m![1]} must exist under frontend/public`).toBe(true);
  });

  it('the apple icon rides the file convention beside the tab favicon, and metadata declares no icons', () => {
    // Both icons ride the Next file convention: src/app/icon.svg (the
    // tab favicon, pre-existing) and src/app/apple-icon.png (added
    // 2026-08-19) — Next emits both <link>s itself. Declaring ANY
    // metadata.icons in layout.tsx instead SUPPRESSES the convention
    // links on Next 15.5: proven locally — `icons: { apple: … }` alone
    // made rel="icon" vanish from every prerendered page.
    expect(existsSync(resolve(FRONTEND, 'src/app/icon.svg'))).toBe(true);
    expect(existsSync(resolve(FRONTEND, 'src/app/apple-icon.png'))).toBe(true);
    expect(read(LAYOUT)).not.toMatch(/\bicons:/);
  });

  it("the dock's insets step at the same breakpoint as <main>'s padding, and the reserve carries that variant", () => {
    const shell = read(SHELL);
    const main = shell.match(/<main\s+className=\{`([^`]*)`/);
    expect(main, '<main className={`…`}> found').not.toBeNull();
    const padStep = main![1]!.match(/\b(sm|md|lg):p-6\b/);
    expect(padStep, 'main pads p-4 then <bp>:p-6').not.toBeNull();
    const bp = padStep![1]!;
    // the reserve must be re-asserted at that same breakpoint
    expect(main![1], `pb-52 must be re-asserted as ${bp}:pb-52 (\`${bp}:p-6\` overrides a bare pb-52)`).toMatch(new RegExp(`\\bpb-52 ${bp}:pb-52\\b`));

    const dock = read(DOCKED);
    // resting: 'absolute inset-x-4 bottom-4 … <bp>:inset-x-6 <bp>:bottom-6'
    const resting = dock.match(/'absolute inset-x-4 bottom-4 [^']*'/);
    expect(resting, 'resting dock class string found').not.toBeNull();
    expect(resting![0]).toContain(`${bp}:inset-x-6`);
    expect(resting![0]).toContain(`${bp}:bottom-6`);
    // expanded: 'fixed inset-0 … <bp>:absolute <bp>:inset-x-6 <bp>:bottom-6 <bp>:top-6'
    const expanded = dock.match(/'fixed inset-0 [^']*'/);
    expect(expanded, 'expanded dock class string found').not.toBeNull();
    for (const t of ['absolute', 'inset-x-6', 'bottom-6', 'top-6']) expect(expanded![0]).toContain(`${bp}:${t}`);
    // and no OTHER breakpoint prefix sneaks into either string
    const others = ['sm', 'md', 'lg'].filter((x) => x !== bp);
    for (const o of others) {
      expect(resting![0]).not.toMatch(new RegExp(`\\b${o}:`));
      expect(expanded![0]).not.toMatch(new RegExp(`\\b${o}:`));
    }
  });

  it('a new session offers three starter chips', () => {
    const dock = read(DOCKED);
    const m = dock.match(/suggestions=\{\[([\s\S]*?)\]\}/);
    expect(m, 'suggestions={[…]} passed to <DockedChat>').not.toBeNull();
    const chips = [...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!.trim()).filter(Boolean);
    expect(chips).toHaveLength(3);
    for (const c of chips) expect(c.length).toBeGreaterThan(12);
  });
});
