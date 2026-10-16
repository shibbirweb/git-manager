// xterm needs concrete color strings, so the terminal reads the --term-* tokens from the computed style and reads
// them again whenever the theme changes (data-theme on <html>, or the system mode when it is not set).

/** The xterm theme keys the terminal sets, mirrored so this module does not import xterm. */
export const TERMINAL_THEME_TOKENS = {
  background: "--term-background",
  foreground: "--term-foreground",
  cursor: "--term-cursor",
  cursorAccent: "--term-background",
  selectionBackground: "--term-selection",
  selectionInactiveBackground: "--selected-inactive",
  scrollbarSliderBackground: "--term-scrollbar",
  scrollbarSliderHoverBackground: "--term-scrollbar-hover",
  scrollbarSliderActiveBackground: "--term-scrollbar-hover",
  black: "--term-black",
  red: "--term-red",
  green: "--term-green",
  yellow: "--term-yellow",
  blue: "--term-blue",
  magenta: "--term-magenta",
  cyan: "--term-cyan",
  white: "--term-white",
  brightBlack: "--term-bright-black",
  brightRed: "--term-bright-red",
  brightGreen: "--term-bright-green",
  brightYellow: "--term-bright-yellow",
  brightBlue: "--term-bright-blue",
  brightMagenta: "--term-bright-magenta",
  brightCyan: "--term-bright-cyan",
  brightWhite: "--term-bright-white",
} as const;

export type TerminalThemeKey = keyof typeof TERMINAL_THEME_TOKENS;
export type TerminalTheme = Partial<Record<TerminalThemeKey, string>>;

/** The theme from a token reader. A missing or empty token is left out, so xterm keeps its default. */
export function buildTerminalTheme(readToken: (token: string) => string | undefined): TerminalTheme {
  const theme: TerminalTheme = {};
  for (const [key, token] of Object.entries(TERMINAL_THEME_TOKENS) as [TerminalThemeKey, string][]) {
    const value = (readToken(token) ?? "").trim();
    if (value) {
      theme[key] = value;
    }
  }
  return theme;
}

/** The theme of an element's current colors. */
export function terminalThemeOf(element: Element): TerminalTheme {
  const style = getComputedStyle(element);
  return buildTerminalTheme((token) => style.getPropertyValue(token));
}

const THEME_ATTRIBUTES = ["data-theme", "data-color-theme", "data-contrast"];

/** Calls `onChange` after the light or dark mode or the color theme changed. Returns the stop function. */
export function watchTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(() => onChange());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: THEME_ATTRIBUTES });
  const media = window.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
  media?.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media?.removeEventListener("change", onChange);
  };
}
