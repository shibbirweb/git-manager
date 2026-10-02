// Rich Markdown editing writes back into the source text block by block: a block that was
// not edited keeps its exact original text, so typing in the rich editor never reformats
// the rest of the file (list markers, emphasis style, table padding, blank lines...).
// Kept free of the editor so it can be tested directly.

/** A top-level block's place in the source text (end exclusive). */
export interface SourceBlock {
  from: number;
  to: number;
}

/** One change to the source text. */
export interface SourceEdit {
  from: number;
  to: number;
  insert: string;
}

const BLOCK_SEPARATOR = "\n\n";

/** Front matter (`---` ... `---` at the very top) is kept as written and never shown as blocks. */
export function splitFrontMatter(source: string): { frontMatter: string; body: string } {
  const match = /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(source);
  if (!match) {
    return { frontMatter: "", body: source };
  }
  return { frontMatter: match[0], body: source.slice(match[0].length) };
}

/**
 * The source edit that turns the old blocks into the new ones. `oldBlocks` (each block as
 * the serializer writes it) must line up with `ranges`; equal blocks at the start and the
 * end are left alone, so only the edited stretch is rewritten. Null when nothing changed.
 */
export function blockEdit(source: string, ranges: SourceBlock[], oldBlocks: string[], newBlocks: string[]): SourceEdit | null {
  if (ranges.length !== oldBlocks.length) {
    throw new Error("Blocks and ranges do not line up");
  }
  const oldCount = oldBlocks.length;
  const newCount = newBlocks.length;
  let prefix = 0;
  while (prefix < oldCount && prefix < newCount && oldBlocks[prefix] === newBlocks[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < oldCount - prefix &&
    suffix < newCount - prefix &&
    oldBlocks[oldCount - 1 - suffix] === newBlocks[newCount - 1 - suffix]
  ) {
    suffix++;
  }
  const removed = oldCount - prefix - suffix;
  const added = newBlocks.slice(prefix, newCount - suffix).map((block) => block.replace(/\n+$/, ""));
  if (removed === 0 && added.length === 0) {
    return null;
  }
  const inserted = added.join(BLOCK_SEPARATOR);
  if (removed > 0 && added.length > 0) {
    return { from: ranges[prefix].from, to: ranges[prefix + removed - 1].to, insert: inserted };
  }
  if (removed > 0) {
    // Whole blocks went: take the blank lines before them too, or after them at the top.
    const first = ranges[prefix];
    const last = ranges[prefix + removed - 1];
    if (prefix > 0) {
      return { from: ranges[prefix - 1].to, to: last.to, insert: "" };
    }
    const next = ranges[prefix + removed];
    return { from: first.from, to: next ? next.from : source.length, insert: "" };
  }
  // Only new blocks: after the block before them, else before the block after them.
  if (prefix > 0) {
    const at = ranges[prefix - 1].to;
    return { from: at, to: at, insert: BLOCK_SEPARATOR + inserted };
  }
  if (oldCount > 0) {
    const at = ranges[0].from;
    return { from: at, to: at, insert: inserted + BLOCK_SEPARATOR };
  }
  // An empty document: whatever was there (blank lines) becomes the new text.
  return { from: 0, to: source.length, insert: inserted + "\n" };
}

export function applyEdit(source: string, edit: SourceEdit): string {
  return source.slice(0, edit.from) + edit.insert + source.slice(edit.to);
}
