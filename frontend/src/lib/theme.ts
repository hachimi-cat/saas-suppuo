/*
 * Per-workspace public theming for Suppuo's customer surfaces (the
 * hosted help center + the customer ticket portal). Ported verbatim from
 * the serront storefront theme helper — self-contained, no cross-product
 * imports. A workspace's accent + brand colors derive a scoped set of
 * shadcn CSS-var triplets that are spread onto a wrapper element's
 * `style`, theming only THAT public subtree (the seller dashboard never
 * mounts these, so it keeps the default Suppuo palette).
 */

/** HSL components in the units the CSS token uses: hue 0..360, sat/lum
 *  as PERCENTAGES (0..100). */
export interface HslParts {
  h: number;
  s: number;
  l: number;
}

/**
 * Parse a `#RRGGBB` hex into {h, s, l} (hue 0..360, sat/lum 0..100).
 * Returns null on a malformed input so callers can fall back to the
 * default token.
 */
export function hexToHslParts(hex: string | null | undefined): HslParts | null {
  if (!hex) return null;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 0xff) / 255;
  const g = ((int >> 8) & 0xff) / 255;
  const b = (int & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/** Return a copy of `parts` with lightness shifted by `deltaL`
 *  percentage points (clamped 0..100). Used to derive a small dark
 *  palette of slightly-lighter surfaces from a brand background. */
export function lighten(parts: HslParts, deltaL: number): HslParts {
  return { ...parts, l: Math.min(100, Math.max(0, parts.l + deltaL)) };
}

/** Format {h, s, l} as the Tailwind/shadcn CSS-token triplet
 *  `"H S% L%"` that `hsl(var(--token))` wraps. */
export function hslPartsToTriplet({ h, s, l }: HslParts): string {
  return `${h} ${s}% ${l}%`;
}

/**
 * Convert a `#RRGGBB` hex to the Tailwind/shadcn CSS-token triplet
 * `"H S% L%"` (the exact shape globals.css uses for `--primary`/`--ring`,
 * which `hsl(var(--primary))` then wraps). Returns null on a malformed
 * input so callers can fall back to the default token.
 */
export function hexToHslTriplet(hex: string | null | undefined): string | null {
  const parts = hexToHslParts(hex);
  return parts ? hslPartsToTriplet(parts) : null;
}

/**
 * Build the scoped CSS-var map for the public theme from a workspace's
 * accent + brand colors. Returns a plain record of `--token → "H S% L%"`
 * triplets (empty when neither is set), to spread into a wrapper
 * element's `style`.
 *
 * Accent → `--primary` / `--ring` (buttons/links/highlights).
 * Brand (background) → a derived small palette:
 *   --background = brand
 *   --card / --popover / --secondary = brand ±5% L (slightly contrasting
 *       surface for cards)
 *   --muted   = brand ±9% L
 *   --border / --input = brand ±13% L
 * Foreground tokens ARE derived here from the brand luminance — unlike
 * serront (whose BASE theme is already dark), Suppuo's base is a LIGHT
 * theme (dark text), so a dark brand background must flip the text to
 * light or it renders dark-on-dark. We pick light vs dark foregrounds
 * for guaranteed contrast against the chosen brand.
 */
export function storefrontThemeVars(
  accentColor: string | null | undefined,
  brandColor: string | null | undefined,
): Record<string, string> {
  const vars: Record<string, string> = {};

  const accent = hexToHslParts(accentColor);
  if (accent) {
    vars['--primary'] = hslPartsToTriplet(accent);
    vars['--ring'] = hslPartsToTriplet(accent);
    // Text/icon color that sits ON the accent (button labels): dark on a
    // light accent, white on a dark/saturated one.
    vars['--primary-foreground'] = accent.l > 62 ? `${accent.h} 45% 12%` : '0 0% 100%';
  }

  const brand = hexToHslParts(brandColor);
  if (brand) {
    const dark = brand.l < 55;
    // Surfaces step AWAY from the background (lighter on dark, darker on
    // light) so cards/borders separate either way.
    const step = (d: number) => hslPartsToTriplet(lighten(brand, dark ? d : -d));
    vars['--background'] = hslPartsToTriplet(brand);
    vars['--card'] = step(5);
    vars['--popover'] = step(5);
    vars['--secondary'] = step(5);
    vars['--muted'] = step(9);
    vars['--border'] = step(13);
    vars['--input'] = step(13);

    // Foregrounds — flip to contrast the brand background.
    const fg = dark ? `${brand.h} 25% 96%` : `${brand.h} 32% 12%`;
    const mutedFg = dark ? `${brand.h} 16% 70%` : `${brand.h} 14% 40%`;
    for (const t of [
      '--foreground',
      '--card-foreground',
      '--popover-foreground',
      '--secondary-foreground',
      '--accent-foreground',
    ]) {
      vars[t] = fg;
    }
    vars['--muted-foreground'] = mutedFg;
  }

  return vars;
}

/** Public per-workspace branding — mirrors the backend
 *  GET /public/help/<acc>/branding shape (and bundle.branding). */
export interface PublicBranding {
  name: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  brandColor: string | null;
  hideBranding: boolean;
}

export const EMPTY_BRANDING: PublicBranding = {
  name: null,
  logoUrl: null,
  accentColor: null,
  brandColor: null,
  hideBranding: false,
};
