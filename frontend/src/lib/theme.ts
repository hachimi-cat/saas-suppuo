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
 * Brand (navy/background) → a derived small DARK palette:
 *   --background = brand
 *   --card / --popover / --secondary = brand +5% L (slightly lighter
 *       navy for surfaces/cards)
 *   --muted   = brand +9% L
 *   --border / --input = brand +13% L
 * Foreground tokens are intentionally NOT overridden — globals.css
 * keeps them light (near-white), which reads on a dark brand like navy.
 */
export function storefrontThemeVars(
  accentColor: string | null | undefined,
  brandColor: string | null | undefined,
): Record<string, string> {
  const vars: Record<string, string> = {};

  const accent = hexToHslTriplet(accentColor);
  if (accent) {
    vars['--primary'] = accent;
    vars['--ring'] = accent;
  }

  const brand = hexToHslParts(brandColor);
  if (brand) {
    const surface = hslPartsToTriplet(lighten(brand, 5));
    vars['--background'] = hslPartsToTriplet(brand);
    vars['--card'] = surface;
    vars['--popover'] = surface;
    vars['--secondary'] = surface;
    vars['--muted'] = hslPartsToTriplet(lighten(brand, 9));
    vars['--border'] = hslPartsToTriplet(lighten(brand, 13));
    vars['--input'] = hslPartsToTriplet(lighten(brand, 13));
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
