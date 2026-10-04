// Mermaid diagrams for the Markdown preview and the rich editor. The library is large, so it
// never loads into the window: diagrams are drawn in a hidden frame (src/routes/mermaid-frame)
// that is made for the first diagram and removed, library and all, shortly after the last
// document with diagrams closes. Renders run one at a time (mermaid is not reentrant) and are
// cached by theme and source while the frame lives, so a diagram is drawn again only when its
// text changes. The built-in themes use mermaid's own light and dark looks; other color themes
// (data-color-theme on <html>) color diagrams from their CSS variables.

import type { MermaidConfig } from "mermaid";
import { parseColor } from "$lib/themes/color";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from "$lib/themes/themeIndex";
import type { FrameRequest, FrameResponse } from "./mermaidFrame";

export type MermaidResult = { svg: string } | { error: string };

/** Draws diagrams somewhere and can be thrown away; the frame in the app, a fake in tests. */
export interface DiagramBackend {
  render(diagramId: string, source: string, config: MermaidConfig): Promise<MermaidResult>;
  dispose(): void;
}

/** Drawn diagrams kept, by count and by size: a big diagram is hundreds of KB of SVG text. */
const CACHE_LIMIT = 24;
const CACHE_CHARS = 2_000_000;
/** The frame stays this long after the last user lets go, so moving a tab or switching the view does not reload it. */
export const RELEASE_DELAY_MS = 3_000;
/** A frame that never answers fails the diagram instead of holding up every other one. */
const FRAME_TIMEOUT_MS = 30_000;

const cache = new Map<string, MermaidResult>();
let cachedChars = 0;
let queue: Promise<unknown> = Promise.resolve();
let counter = 0;
/** Previews and rich editors whose document has diagrams. */
const users = new Set<object>();
let backend: DiagramBackend | null = null;
let createBackend: () => DiagramBackend = createFrameBackend;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
/** Bumped on every unload, so a render that finishes afterwards is not cached. */
let generation = 0;

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

/** The settings the frame gives mermaid; the colors are read here, where the CSS tokens are. */
function mermaidConfig(dark: boolean): MermaidConfig {
  const key = themeKey(dark);
  const builtIn = key === "dark" || key === "default";
  return {
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
  } as MermaidConfig;
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

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), FRAME_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** The hidden frame that loads mermaid; removing it frees the library. */
function createFrameBackend(): DiagramBackend {
  const frame = document.createElement("iframe");
  frame.src = "/mermaid-frame";
  frame.title = "Mermaid diagrams";
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  // Laid out but out of sight: mermaid measures text while it draws.
  Object.assign(frame.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "1600px",
    height: "1200px",
    border: "0",
    visibility: "hidden",
    pointerEvents: "none",
  });
  const pending = new Map<number, (result: MermaidResult) => void>();
  let requestCounter = 0;
  let markReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  // Only our own frame is listened to. The source window is checked rather than the origin,
  // which the app's tauri:// pages may report as "null".
  const onMessage = (event: MessageEvent) => {
    if (event.source === null || event.source !== frame.contentWindow) {
      return;
    }
    const data = event.data as FrameResponse | { type: "gm-mermaid-ready" } | null;
    if (data?.type === "gm-mermaid-ready") {
      markReady();
    } else if (data?.type === "gm-mermaid-result") {
      const done = pending.get(data.requestId);
      pending.delete(data.requestId);
      done?.("svg" in data ? { svg: data.svg } : { error: data.error });
    }
  };
  window.addEventListener("message", onMessage);
  document.body.appendChild(frame);
  return {
    async render(diagramId, source, config) {
      const loaded = await withTimeout(
        ready.then(() => true),
        false,
      );
      if (!loaded || !frame.contentWindow) {
        return { error: "The diagram drawer did not load" };
      }
      requestCounter += 1;
      const requestId = requestCounter;
      const result = new Promise<MermaidResult>((resolve) => {
        pending.set(requestId, resolve);
      });
      const request: FrameRequest = { type: "gm-mermaid-render", requestId, diagramId, source, config };
      frame.contentWindow.postMessage(request, "*");
      return withTimeout(result, { error: "Drawing the diagram took too long" });
    },
    dispose() {
      window.removeEventListener("message", onMessage);
      for (const done of pending.values()) {
        done({ error: "Diagram closed" });
      }
      pending.clear();
      frame.remove();
    },
  };
}

/** Removes the frame and forgets every drawn diagram, once no document with diagrams is open. */
function unload(): void {
  if (users.size > 0) {
    return;
  }
  generation += 1;
  backend?.dispose();
  backend = null;
  cache.clear();
  cachedChars = 0;
  queue = Promise.resolve();
}

/** A diagram already drawn for this source and theme, without waiting. */
export function cachedMermaid(source: string, dark: boolean): MermaidResult | null {
  return cache.get(cacheKey(source, dark)) ?? null;
}

/** Draws a diagram for `user` (a preview or rich editor), which keeps the frame until `releaseMermaid`. */
export function renderMermaid(user: object, source: string, dark: boolean): Promise<MermaidResult> {
  users.add(user);
  clearTimeout(releaseTimer);
  const key = cacheKey(source, dark);
  const cached = cache.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }
  const askedIn = generation;
  const run = queue.then(async (): Promise<MermaidResult> => {
    const again = cache.get(key);
    if (again) {
      return again;
    }
    // Unloaded while it waited in the queue: it must not bring the frame back.
    if (askedIn !== generation) {
      return { error: "Diagram closed" };
    }
    counter += 1;
    const diagramId = `gm-mermaid-${counter}`;
    const drawnIn = generation;
    backend ??= createBackend();
    const result = await backend.render(diagramId, source, mermaidConfig(dark));
    return drawnIn === generation ? remember(key, result) : result;
  });
  queue = run.catch(() => null);
  return run;
}

/** `user` closed or has no diagrams any more; the last one to go lets the frame and the cache go. */
export function releaseMermaid(user: object): void {
  if (!users.delete(user) || users.size > 0) {
    return;
  }
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(unload, RELEASE_DELAY_MS);
}

/** Whether the diagram frame is loaded now, for tests and the MCP performance report. */
export function mermaidLoaded(): boolean {
  return backend !== null;
}

/** Tests draw with a fake instead of a frame. */
export function setDiagramBackendForTests(factory: () => DiagramBackend): void {
  createBackend = factory;
}
