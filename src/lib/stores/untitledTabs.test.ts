import { describe, expect, it } from "vitest";
import { isUntitledTab, newUntitledPath, suggestedFileName, untitledTitle } from "./untitledTabs";

describe("untitled tab paths", () => {
  it("makes paths that are untitled tabs and never files", () => {
    const tabPath = newUntitledPath(1_700_000_000_000, () => 0.5);
    expect(tabPath).toMatch(/^untitled:[a-z0-9]+$/);
    expect(isUntitledTab(tabPath)).toBe(true);
    expect(tabPath.startsWith("/")).toBe(false);
  });

  it("gives different tabs different paths", () => {
    expect(newUntitledPath(1, () => 0.1)).not.toBe(newUntitledPath(1, () => 0.2));
    expect(newUntitledPath(1, () => 0)).toBe("untitled:10000");
  });

  it("refuses look-alikes", () => {
    expect(isUntitledTab("untitled:")).toBe(false);
    expect(isUntitledTab("untitled:a/b")).toBe(false);
    expect(isUntitledTab("/work/untitled:abc")).toBe(false);
    expect(isUntitledTab(`untitled:${"a".repeat(33)}`)).toBe(false);
  });
});

describe("untitledTitle", () => {
  it("is Untitled until there is text", () => {
    expect(untitledTitle("")).toBe("Untitled");
    expect(untitledTitle("\n  \n\t")).toBe("Untitled");
  });

  it("uses the first line with text, trimmed", () => {
    expect(untitledTitle("\n\n  Shopping list  \nmilk")).toBe("Shopping list");
    expect(untitledTitle("a\t\tb")).toBe("a b");
  });

  it("cuts a long line", () => {
    const title = untitledTitle("x".repeat(100));
    expect(title.length).toBe(32);
    expect(title.endsWith("...")).toBe(true);
  });
});

describe("suggestedFileName", () => {
  it("offers untitled.txt for no text", () => {
    expect(suggestedFileName("")).toBe("untitled.txt");
    expect(suggestedFileName("{ } ()")).toBe("untitled.txt");
  });

  it("makes the first line safe and adds .txt", () => {
    expect(suggestedFileName("Meeting notes: Monday/Tuesday")).toBe("Meeting notes Monday Tuesday.txt");
    expect(suggestedFileName("function foo() {")).toBe("function foo.txt");
  });

  it("keeps an extension already typed", () => {
    expect(suggestedFileName("todo.md\n- one")).toBe("todo.md");
  });

  it("drops leading dots so the file is not hidden", () => {
    expect(suggestedFileName("...env")).toBe("env.txt");
  });
});
