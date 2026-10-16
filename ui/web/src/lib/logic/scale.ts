// The named steps that props use instead of classes and colors: spacing, text tones and sizes. Each maps to a
// design token variable, so changing a token changes every component that uses the step.

export type Gap = "none" | "xxs" | "xs" | "sm" | "md" | "mdPlus" | "lg" | "lgPlus" | "xl" | "xxl" | "xxxl";
export type Tone = "default" | "dim" | "faint" | "accent" | "danger" | "success" | "warning";
export type TextSize =
  "micro" | "tiny" | "xsmall" | "compact" | "small" | "codeSmall" | "ui" | "code" | "title" | "heading" | "display";
export type Weight = "regular" | "medium" | "semibold" | "bold";

const GAP_TOKENS: Record<Gap, string> = {
  none: "0",
  xxs: "var(--space-1)",
  xs: "var(--space-2)",
  sm: "var(--space-3)",
  md: "var(--space-4)",
  mdPlus: "var(--space-5)",
  lg: "var(--space-6)",
  lgPlus: "var(--space-7)",
  xl: "var(--space-8)",
  xxl: "var(--space-11)",
  xxxl: "var(--space-12)",
};

const TONE_COLORS: Record<Tone, string> = {
  default: "var(--text)",
  dim: "var(--text-dim)",
  faint: "var(--text-faint)",
  accent: "var(--accent)",
  danger: "var(--danger)",
  success: "var(--success)",
  warning: "var(--warning)",
};

export function gapValue(gap: Gap): string {
  return GAP_TOKENS[gap];
}

export function toneColor(tone: Tone): string {
  return TONE_COLORS[tone];
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function fontSize(size: TextSize): string {
  return `var(--font-size-${kebab(size)})`;
}

/** The CSS variable of one part of a text style, e.g. textStyleVar("sectionLabel", "size"). */
export function textStyleVar(
  style: string,
  part: "family" | "size" | "weight" | "line-height" | "letter-spacing" | "transform",
): string {
  return `var(--text-${kebab(style)}-${part})`;
}

export function fontWeight(weight: Weight): string {
  return `var(--font-weight-${weight})`;
}
