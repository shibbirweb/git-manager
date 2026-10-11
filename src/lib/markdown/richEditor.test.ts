// @vitest-environment happy-dom
// The rich editor on real files: every Markdown page of docs/wiki, README.md, CHANGELOG.md and a set of messy
// samples. A file the editor takes is loaded and saved without an edit (nothing may be written), then one
// character is typed into a paragraph (only that character may change in the text). A file it refuses must say why.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";
import { RichMarkdownEditor } from "./richEditor";
import { applyEdit, type SourceEdit } from "./richSync";

const root = join(__dirname, "..", "..", "..");

function corpus(): { name: string; text: string }[] {
  const files: { name: string; text: string }[] = [];
  for (const folder of ["docs/wiki/usage", "docs/wiki/developer"]) {
    for (const name of readdirSync(join(root, folder)).filter((file) => file.endsWith(".md"))) {
      files.push({ name: `${folder}/${name}`, text: readFileSync(join(root, folder, name), "utf8") });
    }
  }
  for (const name of ["README.md", "CHANGELOG.md"]) {
    files.push({ name, text: readFileSync(join(root, name), "utf8") });
  }
  return files;
}

/** Files written to break things: mixed markers, odd spacing, CRLF, raw HTML, front matter, emoji. */
const MESSY: Record<string, string> = {
  "mixed list markers": "* one\n* two\n\n+ three\n+ four\n\n1) five\n2) six\n",
  "emphasis styles": "Some __bold__ and _italic_ and ***both*** text.\n\nAnother *line* here.\n",
  "setext and closed headings": "Title\n=====\n\nSub\n---\n\n## Closed ##\n\nBody text.\n",
  "padded table":
    "| Name   | Count |\n|:-------|------:|\n| apples |     3 |\n| pears  |    12 |\n\nAfter the table.\n",
  "tilde fences": "Before.\n\n~~~ts\nconst a = 1;\n~~~\n\nAfter the code.\n",
  "crlf file": "# Title\r\n\r\nFirst paragraph.\r\n\r\n- a\r\n- b\r\n",
  "hard breaks": "Line one  \nline two\\\nline three\n\nNext paragraph.\n",
  "front matter": "---\ntitle: Notes\ntags: [a, b]\n---\n\n# Notes\n\nSome text.\n",
  "details html": "Intro text.\n\n<details>\n<summary>More</summary>\n\nHidden body.\n\n</details>\n\nOutro text.\n",
  "badges and inline html": '<p align="center"><img src="logo.png" width="80"></p>\n\nA <kbd>Cmd</kbd> key.\n',
  "tasks and nesting": "- [ ] todo\n- [x] done\n  - nested *item*\n\nText after the list.\n",
  "emoji and unicode": "Grüße 😀 and 中文 text.\n\n> A quote with `code`.\n",
  "no trailing newline": "Just one paragraph without a newline",
  "html after a tilde fence":
    "Before.\n\n~~~ts\nconst a = 1;\n~~~\n\n<details>\n<summary>More</summary>\n\nBody.\n\n</details>\n",
  "many blank lines": "First.\n\n\n\nSecond.\n",
};

const REFUSED: Record<string, string> = {
  "reference links": "See [the docs][docs].\n\n[docs]: https://example.com\n",
  footnotes: "A claim.[^1]\n\n[^1]: The source.\n",
};

interface Session {
  rich: RichMarkdownEditor;
  edits: SourceEdit[];
  readOnly: string[];
}

let sessions: RichMarkdownEditor[] = [];

afterEach(() => {
  for (const rich of sessions) {
    rich.destroy();
  }
  sessions = [];
  document.body.innerHTML = "";
});

async function open(source: string): Promise<Session> {
  const scroller = document.createElement("div");
  const element = document.createElement("div");
  scroller.appendChild(element);
  document.body.appendChild(scroller);
  const edits: SourceEdit[] = [];
  const readOnly: string[] = [];
  const rich = await RichMarkdownEditor.create(element, {
    source,
    onEdit: (edit) => edits.push(edit),
    onReadOnly: (reason) => readOnly.push(reason),
    linkContext: () => ({ documentPath: "/repo/README.md", rootPath: "/repo", isInWorkspace: () => true }),
    loadImage: () => Promise.resolve("data:image/png;base64,"),
    isDark: () => false,
  });
  sessions.push(rich);
  return { rich, edits, readOnly };
}

function tiptap(rich: RichMarkdownEditor): Editor {
  return (rich as unknown as { editor: Editor }).editor;
}

/** Types `text` at the start of the first top-level paragraph of plain words, as a person would. */
function typeInFirstParagraph(rich: RichMarkdownEditor, text: string): boolean {
  const editor = tiptap(rich);
  let at = -1;
  editor.state.doc.forEach((node, offset) => {
    if (at < 0 && node.type.name === "paragraph" && /^[A-Za-z]{3}/.test(node.textContent)) {
      at = offset + 1;
    }
  });
  if (at < 0) {
    return false;
  }
  editor.view.dispatch(editor.state.tr.insertText(text, at));
  return true;
}

function written(source: string, edits: SourceEdit[]): string {
  return edits.reduce((text, edit) => applyEdit(text, edit), source);
}

/** The text with one insertion: what changed between `before` and `after` must be exactly `inserted`. */
function onlyInserted(before: string, after: string, inserted: string): boolean {
  let start = 0;
  while (start < before.length && before[start] === after[start]) {
    start++;
  }
  return after.slice(0, start) + after.slice(start + inserted.length) === before
    ? after.slice(start, start + inserted.length) === inserted
    : false;
}

describe("the rich editor keeps existing files", () => {
  const files = [...corpus(), ...Object.entries(MESSY).map(([name, text]) => ({ name: `messy: ${name}`, text }))];

  it.each(files.map((file) => [file.name, file.text]))("%s", async (_name, text) => {
    const session = await open(text);
    if (session.readOnly.length > 0) {
      // A refused file says why and is never written.
      expect(session.readOnly[0]).toMatch(/Edit it in the text editor/);
      return;
    }
    session.rich.flush();
    expect(session.edits).toEqual([]);
    if (!typeInFirstParagraph(session.rich, "Q")) {
      return;
    }
    session.rich.flush();
    const after = written(text, session.edits);
    expect(onlyInserted(text, after, "Q")).toBe(true);
  });
});

describe("the rich editor takes HTML blocks whole", () => {
  it("keeps an indented HTML table (the README's screenshot grid) editable around it", async () => {
    const text =
      'Intro text.\n\n<table>\n  <tr>\n    <td width="50%"><img src="a.png"><br><b>A</b></td>\n  </tr>\n</table>\n\nOutro text.\n';
    const session = await open(text);
    expect(session.readOnly).toEqual([]);
    typeInFirstParagraph(session.rich, "Q");
    session.rich.flush();
    expect(written(text, session.edits)).toBe(`Q${text}`);
  });

  it("opens the repository's README for editing", async () => {
    const session = await open(readFileSync(join(root, "README.md"), "utf8"));
    expect(session.readOnly).toEqual([]);
  });
});

describe("the caret", () => {
  it("starts at the top of a newly opened file and stays put when the text reloads", async () => {
    const session = await open("# Title\n\nFirst paragraph.\n\nLast paragraph.\n");
    const editor = tiptap(session.rich);
    expect(editor.state.selection.from).toBe(1);
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 12)));
    session.rich.setSource("# Title\n\nFirst paragraph, changed.\n\nLast paragraph.\n");
    expect(tiptap(session.rich).state.selection.from).toBe(12);
  });
});

describe("the rich editor refuses what it cannot keep", () => {
  it.each(Object.entries(REFUSED))("%s", async (_name, text) => {
    const session = await open(text);
    expect(session.readOnly[0]).toMatch(/Edit it in the text editor/);
  });
});

describe("the rich editor's own edits", () => {
  it("ticks a task box by changing only its marker", async () => {
    const text = "Plan:\n\n- [ ] first\n- [ ] second\n";
    const session = await open(text);
    const editor = tiptap(session.rich);
    let at = -1;
    editor.state.doc.descendants((node, position) => {
      if (at < 0 && node.type.name === "taskItem") {
        at = position;
      }
      return at < 0;
    });
    const item = editor.state.doc.nodeAt(at)!;
    editor.view.dispatch(editor.state.tr.setNodeMarkup(at, undefined, { ...item.attrs, checked: true }));
    session.rich.flush();
    expect(written(text, session.edits)).toBe("Plan:\n\n- [x] first\n- [ ] second\n");
  });

  it("loads text changed elsewhere without writing it back", async () => {
    const session = await open("# One\n\nText.\n");
    session.rich.setSource("# One\n\nText changed elsewhere.\n");
    session.rich.flush();
    expect(session.edits).toEqual([]);
  });
});
