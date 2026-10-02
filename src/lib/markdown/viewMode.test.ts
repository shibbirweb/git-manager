import { describe, expect, it } from "vitest";
import { isMarkdownPath, rememberViewMode, sessionViewMode } from "./viewMode";

describe("Markdown view modes", () => {
  it("recognizes Markdown files", () => {
    expect(isMarkdownPath("/r/README.md")).toBe(true);
    expect(isMarkdownPath("/r/notes.MARKDOWN")).toBe(true);
    expect(isMarkdownPath("/r/page.mdx")).toBe(true);
    expect(isMarkdownPath("/r/.md")).toBe(false);
    expect(isMarkdownPath("/r/md")).toBe(false);
    expect(isMarkdownPath("/r.md/file.txt")).toBe(false);
  });

  it("remembers the mode per file and falls back to the default", () => {
    expect(sessionViewMode("/r/a.md", "split")).toBe("split");
    rememberViewMode("/r/a.md", "preview");
    expect(sessionViewMode("/r/a.md", "split")).toBe("preview");
    expect(sessionViewMode("/r/b.md", "editor")).toBe("editor");
  });
});
