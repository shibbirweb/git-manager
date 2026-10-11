// Adapted from Orca (github.com/stablyai/orca), MIT License: see LICENSE-ORCA.
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { encodeRawMarkdownHtmlForRichEditor } from "./raw-markdown-html";
import { createRichMarkdownExtensions } from "./rich-markdown-extensions";
import { createRichMarkdownEditorCodec } from "./rich-markdown-source-transport";

function roundTripMarkdown(content: string): string {
  const codec = createRichMarkdownEditorCodec();
  const editor = new Editor({
    element: null,
    extensions: createRichMarkdownExtensions({ codec }),
    content: encodeRawMarkdownHtmlForRichEditor(content, codec),
    contentType: "markdown",
  });

  try {
    // Why: markdown serialization walks the document without running
    // NodeType.checkContent, so it emits byte-identical output from a
    // schema-invalid document that would crash on the user's next keystroke.
    editor.state.doc.check();
    return editor.getMarkdown().trimEnd();
  } finally {
    editor.destroy();
  }
}

function markdownAfterTextReplace(content: string, search: string, replacement: string): string {
  const codec = createRichMarkdownEditorCodec();
  const editor = new Editor({
    element: null,
    extensions: createRichMarkdownExtensions({ codec }),
    content: encodeRawMarkdownHtmlForRichEditor(content, codec),
    contentType: "markdown",
  });

  try {
    let from = -1;
    editor.state.doc.descendants((node, pos) => {
      if (from !== -1 || !node.isText || !node.text) {
        return;
      }
      const index = node.text.indexOf(search);
      if (index !== -1) {
        from = pos + index;
      }
    });
    if (from === -1) {
      throw new Error(`Missing text: ${search}`);
    }
    editor.view.dispatch(editor.state.tr.insertText(replacement, from, from + search.length));
    return editor.getMarkdown().trimEnd();
  } finally {
    editor.destroy();
  }
}

function markdownAfterTypingBesideImage(content: string, typed: string): string {
  const codec = createRichMarkdownEditorCodec();
  const editor = new Editor({
    element: null,
    extensions: createRichMarkdownExtensions({ codec }),
    content: encodeRawMarkdownHtmlForRichEditor(content, codec),
    contentType: "markdown",
  });

  try {
    let after = -1;
    editor.state.doc.descendants((node, pos) => {
      if (after === -1 && node.type.name === "image") {
        after = pos + node.nodeSize;
      }
    });
    if (after === -1) {
      throw new Error("Missing image node");
    }
    editor.view.dispatch(editor.state.tr.insertText(typed, after, after));
    return editor.getMarkdown().trimEnd();
  } finally {
    editor.destroy();
  }
}

describe("rich markdown round trip", () => {
  it("preserves inline html inside paragraphs", () => {
    expect(roundTripMarkdown("Before <span>hi</span> after\n")).toBe("Before <span>hi</span> after");
  });

  it("preserves mdx-like inline tags", () => {
    expect(roundTripMarkdown("Use <Widget /> today\n")).toBe("Use <Widget /> today");
  });

  it("preserves block html and comments", () => {
    expect(roundTripMarkdown("<div>block</div>\n")).toBe("<div>block</div>");
    expect(roundTripMarkdown("<!-- comment -->\n")).toBe("<!-- comment -->");
  });

  it("preserves details blocks with raw html as passthrough html", () => {
    const input = "<details><summary><span>Toggle</span></summary><p><em>Body</em></p></details>\n";
    expect(roundTripMarkdown(input)).toBe(input.trimEnd());
  });

  it.each(['class="ORCA-DETAILS"', "CLASS='Orca-Details'", "Class=ORCA-DETAILS"])(
    "preserves details with case-sensitive %s as passthrough html",
    (attributes) => {
      const input = `<details ${attributes}><summary>Toggle</summary><p>Body</p></details>`;

      expect(roundTripMarkdown(input)).toBe(input);
    },
  );

  it("preserves details blocks with unsupported attributes as passthrough html", () => {
    const input = '<details id="x"><summary class="s">Toggle</summary><p data-x="1">Body</p></details>\n';
    expect(roundTripMarkdown(input)).toBe(input.trimEnd());
  });

  it("preserves details blocks with unsupported toggle variants as passthrough html", () => {
    const input = '<details data-orca-toggle="heading-6"><summary>Toggle</summary><p>Body</p></details>\n';
    expect(roundTripMarkdown(input)).toBe(input.trimEnd());
  });

  it("preserves details blocks with closing tags inside fenced code as passthrough html", () => {
    const input = ["<details><summary>Toggle</summary>", "", "```", "</details>", "```", "", "</details>", ""].join(
      "\n",
    );
    expect(roundTripMarkdown(input)).toBe(input.trimEnd());
  });

  it("preserves a nested toggle that is not itself editable as passthrough html", () => {
    const input =
      '<details><summary>Outer</summary><details id="x"><summary>Inner</summary><p>Body</p></details></details>\n';
    expect(roundTripMarkdown(input)).toBe(input.trimEnd());
  });

  it("preserves loose details and summary tags as passthrough html", () => {
    expect(roundTripMarkdown("<summary>Loose</summary>\n")).toBe("<summary>Loose</summary>");
    expect(roundTripMarkdown("<details>\n")).toBe("<details>");
  });

  it("preserves markdown tables", () => {
    expect(roundTripMarkdown("| a | b |\n| - | - |\n| 1 | 2 |\n")).toContain("| a");
  });

  it("preserves encoded local image paths with screenshot filenames", () => {
    expect(roundTripMarkdown("![](Screenshot%202026-06-22%20at%203.37.19%20PM%20copy.png)\n")).toBe(
      "![](Screenshot%202026-06-22%20at%203.37.19%20PM%20copy.png)",
    );
  });

  it("preserves an image that sits mid-sentence inside a paragraph", () => {
    expect(roundTripMarkdown("Install the ![icon](icon.png) extension\n")).toBe(
      "Install the ![icon](icon.png) extension",
    );
  });

  it("preserves a mid-sentence image after an editor transaction", () => {
    expect(markdownAfterTextReplace("Install the ![icon](icon.png) extension\n", "extension", "add-on")).toBe(
      "Install the ![icon](icon.png) add-on",
    );
  });

  it("preserves a standalone image as its own block", () => {
    expect(roundTripMarkdown("Intro\n\n![shot](shot.png)\n\nOutro\n")).toBe("Intro\n\n![shot](shot.png)\n\nOutro");
    // Typing beside the image must join its paragraph instead of opening a new block,
    // which only holds while the standalone image stays wrapped in a paragraph.
    expect(markdownAfterTypingBesideImage("Intro\n\n![shot](shot.png)\n\nOutro\n", "X")).toBe(
      "Intro\n\n![shot](shot.png)X\n\nOutro",
    );
  });

  it("preserves images nested in list items and table cells", () => {
    expect(roundTripMarkdown("- step ![shot](shot.png)\n")).toBe("- step ![shot](shot.png)");
    expect(roundTripMarkdown("| a |\n| - |\n| ![shot](shot.png) |\n")).toContain("![shot](shot.png)");
    expect(markdownAfterTextReplace("- step ![shot](shot.png)\n", "step", "stage")).toBe("- stage ![shot](shot.png)");
    expect(markdownAfterTextReplace("| a |\n| - |\n| b ![shot](shot.png) |\n", "b ", "c ")).toContain(
      "![shot](shot.png)",
    );
  });

  it("preserves links whose label is inline code", () => {
    expect(roundTripMarkdown("Link to [`foo.md`](./foo.md) here\n")).toBe("Link to [`foo.md`](./foo.md) here");
  });

  it("preserves links whose label is inline code after an editor transaction", () => {
    expect(markdownAfterTextReplace("Link to [`foo.md`](./foo.md) here\n", "here", "here saved")).toBe(
      "Link to [`foo.md`](./foo.md) here saved",
    );
  });

  it("preserves links when editing inside an inline-code label", () => {
    expect(markdownAfterTextReplace("Link to [`foo.md`](./foo.md) here\n", "foo", "bar")).toBe(
      "Link to [`bar.md`](./foo.md) here",
    );
  });

  it("preserves titled links whose label is inline code", () => {
    expect(roundTripMarkdown('Link to [`foo.md`](./foo.md "Foo") here\n')).toBe(
      'Link to [`foo.md`](./foo.md "Foo") here',
    );
  });

  it("preserves bold link labels as formatted link text", () => {
    expect(roundTripMarkdown("Link to [**bold**](./foo.md) here\n")).toBe("Link to [**bold**](./foo.md) here");
  });

  it("does not surface Linear issue reference definitions as description text", () => {
    const input = [
      "- [x] [H-279]",
      "- [ ] [H-284]",
      "",
      '[H-279]: https://linear.app/acme/issue/H-279/child-one "Child one"',
      '[H-284]: https://linear.app/acme/issue/H-284/child-two "Child two"',
      "",
    ].join("\n");

    expect(roundTripMarkdown(input)).toBe(
      [
        '- [x] [H-279](https://linear.app/acme/issue/H-279/child-one "Child one")',
        '- [ ] [H-284](https://linear.app/acme/issue/H-284/child-two "Child two")',
      ].join("\n"),
    );
  });

  it("preserves aligned task-item continuations before nested bullets", () => {
    const input = [
      "- [ ] Complete the provider action map used by the",
      "      unchanged UI:",
      "  - review creation and eligibility;",
      "  - merge and auto-merge.",
      "- [ ] Keep provider behavior explicit.",
    ].join("\n");

    expect(roundTripMarkdown(input)).toBe(
      [
        "- [ ] Complete the provider action map used by the",
        "",
        "  unchanged UI:",
        "  - review creation and eligibility;",
        "  - merge and auto-merge.",
        "- [ ] Keep provider behavior explicit.",
      ].join("\n"),
    );
  });

  it("preserves blank-separated indented code inside task items", () => {
    expect(roundTripMarkdown("- [ ] Run this:\n\n      echo ok\n")).toContain("```");
  });
});
