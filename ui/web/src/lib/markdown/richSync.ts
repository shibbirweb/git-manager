// The rich Markdown editor's link to the source text: front matter stays out of the editor, and the text the
// editor saves (rich/rich-markdown-serialization-commit.ts) goes back to the text editor as one small edit, so
// the text editor's undo, the unsaved dot and the diff see only what changed.

/** One change to the source text. */
export interface SourceEdit {
  from: number;
  to: number;
  insert: string;
}

/** Front matter (`---` ... `---` at the very top) is kept as written and never shown in the editor. */
export function splitFrontMatter(source: string): { frontMatter: string; body: string } {
  const match = /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(source);
  if (!match) {
    return { frontMatter: "", body: source };
  }
  return { frontMatter: match[0], body: source.slice(match[0].length) };
}

/**
 * The single edit that turns `before` into `after`: the text between their common start and common end. Null when
 * they are the same. Never splits a surrogate pair, so the edit stays valid UTF-16 on its own.
 */
export function sourceEdit(before: string, after: string): SourceEdit | null {
  if (before === after) {
    return null;
  }
  let start = 0;
  const shortest = Math.min(before.length, after.length);
  while (start < shortest && before.charCodeAt(start) === after.charCodeAt(start)) {
    start++;
  }
  if (start > 0 && isHighSurrogate(before.charCodeAt(start - 1))) {
    start--;
  }
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before.charCodeAt(endBefore - 1) === after.charCodeAt(endAfter - 1)) {
    endBefore--;
    endAfter--;
  }
  if (endBefore < before.length && isLowSurrogate(before.charCodeAt(endBefore))) {
    endBefore++;
    endAfter++;
  }
  return { from: start, to: endBefore, insert: after.slice(start, endAfter) };
}

/** `source` with `edit` applied. */
export function applyEdit(source: string, edit: SourceEdit): string {
  return source.slice(0, edit.from) + edit.insert + source.slice(edit.to);
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}
