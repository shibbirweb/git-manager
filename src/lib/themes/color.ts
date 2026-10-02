// Small color helpers for the theme catalog: parsing, mixing and WCAG
// contrast. Themes list a few base colors and the rest of the UI shades are
// derived with these, so every function works on CSS color strings.

export interface Rgba {
  /** 0 to 255 */
  r: number;
  g: number;
  b: number;
  /** 0 to 1 */
  a: number;
}

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

/** Reads #rgb, #rgba, #rrggbb, #rrggbbaa, rgb() and rgba(); anything else is null. */
export function parseColor(value: string): Rgba | null {
  const text = (value ?? "").trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(text);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      digits = [...digits].map((digit) => digit + digit).join("");
    }
    if (digits.length !== 6 && digits.length !== 8) {
      return null;
    }
    const channel = (index: number) => parseInt(digits.slice(index, index + 2), 16);
    return { r: channel(0), g: channel(2), b: channel(4), a: digits.length === 8 ? channel(6) / 255 : 1 };
  }
  const functional = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(text);
  if (functional) {
    const [, r, g, b, a] = functional;
    return {
      r: clampChannel(Number(r)),
      g: clampChannel(Number(g)),
      b: clampChannel(Number(b)),
      a: a === undefined ? 1 : Math.min(1, Math.max(0, Number(a))),
    };
  }
  return null;
}

function rgba(color: string): Rgba {
  return parseColor(color) ?? BLACK;
}

function hexOf(color: Rgba): string {
  return `#${[color.r, color.g, color.b].map((channel) => clampChannel(channel).toString(16).padStart(2, "0")).join("")}`;
}

/** The color as #rrggbb, dropping any alpha. */
export function toHex(color: string): string {
  return hexOf(rgba(color));
}

/** Mixes `weight` (0 to 1) of `other` into `color`; the result is opaque. */
export function mix(color: string, other: string, weight: number): string {
  const from = rgba(color);
  const to = rgba(other);
  const t = Math.min(1, Math.max(0, weight));
  return hexOf({ r: from.r + (to.r - from.r) * t, g: from.g + (to.g - from.g) * t, b: from.b + (to.b - from.b) * t, a: 1 });
}

/** The color at `alpha` opacity, as rgba(). */
export function withAlpha(color: string, alpha: number): string {
  const { r, g, b } = rgba(color);
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Paints a possibly translucent `color` over an opaque `background`; the result is opaque. */
export function composite(color: string, background: string): string {
  const top = rgba(color);
  return mix(background, hexOf(top), top.a);
}

function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque color. */
export function luminance(color: string): number {
  const { r, g, b } = rgba(color);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio, 1 to 21. Translucent colors are painted over `background` first. */
export function contrastRatio(color: string, background: string): number {
  const back = composite(background, "#ffffff");
  const lighter = luminance(composite(color, back));
  const darker = luminance(back);
  const [high, low] = lighter > darker ? [lighter, darker] : [darker, lighter];
  return (high + 0.05) / (low + 0.05);
}

/** A background dark enough that light text reads better on it. */
export function isDarkColor(color: string): boolean {
  return contrastRatio("#ffffff", color) > contrastRatio("#000000", color);
}

/**
 * Moves `color` toward black or white (whichever gets there first) until it
 * has at least `minimum` contrast with `background`. Small steps keep the hue
 * recognizable; a color that already passes comes back unchanged.
 */
export function ensureContrast(color: string, background: string, minimum: number): string {
  const start = composite(color, background);
  if (contrastRatio(start, background) >= minimum) {
    return color;
  }
  let best = start;
  for (let step = 1; step <= 50; step += 1) {
    const weight = step / 50;
    for (const target of ["#000000", "#ffffff"]) {
      const candidate = mix(start, target, weight);
      if (contrastRatio(candidate, background) >= minimum) {
        return candidate;
      }
      if (contrastRatio(candidate, background) > contrastRatio(best, background)) {
        best = candidate;
      }
    }
  }
  return best;
}

function labOf(color: string): [number, number, number] {
  const { r, g, b } = rgba(color);
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (value: number) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * CIE76 color difference of two colors painted over `background`. About 2.3
 * is just noticeable; diff tints need clearly more than that.
 */
export function colorDistance(color: string, other: string, background = "#ffffff"): number {
  const [l1, a1, b1] = labOf(composite(color, background));
  const [l2, a2, b2] = labOf(composite(other, background));
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * `color` at `alpha` over `background`, made fainter in small steps (down to a
 * third of `alpha`) until `text` keeps `minimum` contrast on it. Used for
 * derived tints (diff lines, list selection) that text is drawn on.
 */
export function fitTint(color: string, background: string, text: string, alpha: number, minimum: number): string {
  const floor = alpha / 3;
  let current = alpha;
  while (current > floor && contrastRatio(text, composite(withAlpha(color, current), background)) < minimum) {
    current = Math.max(floor, current - 0.01);
  }
  return withAlpha(color, current);
}
