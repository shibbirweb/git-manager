import { describe, expect, it } from "vitest";
import { applyEdit, blockEdit, type SourceBlock, splitFrontMatter } from "./richSync";

/** Blocks of a source written with blank lines between them, with their ranges. */
function blocksOf(source: string): { ranges: SourceBlock[]; texts: string[] } {
  const ranges: SourceBlock[] = [];
  const pattern = /[^\n](?:[\s\S]*?)(?=\n\n|\n*$)/g;
  for (const match of source.matchAll(pattern)) {
    ranges.push({ from: match.index ?? 0, to: (match.index ?? 0) + match[0].length });
  }
  return { ranges, texts: ranges.map((range) => source.slice(range.from, range.to)) };
}

/** The serializer's own spelling: here it writes "-" bullets and "**" where the file has "*" and "__". */
function serialized(texts: string[]): string[] {
  return texts.map((text) => text.replace(/^\* /gm, "- ").replace(/__(.+?)__/g, "**$1**"));
}

function edited(source: string, change: (blocks: string[]) => string[]): string {
  const { ranges, texts } = blocksOf(source);
  const before = serialized(texts);
  const edit = blockEdit(source, ranges, before, change([...before]));
  return edit ? applyEdit(source, edit) : source;
}

const source = "# Title\n\n* one\n* two\n\nSome __bold__ text.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n";

describe("blockEdit", () => {
  it("rewrites only the edited block, keeping the others exactly as written", () => {
    const result = edited(source, (blocks) => {
      blocks[0] = "# New title";
      return blocks;
    });
    expect(result).toBe("# New title\n\n* one\n* two\n\nSome __bold__ text.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n");
  });

  it("writes an edited block in the serializer's spelling", () => {
    const result = edited(source, (blocks) => {
      blocks[2] = "Some **bold** words.";
      return blocks;
    });
    expect(result).toBe("# Title\n\n* one\n* two\n\nSome **bold** words.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n");
  });

  it("inserts and deletes whole blocks with the blank lines around them", () => {
    const inserted = edited(source, (blocks) => [blocks[0], "New paragraph.", ...blocks.slice(1)]);
    expect(inserted).toBe("# Title\n\nNew paragraph.\n\n* one\n* two\n\nSome __bold__ text.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n");
    const atTop = edited(source, (blocks) => ["Intro.", ...blocks]);
    expect(atTop.startsWith("Intro.\n\n# Title\n\n")).toBe(true);
    const deleted = edited(source, (blocks) => [blocks[0], blocks[2], blocks[3]]);
    expect(deleted).toBe("# Title\n\nSome __bold__ text.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n");
    const firstDeleted = edited(source, (blocks) => blocks.slice(1));
    expect(firstDeleted).toBe("* one\n* two\n\nSome __bold__ text.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n");
    const lastDeleted = edited(source, (blocks) => blocks.slice(0, 3));
    expect(lastDeleted).toBe("# Title\n\n* one\n* two\n\nSome __bold__ text.\n");
  });

  it("returns nothing when the blocks are the same, and fills an empty file", () => {
    const { ranges, texts } = blocksOf(source);
    expect(blockEdit(source, ranges, texts, texts)).toBeNull();
    expect(applyEdit("\n", blockEdit("\n", [], [], ["Hello"]) ?? { from: 0, to: 0, insert: "" })).toBe("Hello\n");
    expect(() => blockEdit(source, ranges, texts.slice(1), texts)).toThrow();
  });
});

describe("splitFrontMatter", () => {
  it("keeps YAML front matter apart from the body", () => {
    expect(splitFrontMatter("---\ntitle: Notes\ntags: [a]\n---\n# Hi\n")).toEqual({ frontMatter: "---\ntitle: Notes\ntags: [a]\n---\n", body: "# Hi\n" });
    expect(splitFrontMatter("# Hi\n\n---\n")).toEqual({ frontMatter: "", body: "# Hi\n\n---\n" });
    expect(splitFrontMatter("---\nnot closed\n")).toEqual({ frontMatter: "", body: "---\nnot closed\n" });
  });
});
