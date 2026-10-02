// Mermaid diagrams for the Markdown preview. The library is large, so it is
// imported only when a document has a ```mermaid block. Renders run one at a
// time (mermaid is not reentrant) and are cached by theme and source, so a
// diagram is drawn again only when its text changes. The built-in themes use
// mermaid's own light and dark looks; other color themes (data-color-theme on
// <html>) color diagrams from their CSS variables.

import type { Mermaid } from "mermaid";
import { parseColor } from "$lib/themes/color";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from "$lib/themes/themeIndex";

export type MermaidResult = { svg: string } | { error: string };

/** Drawn diagrams kept, by count and by size: a big diagram is hundreds of KB of SVG text. */
const CACHE_LIMIT = 24;
const CACHE_CHARS = 2_000_000;
const cache = new Map<string, MermaidResult>();
let cachedChars = 0;
let library: Promise<Mermaid> | null = null;
let configuredTheme: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
let counter = 0;

function colorThemeId(): string {
  return document.documentElement.getAttribute("data-color-theme") ?? "";
}

/** Mermaid's own theme for the built-ins, the color theme's variables otherwise. */
function themeKey(dark: boolean): string {
  const themeId = colorThemeId();
  const builtIn = themeId === "" || themeId === DEFAULT_LIGHT_THEME || themeId === DEFAULT_DARK_THEME;
  return builtIn ? (dark ? "dark" : "default") : `${dark ? "dark" : "light"}:${themeId}`;
}

function cacheKey(source: string, dark: boolean): string {
  return `${themeKey(dark)}\u0000${source}`;
}

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** mermaid's base theme colored from the CSS tokens; only plain colors are passed on. */
function themeVariables(dark: boolean): Record<string, string | boolean> {
  const style = getComputedStyle(document.documentElement);
  const tokens: Record<string, string> = {
    background: "--editor-bg",
    primaryColor: "--panel-alt",
    primaryTextColor: "--text",
    primaryBorderColor: "--accent",
    secondaryColor: "--selected-inactive",
    tertiaryColor: "--panel",
    lineColor: "--text-dim",
    textColor: "--text",
    noteBkgColor: "--panel",
    noteTextColor: "--text",
    noteBorderColor: "--border-strong",
  };
  const variables: Record<string, string | boolean> = { darkMode: dark, fontFamily: FONT_FAMILY };
  for (const [name, token] of Object.entries(tokens)) {
    const value = style.getPropertyValue(token).trim();
    if (parseColor(value)) {
      variables[name] = value;
    }
  }
  return variables;
}

function load(): Promise<Mermaid> {
  library ??= import("mermaid").then((module) => module.default);
  return library;
}

function configure(mermaid: Mermaid, dark: boolean): void {
  const key = themeKey(dark);
  if (configuredTheme === key) {
    return;
  }
  configuredTheme = key;
  const builtIn = key === "dark" || key === "default";
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: builtIn ? key : "base",
    ...(builtIn ? {} : { themeVariables: themeVariables(dark) }),
    // SVG text instead of HTML labels in foreignObject.
    htmlLabels: false,
    suppressErrorRendering: true,
    fontFamily: FONT_FAMILY,
    // Diagrams cannot loosen security or inject page CSS through %%{init}%% directives.
    secure: ["secure", "securityLevel", "startOnLoad", "maxTextSize", "suppressErrorRendering", "maxEdges", "themeCSS", "htmlLabels"],
  });
}

function sizeOf(key: string, result: MermaidResult): number {
  return key.length + ("svg" in result ? result.svg.length : result.error.length);
}

function remember(key: string, result: MermaidResult): MermaidResult {
  const previous = cache.get(key);
  if (previous) {
    cachedChars -= sizeOf(key, previous);
    cache.delete(key);
  }
  cache.set(key, result);
  cachedChars += sizeOf(key, result);
  // The oldest go first; the one just drawn always stays.
  while (cache.size > 1 && (cache.size > CACHE_LIMIT || cachedChars > CACHE_CHARS)) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    const dropped = cache.get(oldest);
    if (dropped) {
      cachedChars -= sizeOf(oldest, dropped);
    }
    cache.delete(oldest);
  }
  return result;
}

/** Mermaid draws in a hidden element of the page and can leave it behind when a diagram fails. */
function removeLeftovers(diagramId: string): void {
  for (const id of [diagramId, `d${diagramId}`, `i${diagramId}`]) {
    document.getElementById(id)?.remove();
  }
}

/** A diagram already drawn for this source and theme, without waiting. */
export function cachedMermaid(source: string, dark: boolean): MermaidResult | null {
  return cache.get(cacheKey(source, dark)) ?? null;
}

export function renderMermaid(source: string, dark: boolean): Promise<MermaidResult> {
  const key = cacheKey(source, dark);
  const cached = cache.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }
  const run = queue.then(async (): Promise<MermaidResult> => {
    const again = cache.get(key);
    if (again) {
      return again;
    }
    counter += 1;
    const diagramId = `gm-mermaid-${counter}`;
    try {
      const mermaid = await load();
      configure(mermaid, dark);
      const { svg } = await mermaid.render(diagramId, source);
      return remember(key, { svg });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "Diagram error");
      return remember(key, { error: message || "Diagram error" });
    } finally {
      removeLeftovers(diagramId);
    }
  });
  queue = run.catch(() => null);
  return run;
}
