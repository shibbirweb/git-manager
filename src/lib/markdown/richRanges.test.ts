// The rich editor's incremental block ranges against a full parse, with the same remark and GFM
// parser Milkdown uses (its dependencies), so a sync that skips the full parse finds the blocks
// exactly where the full parse would.
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { applyEdit, blockEdit, type PositionedTree, rangesAfterEdit, type SourceBlock, topLevelRangesOf } from "./richSync";

const processor = unified().use(remarkParse).use(remarkGfm);
let parses = 0;
let parsedLength = 0;

function parse(text: string): SourceBlock[] {
  parses++;
  parsedLength += text.length;
  return topLevelRangesOf(processor.parse(text) as PositionedTree);
}

const DOCUMENT = [
  "# Title",
  "Intro paragraph with *emphasis*\nand a second line.",
  "* one\n* two\n  * nested",
  "1. first\n2. second",
  "> A quote\n> over two lines.",
  "```ts\nconst answer = 42;\n```",
  "| a | b |\n|---|:-:|\n| 1 | 2 |",
  "    indented code",
  "- [ ] task\n- [x] done",
  "Setext heading\n---",
  "<div>\nhtml block\n</div>",
  "Last paragraph.",
].join("\n\n");

/** The blocks as written in the text, which the tests edit like the serializer would. */
function textsOf(source: string, ranges: SourceBlock[]): string[] {
  return ranges.map((range) => source.slice(range.from, range.to));
}

interface Step {
  source: string;
  ranges: SourceBlock[];
  /** The incremental answer was used (not the full-parse fallback). */
  incremental: boolean;
}

/** One rich edit: the blocks change, the text is patched and the ranges follow. */
function step(source: string, ranges: SourceBlock[], change: (blocks: string[]) => string[]): Step {
  const before = textsOf(source, ranges);
  const edit = blockEdit(source, ranges, before, change([...before]));
  if (!edit) {
    return { source, ranges, incremental: true };
  }
  const next = applyEdit(source, edit);
  const updated = rangesAfterEdit(next, ranges, edit, parse);
  return { source: next, ranges: updated ?? parse(next), incremental: updated !== null };
}

describe("rangesAfterEdit", () => {
  it("matches a full parse after edits, inserts and deletes anywhere", () => {
    const ranges = parse(DOCUMENT);
    expect(ranges.length).toBe(12);
    const changes: ((blocks: string[]) => string[])[] = [
      (blocks) => blocks.map((block, index) => (index === 1 ? `${block} More words.` : block)),
      (blocks) => blocks.map((block, index) => (index === 0 ? "## New title" : block)),
      (blocks) => blocks.map((block, index) => (index === blocks.length - 1 ? "The end." : block)),
      (blocks) => [...blocks.slice(0, 3), "A new paragraph.", ...blocks.slice(3)],
      (blocks) => ["Before everything.", ...blocks],
      (blocks) => [...blocks, "After everything."],
      (blocks) => [...blocks.slice(0, 5), ...blocks.slice(6)],
      (blocks) => blocks.slice(1),
      (blocks) => blocks.slice(0, -1),
      (blocks) => [...blocks.slice(0, 2), "First new.", "Second new.", ...blocks.slice(4)],
      (blocks) => blocks.map((block, index) => (index === 6 ? "| a | b |\n|---|---|\n| 3 | 4 |\n| 5 | 6 |" : block)),
    ];
    let source = DOCUMENT;
    let current = ranges;
    for (const change of changes) {
      const result = step(source, current, change);
      expect(result.incremental).toBe(true);
      expect(result.ranges).toEqual(parse(result.source));
      source = result.source;
      current = result.ranges;
    }
  });

  it("keeps every untouched block byte for byte", () => {
    const ranges = parse(DOCUMENT);
    const before = textsOf(DOCUMENT, ranges);
    const result = step(DOCUMENT, ranges, (blocks) => blocks.map((block, index) => (index === 4 ? "> Changed quote." : block)));
    const after = textsOf(result.source, result.ranges);
    expect(after.length).toBe(before.length);
    for (let index = 0; index < before.length; index++) {
      expect(after[index]).toBe(index === 4 ? "> Changed quote." : before[index]);
    }
  });

  it("parses only the edited stretch of a long text", () => {
    const long = Array.from({ length: 3000 }, (_, index) => `Paragraph ${index} with some words.`).join("\n\n");
    const ranges = parse(long);
    parses = 0;
    parsedLength = 0;
    const result = step(long, ranges, (blocks) => blocks.map((block, index) => (index === 1500 ? "Edited paragraph." : block)));
    expect(result.incremental).toBe(true);
    // The edited block and one on each side.
    expect(parses).toBe(1);
    expect(parsedLength).toBeLessThan(100);
    expect(result.ranges).toEqual(parse(result.source));
  });

  it("gives up when the edit changes the blocks around it", () => {
    const ranges = parse(DOCUMENT);
    // An open fence runs to the end of the text.
    const fence = step(DOCUMENT, ranges, (blocks) => blocks.map((block, index) => (index === 2 ? "```" : block)));
    expect(fence.incremental).toBe(false);
    expect(fence.ranges).toEqual(parse(fence.source));
    // A list next to a list of the same kind joins it, across the blank line.
    const list = "- a\n\nText.\n\n- b";
    const listRanges = parse(list);
    const joined = step(list, listRanges, (blocks) => [blocks[0], "- new", blocks[2]]);
    expect(joined.incremental).toBe(false);
    expect(joined.ranges).toEqual(parse(joined.source));
  });

  // 400 full parses: slow on a busy machine, so it gets more than the default 5 s.
  it("agrees with a full parse over many random edits", () => {
    const snippets = [
      "Plain paragraph.",
      "# Heading",
      "- item\n- item",
      "1. item",
      "> quote",
      "```\ncode\n```",
      "```",
      "| x |\n|---|\n| y |",
      "Text\n===",
      "<!-- note -->",
      "<div>",
      "    code",
      "[ref]: https://example.com",
      "[^1]: A footnote.",
      "***",
      "- [ ] task",
    ];
    // mulberry32: the same edits on every run.
    let seed = 7;
    const random = (limit: number): number => {
      seed = (seed + 0x6d2b79f5) | 0;
      let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
      return ((mixed ^ (mixed >>> 14)) >>> 0) % limit;
    };
    let source = DOCUMENT;
    let ranges = parse(source);
    let incremental = 0;
    let changed = 0;
    for (let round = 0; round < 400; round++) {
      const result = step(source, ranges, (blocks) => {
        const at = random(blocks.length + 1);
        const snippet = snippets[random(snippets.length)];
        const action = random(3);
        if (action === 0 && at < blocks.length) {
          blocks[at] = snippet;
        } else if (action === 1 || blocks.length < 4) {
          blocks.splice(at, 0, snippet);
        } else {
          blocks.splice(Math.min(at, blocks.length - 1), 1);
        }
        return blocks;
      });
      expect(result.ranges).toEqual(parse(result.source));
      if (result.source !== source) {
        changed++;
        if (result.incremental) {
          incremental++;
        }
      }
      source = result.source;
      ranges = result.ranges;
      if (ranges.length > 40) {
        source = DOCUMENT;
        ranges = parse(source);
      }
    }
    // Most edits take the quick way; the rest fell back to a full parse.
    expect(changed).toBeGreaterThan(300);
    expect(incremental).toBeGreaterThan(changed / 2);
    expect(incremental).toBeLessThan(changed);
  }, 30_000);
});
