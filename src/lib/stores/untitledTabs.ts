// Untitled tabs (File > New File, Cmd+N): text not saved to a file yet. Like the other pseudo
// tabs (pseudoTabs.ts) each has a path that can never be a file: "untitled:" and a short id,
// unique across windows and restarts, so its kept text (unsavedText.svelte.ts) never mixes
// with another tab's. Pure, so names and titles are tested.

const PREFIX = "untitled:";
const ID_PATTERN = /^[a-z0-9]{1,32}$/i;
/** A tab title is the first line of the text, like Sublime Text, cut to this many characters. */
const MAX_TITLE = 32;
const MAX_FILE_NAME = 48;
export const UNTITLED_TITLE = "Untitled";
export const UNTITLED_FILE_NAME = "untitled.txt";

export function isUntitledTab(tabPath: string): boolean {
  return tabPath.startsWith(PREFIX) && ID_PATTERN.test(tabPath.slice(PREFIX.length));
}

/** A new Untitled tab's path; `now` and `random` are passed in by tests. */
export function newUntitledPath(now: number = Date.now(), random: () => number = Math.random): string {
  const suffix = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `${PREFIX}${now.toString(36)}${suffix}`;
}

/** The first line with text in it, trimmed; empty when there is none. */
function firstLine(text: string): string {
  // Only the start of a long text is looked at.
  for (const line of text.slice(0, 4096).split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return "";
}

/** The tab title: the first line of the text, or "Untitled" while there is none. */
export function untitledTitle(text: string): string {
  const line = firstLine(text).replace(/\s+/g, " ");
  if (line.length === 0) {
    return UNTITLED_TITLE;
  }
  return line.length > MAX_TITLE ? `${line.slice(0, MAX_TITLE - 3).trimEnd()}...` : line;
}

/**
 * The name Save offers: the first line made safe for a file name, with ".txt" when it has no
 * extension; "untitled.txt" when nothing usable is left.
 */
export function suggestedFileName(text: string): string {
  const safe = firstLine(text)
    .replace(/[^\p{L}\p{N} ._-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FILE_NAME)
    .replace(/^[.\s]+|[.\s]+$/g, "");
  if (safe.length === 0) {
    return UNTITLED_FILE_NAME;
  }
  return /\.[\p{L}\p{N}]+$/u.test(safe) ? safe : `${safe}.txt`;
}
