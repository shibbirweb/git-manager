import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
// The rules after the header comment, which says where each copy is used.
const rules = (css: string) => css.slice(css.indexOf("*/") + 2).trim();

// The rich editor's rules in the app's component, unscoped from Svelte (:global) and unindented, as the library
// file holds them.
function richRules(svelte: string): string {
  const style = /<style>([\s\S]*?)<\/style>/.exec(svelte)?.[1] ?? "";
  return style
    .slice(style.indexOf("  /* ProseMirror needs these"))
    .replace(/:global\(([^{]*?)\)(?=\s*(,|\{))/g, "$1")
    .split("\n")
    .map((line) => (line.startsWith("  ") ? line.slice(2) : line))
    .join("\n")
    .trim();
}

describe("markdown.css", () => {
  it("keeps the same rules as the app's preview (src/lib/markdown/body.css)", () => {
    expect(rules(read("./markdown.css"))).toBe(rules(read("../../../../../src/lib/markdown/body.css")));
  });
});

describe("markdown-rich.css", () => {
  it("keeps the same rules as the app's rich editor (RichMarkdownView.svelte)", () => {
    const app = richRules(read("../../../../../src/lib/views/files/RichMarkdownView.svelte"));
    expect(rules(read("./markdown-rich.css"))).toBe(app);
  });
});
