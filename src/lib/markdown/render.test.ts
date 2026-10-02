import { describe, expect, it } from "vitest";
import { createRenderer, openTagBalance } from "./render";

const renderer = createRenderer({ highlight: (code, language) => (language === "js" ? `<span class="tok-keyword">${code.trim()}</span>` : null) });
const html = (source: string) =>
  renderer
    .render(source)
    .segments.map((segment) => segment.html)
    .join("");

describe("Markdown rendering", () => {
  it("marks blocks with their first source line", () => {
    const out = html("# Title\n\nText\n\n- a\n- b\n\n---\n");
    expect(out).toContain('<h1 data-line="0"');
    expect(out).toContain('<p data-line="2">Text</p>');
    expect(out).toContain('<li data-line="5">b</li>');
    expect(out).toContain('<hr data-line="7">');
  });

  it("gives headings GitHub ids with the user-content prefix", () => {
    const out = html("## Get `started`!\n\n## Get started");
    expect(out).toContain('id="user-content-get-started"');
    expect(out).toContain('id="user-content-get-started-1"');
  });

  it("renders GitHub tables, strikethrough and autolinks", () => {
    const out = html("| a | b |\n|---|---|\n| 1 | 2 |\n\n~~gone~~ see https://x.dev");
    expect(out).toContain("<table");
    expect(out).toContain('<tr data-line="2">');
    expect(out).toContain("<s>gone</s>");
    expect(out).toContain('<a href="https://x.dev">https://x.dev</a>');
  });

  it("turns task items into checkboxes with their source line", () => {
    const out = html("- [ ] todo\n- [x] done\n- [] not a task");
    expect(out).toContain('<ul data-line="0" class="contains-task-list">');
    expect(out).toContain('<li data-line="0" class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" data-task-line="0"> todo</li>');
    expect(out).toContain('data-task-line="1" checked> done');
    expect(out).toContain("<li data-line=\"2\">[] not a task</li>");
  });

  it("highlights fenced code through the hook and escapes the rest", () => {
    expect(html("```js\nlet a;\n```")).toContain('<pre class="md-code" data-line="0"><code class="language-js"><span class="tok-keyword">let a;</span></code></pre>');
    expect(html("```\n<b>\n```")).toContain("<code>&lt;b&gt;\n</code>");
  });

  it("leaves mermaid blocks as placeholders", () => {
    const result = renderer.render("text\n\n```mermaid\ngraph TD; A-->B\n```");
    expect(result.hasMermaid).toBe(true);
    expect(result.segments.map((segment) => segment.html).join("")).toContain('<div class="md-mermaid" data-line="2"><pre class="md-mermaid-source">graph TD; A--&gt;B\n</pre></div>');
    expect(renderer.render("no diagrams").hasMermaid).toBe(false);
  });

  it("keeps image paths out of src", () => {
    const out = html('![A *logo*](img/logo.png "Logo")');
    expect(out).toContain('<img data-gm-src="img/logo.png" alt="A logo" title="Logo">');
    expect(out).not.toMatch(/\ssrc=/);
  });

  it("splits the HTML into one segment per top-level block", () => {
    const { segments } = renderer.render("# A\n\ntext\n\n- one\n- two\n");
    expect(segments.map((segment) => segment.line)).toEqual([0, 2, 4]);
    expect(segments[2].html.startsWith("<ul")).toBe(true);
  });

  it("keeps raw HTML that spans blocks in one segment", () => {
    const { segments } = renderer.render('<div align="center">\n\n# Logo\n\ntext\n\n</div>\n\nafter');
    expect(segments).toHaveLength(2);
    expect(segments[0].html).toContain("<h1");
    expect(segments[0].html.trim().endsWith("</div>")).toBe(true);
    expect(segments[1].line).toBe(8);
  });

  it("tells whether a document has raw HTML", () => {
    expect(renderer.render("# Plain *text*\n\n```html\n<div>\n```").hasRawHtml).toBe(false);
    expect(renderer.render("text <b>bold</b>").hasRawHtml).toBe(true);
    expect(renderer.render("<div>\nblock\n</div>").hasRawHtml).toBe(true);
  });

  it("counts tags left open by raw HTML", () => {
    expect(openTagBalance('<div align="center">')).toBe(1);
    expect(openTagBalance("<p><img src=x><br/></p>")).toBe(0);
    expect(openTagBalance("<!-- <div> --></details>")).toBe(-1);
  });

  it("refuses javascript links, leaving the rest to the sanitizer", () => {
    expect(html("[x](javascript:alert(1))")).not.toContain("href");
  });
});
