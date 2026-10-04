// Rich Markdown editing writes back into the source text block by block: a block that was
// not edited keeps its exact original text, so typing in the rich editor never reformats
// the rest of the file (list markers, emphasis style, table padding, blank lines...).
// Kept free of the editor so it can be tested directly, like the parse fix-up below.

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

/** The parts of a parsed (mdast) tree that give its blocks' places. */
export interface PositionedTree {
  children?: { position?: { start: { offset?: number }; end: { offset?: number } } }[];
}

/** Where each top-level block of a parsed text is. */
export function topLevelRangesOf(tree: PositionedTree): SourceBlock[] {
  const ranges: SourceBlock[] = [];
  for (const child of tree.children ?? []) {
    const from = child.position?.start.offset;
    const to = child.position?.end.offset;
    if (from !== undefined && to !== undefined) {
      ranges.push({ from, to });
    }
  }
  return ranges;
}

function sameBlock(left: SourceBlock | undefined, right: SourceBlock): boolean {
  return left !== undefined && left.from === right.from && left.to === right.to;
}

/**
 * The block ranges of `newBody` (the body after `edit`) from `ranges`, those of the body before
 * it, without parsing the whole text: a full parse of a 5,000 line file takes over 100 ms, and it
 * ran after every pause in typing. Blocks before the edit stay, blocks after it move by its
 * length, and only the edited stretch is parsed again, with the untouched block on each side.
 *
 * Markdown reads a block the same way wherever it starts, as long as the block before it has
 * ended, so the stretch can be parsed on its own. The block on each side must read back exactly
 * where it was; when it does not (the edit opened a code fence that runs on, or merged two
 * lists), null is returned and the caller parses the whole body.
 */
export function rangesAfterEdit(
  newBody: string,
  ranges: SourceBlock[],
  edit: SourceEdit,
  parse: (text: string) => SourceBlock[],
): SourceBlock[] | null {
  const shift = edit.insert.length - (edit.to - edit.from);
  let before = -1;
  while (before + 1 < ranges.length && ranges[before + 1].to <= edit.from) {
    before++;
  }
  let after = before + 1;
  while (after < ranges.length && ranges[after].from < edit.to) {
    after++;
  }
  const hasAfter = after < ranges.length;
  let start = 0;
  if (before >= 0) {
    // From the start of its line, so indentation reads as it does in the whole text.
    start = newBody.lastIndexOf("\n", ranges[before].from - 1) + 1;
    if (!/^[ \t]*$/.test(newBody.slice(start, ranges[before].from))) {
      return null;
    }
  }
  const end = hasAfter ? ranges[after].to + shift : newBody.length;
  if (end < start || end > newBody.length) {
    return null;
  }
  const parsed = parse(newBody.slice(start, end)).map((block) => ({ from: block.from + start, to: block.to + start }));
  if (before >= 0 && !sameBlock(parsed[0], ranges[before])) {
    return null;
  }
  if (hasAfter) {
    const moved = { from: ranges[after].from + shift, to: ranges[after].to + shift };
    if (parsed.length < (before >= 0 ? 2 : 1) || !sameBlock(parsed[parsed.length - 1], moved)) {
      return null;
    }
  }
  const kept = before >= 0 ? ranges.slice(0, before) : [];
  const moved = ranges.slice(after + 1).map((block) => ({ from: block.from + shift, to: block.to + shift }));
  return [...kept, ...parsed, ...moved];
}

/** The parts of a remark (mdast) node the parse fix-up reads. */
export interface MarkdownTreeNode {
  type: string;
  children?: MarkdownTreeNode[];
  [field: string]: unknown;
}

const IMAGE_FIELDS = ["url", "alt", "title"];

/**
 * remark gives an image without a title `title: null`, but the editor's image node only takes
 * strings, so ProseMirror rejected the node and the image dropped out of the document. A
 * missing field instead gets the schema's default (""), which is written back as no title.
 */
export function dropNullImageFields(tree: MarkdownTreeNode): void {
  const pending: MarkdownTreeNode[] = [tree];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) {
      break;
    }
    if (node.type === "image") {
      for (const field of IMAGE_FIELDS) {
        if (node[field] === null) {
          delete node[field];
        }
      }
    }
    pending.push(...(node.children ?? []));
  }
}
