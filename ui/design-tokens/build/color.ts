// Color strings of the token files (#rrggbb or rgba(r, g, b, a)) as numbers for the native writers.

export interface Rgba {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export function parseTokenColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (hex) {
    return { red: parseInt(hex[1], 16), green: parseInt(hex[2], 16), blue: parseInt(hex[3], 16), alpha: 1 };
  }
  const rgba = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/.exec(value);
  if (rgba) {
    return { red: Number(rgba[1]), green: Number(rgba[2]), blue: Number(rgba[3]), alpha: Number(rgba[4] ?? 1) };
  }
  throw new Error(`Not a token color: ${value}`);
}

function hexByte(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0").toUpperCase();
}

/** #AARRGGBB, the XAML form. */
export function argbHex(color: Rgba): string {
  return `#${hexByte(color.alpha * 255)}${hexByte(color.red)}${hexByte(color.green)}${hexByte(color.blue)}`;
}

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  color: Rgba;
}

/** `0 8px 28px rgba(0, 0, 0, 0.16)` as numbers. */
export function parseShadow(value: string): Shadow {
  const match = /^(-?\d+)(?:px)?\s+(-?\d+)(?:px)?\s+(\d+)(?:px)?\s+(.+)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Not a shadow: ${value}`);
  }
  return { x: Number(match[1]), y: Number(match[2]), blur: Number(match[3]), color: parseTokenColor(match[4]) };
}
