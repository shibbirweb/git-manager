// Terminal colors come from the CSS tokens in src/app.css, so the terminal
// follows the light and dark themes like the editors do. xterm needs concrete
// color strings, so the tokens are read from the computed style and read again
// whenever the theme changes.

/** The xterm ITheme keys we set, mirrored here so this module does not import xterm. */
export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionInactiveBackground: string;
  scrollbarSliderBackground: string;
  scrollbarSliderHoverBackground: string;
  scrollbarSliderActiveBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

/** Theme key and the CSS token it reads. */
export const THEME_TOKENS: Record<keyof TerminalTheme, string> = {
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
};

/**
 * Builds the theme from a token reader. A token that is missing or empty is
 * left out, so xterm keeps its own default for that color.
 */
export function buildTerminalTheme(readToken: (token: string) => string): Partial<TerminalTheme> {
  const theme: Partial<TerminalTheme> = {};
  for (const [key, token] of Object.entries(THEME_TOKENS) as [keyof TerminalTheme, string][]) {
    const value = (readToken(token) ?? "").trim();
    if (value) {
      theme[key] = value;
    }
  }
  return theme;
}

/** The theme for the current document. */
export function currentTerminalTheme(): Partial<TerminalTheme> {
  const style = getComputedStyle(document.documentElement);
  return buildTerminalTheme((token) => style.getPropertyValue(token));
}

// The terminal, the Markdown preview and anything else that copies colors out
// of CSS listen through this one watcher.
export { watchTheme } from "$lib/themes/watch";
