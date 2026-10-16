// Files dropped from Finder on a terminal are typed at the prompt as quoted
// paths, like Terminal.app. Kept free of Svelte and Tauri so it
// can be tested directly.

export type QuoteStyle = "posix" | "windows";

/** Sent by TerminalHost to the terminal view under a Finder drop. */
export const TERMINAL_DROP_EVENT = "gm-terminal-drop";
/** Sent while files are dragged over a terminal (`over: true`) and when they leave it. */
export const TERMINAL_DRAG_EVENT = "gm-terminal-drag";

export interface TerminalDropDetail {
  filePaths: string[];
}

export interface TerminalDragDetail {
  over: boolean;
}

/** A terminal screen's element id carries its key; the Files panel skips drops over one, so a drop is handled once. */
const SCREEN_ID_PREFIX = "terminal-screen-";

export function terminalScreenId(terminalKey: number): string {
  return `${SCREEN_ID_PREFIX}${terminalKey}`;
}

/** The terminal key of the terminal screen under a point's element, or null when the point is elsewhere. */
export function terminalKeyAt(element: Element | null): number | null {
  const view = element?.closest(`[id^="${SCREEN_ID_PREFIX}"]`) ?? null;
  const value = Number(view?.id.slice(SCREEN_ID_PREFIX.length) ?? "");
  return view && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Characters that never need quotes in a POSIX shell word. */
const SAFE_POSIX = /^[A-Za-z0-9_@%+=:,./-]+$/;

/** One path as a single shell word. */
export function shellQuote(filePath: string, style: QuoteStyle): string {
  if (style === "windows") {
    return /[\s&()^%!,;=]/.test(filePath) ? `"${filePath.replace(/"/g, "")}"` : filePath;
  }
  if (SAFE_POSIX.test(filePath)) {
    return filePath;
  }
  // Inside single quotes nothing is special; a quote itself is closed, escaped and reopened.
  return `'${filePath.replace(/'/g, "'\\''")}'`;
}

/** What a drop types: each path quoted, separated and followed by a space, ready for more typing. */
export function dropText(filePaths: string[], style: QuoteStyle): string {
  const words = filePaths
    .filter((filePath) => filePath && !filePath.includes("\0"))
    .map((filePath) => shellQuote(filePath, style));
  return words.length > 0 ? `${words.join(" ")} ` : "";
}
