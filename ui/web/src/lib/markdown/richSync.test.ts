import { describe, expect, it } from "vitest";
import { applyEdit, sourceEdit, splitFrontMatter } from "./richSync";

describe("sourceEdit", () => {
  it("replaces only the text between the common start and end", () => {
    const before = "# Title\n\n* one\n* two\n";
    const after = "# Title\n\n* one\n* three\n";
    const edit = sourceEdit(before, after);
    expect(edit).toEqual({ from: 18, to: 20, insert: "hree" });
    expect(applyEdit(before, edit!)).toBe(after);
  });

  it("is null for equal texts and handles inserts and deletes at the ends", () => {
    expect(sourceEdit("same", "same")).toBeNull();
    expect(sourceEdit("", "new")).toEqual({ from: 0, to: 0, insert: "new" });
    expect(applyEdit("a\nb\n", sourceEdit("a\nb\n", "a\nb\nc\n")!)).toBe("a\nb\nc\n");
    expect(applyEdit("a\nb\nc\n", sourceEdit("a\nb\nc\n", "a\nc\n")!)).toBe("a\nc\n");
  });

  it("never splits a surrogate pair", () => {
    const before = "x 😀 y";
    const after = "x 😃 y";
    const edit = sourceEdit(before, after)!;
    expect(edit.insert).toBe("😃");
    expect(applyEdit(before, edit)).toBe(after);
  });
});

describe("splitFrontMatter", () => {
  it("keeps YAML front matter apart from the body", () => {
    expect(splitFrontMatter("---\ntitle: A\n---\n# Body\n")).toEqual({
      frontMatter: "---\ntitle: A\n---\n",
      body: "# Body\n",
    });
    expect(splitFrontMatter("# No front matter\n")).toEqual({ frontMatter: "", body: "# No front matter\n" });
  });
});
