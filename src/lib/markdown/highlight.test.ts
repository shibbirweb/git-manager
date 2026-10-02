import { javascriptLanguage } from "@codemirror/lang-javascript";
import { describe, expect, it, vi } from "vitest";
import { CodeHighlighter, fenceExtension, fenceLanguages, highlightToHtml } from "./highlight";

describe("code highlighting", () => {
  it("maps fence names to editor languages", () => {
    expect(fenceExtension("TypeScript")).toBe("ts");
    expect(fenceExtension("rust")).toBe("rs");
    expect(fenceExtension("yml")).toBe("yaml");
    expect(fenceExtension("brainfuck")).toBeNull();
  });

  it("emits tok classes and escapes the code", () => {
    const html = highlightToHtml('const a = "<b>";\nlet b = 1;', javascriptLanguage.parser);
    expect(html).toContain('<span class="tok-keyword">const</span>');
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("<b>");
    expect(html.split("\n")).toHaveLength(2);
  });

  it("finds the languages of fenced blocks", () => {
    expect(fenceLanguages("```ts\na\n```\n\n~~~ Rust\nb\n~~~\n    ```js\n```ts title\n````\n")).toEqual(["ts", "rust"]);
  });

  it("preloads grammars so the first render is highlighted", async () => {
    const loadParser = vi.fn(async () => javascriptLanguage.parser);
    const highlighter = new CodeHighlighter(loadParser, () => {});
    await highlighter.preload(["js", "javascript", "unknown"]);
    expect(loadParser).toHaveBeenCalledTimes(1);
    expect(highlighter.highlight("let x;", "js")).toContain("tok-keyword");
  });

  it("loads a grammar once, then highlights from the cache", async () => {
    const loadParser = vi.fn(async () => javascriptLanguage.parser);
    const onReady = vi.fn();
    const highlighter = new CodeHighlighter(loadParser, onReady);
    expect(highlighter.highlight("let x = 1;", "js")).toBeNull();
    expect(highlighter.highlight("let y = 2;", "javascript")).toBeNull();
    await Promise.resolve();
    await Promise.resolve();
    expect(loadParser).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledTimes(1);
    const first = highlighter.highlight("let x = 1;", "js");
    expect(first).toContain("tok-keyword");
    expect(highlighter.highlight("let x = 1;", "js")).toBe(first);
    expect(highlighter.highlight("plain", "text")).toBeNull();
  });
});
