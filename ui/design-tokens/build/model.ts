// The design tokens as one model: colors (light and dark), base tokens and component tokens, with "{group.name}"
// references resolved. Every platform writer (css.ts, swift.ts, xaml.ts, gtk.ts) reads this model only.
import colorsJson from "../colors.json";
import componentsJson from "../components.json";
import moreComponentsJson from "../components-2.json";
import paletteJson from "../palette.json";
import tokensJson from "../tokens.json";
import typographyJson from "../typography.json";

export type Mode = "light" | "dark";
export type Themed = Record<Mode, string>;
export type Scalar = number | string;

export interface Reference {
  group: string;
  name: string;
}

/** A named text style; sizes and weights resolved to numbers. */
export interface TextStyle {
  font: string;
  size: number;
  weight: number;
  /** A multiple of the size; null for the platform's normal line height. */
  lineHeight: number | null;
  /** In em; 0 for none. */
  letterSpacing: number;
  uppercase: boolean;
  /** A Text tone (`dim`, `faint`...) or null for the normal text color. */
  tone: string | null;
}

export interface Tokens {
  colors: Record<string, Themed>;
  shadows: Record<string, Themed>;
  fonts: Record<string, string[]>;
  /** Number groups: fontSize, fontWeight, lineHeight, letterSpacing, size, radius, space, motion, breakpoint, grid. */
  scales: Record<string, Record<string, number>>;
  textStyles: Record<string, TextStyle>;
  /** Fixed color sets, the same in light and dark (palette.json). */
  palettes: Record<string, string[]>;
  /** component -> part -> a number, or a reference to a scale token. */
  components: Record<string, Record<string, number | Reference>>;
}

export const SCALES = [
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "size",
  "radius",
  "space",
  "borderWidth",
  "motion",
  "breakpoint",
  "grid",
  "iconSize",
  "iconStroke",
  "controlWidth",
  "popoverWidth",
  "dialogWidth",
  "viewHeight",
  "columnWidth",
  "rowHeight",
  "textRows",
  "panelMin",
  "panelDefault",
  "codeHeight",
  "tableColumn",
  "labelColumn",
];

function withoutComment<T extends object>(json: T): Omit<T, "$comment"> {
  const { $comment: _comment, ...rest } = json as T & { $comment?: unknown };
  return rest;
}

export function parseReference(value: Scalar): Reference | null {
  const match = typeof value === "string" ? /^\{([a-zA-Z]+)\.([a-zA-Z0-9]+)\}$/.exec(value) : null;
  return match ? { group: match[1], name: match[2] } : null;
}

function textStyles(
  styles: Record<string, Record<string, unknown>>,
  scales: Tokens["scales"],
): Record<string, TextStyle> {
  const number = (style: string, part: string, value: unknown, fallback: number | null): number | null => {
    if (value === undefined) {
      return fallback;
    }
    const reference = parseReference(value as Scalar);
    const found = reference ? scales[reference.group]?.[reference.name] : undefined;
    if (found === undefined) {
      throw new Error(`textStyle.${style}.${part}: ${String(value)} refers to a token that does not exist`);
    }
    return found;
  };
  const result: Record<string, TextStyle> = {};
  for (const [name, style] of Object.entries(styles)) {
    result[name] = {
      font: String(style.font ?? "ui"),
      size: number(name, "size", style.size, null) ?? 13,
      weight: number(name, "weight", style.weight, null) ?? 400,
      lineHeight: number(name, "lineHeight", style.lineHeight, null),
      letterSpacing: number(name, "letterSpacing", style.letterSpacing, 0) ?? 0,
      uppercase: style.uppercase === true,
      tone: typeof style.tone === "string" ? style.tone : null,
    };
  }
  return result;
}

export function buildTokens(
  colors: object,
  tokens: object,
  components: object,
  typography: object = {},
  palette: object = {},
): Tokens {
  const base = {
    ...(withoutComment(tokens) as Record<string, Record<string, unknown>>),
    ...(withoutComment(typography) as Record<string, Record<string, unknown>>),
  };
  const scales: Tokens["scales"] = {};
  for (const scale of SCALES) {
    scales[scale] = (base[scale] ?? {}) as Record<string, number>;
  }
  const parts: Tokens["components"] = {};
  const componentTokens = withoutComment(components) as Record<string, Record<string, Scalar>>;
  for (const [component, values] of Object.entries(componentTokens)) {
    parts[component] = {};
    for (const [part, value] of Object.entries(values)) {
      const reference = parseReference(value);
      if (typeof value === "string" && !reference) {
        throw new Error(`${component}.${part}: "${value}" is neither a number nor a {group.name} reference`);
      }
      if (reference && scales[reference.group]?.[reference.name] === undefined) {
        throw new Error(`${component}.${part}: ${value} refers to a token that does not exist`);
      }
      parts[component][part] = reference ?? (value as number);
    }
  }
  return {
    colors: withoutComment(colors) as Record<string, Themed>,
    shadows: (base.shadow ?? {}) as Record<string, Themed>,
    fonts: (base.font ?? {}) as Record<string, string[]>,
    scales,
    textStyles: textStyles((base.textStyle ?? {}) as Record<string, Record<string, unknown>>, scales),
    palettes: withoutComment(palette) as Record<string, string[]>,
    components: parts,
  };
}

/** components.json and components-2.json together (one file would pass 300 lines). */
export const componentsSource = { ...componentsJson, ...moreComponentsJson, $comment: componentsJson.$comment };

export const designTokens: Tokens = buildTokens(
  colorsJson,
  tokensJson,
  componentsSource,
  typographyJson,
  paletteJson,
);

/** A component part's number, following its reference. */
export function resolved(tokens: Tokens, value: number | Reference): number {
  return typeof value === "number" ? value : tokens.scales[value.group][value.name];
}

/** `panel-alt` -> `panelAlt`, `1` -> `s1` (names must not start with a digit on native platforms). */
export function camelName(name: string): string {
  const camel = name.replace(/-([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
  return /^[0-9]/.test(camel) ? `s${camel}` : camel;
}

/** `panelAlt` -> `panel-alt`, for CSS. */
export function kebabName(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function pascalName(name: string): string {
  const camel = camelName(name);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}
