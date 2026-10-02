import { EditorSelection, EditorState, type TransactionSpec } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  headingLevel,
  insertTable,
  setHeading,
  tableTemplate,
  toggleCodeBlock,
  toggleInline,
  toggleLinePrefix,
  toggleLink,
  toggleTaskAt,
} from "./format";

// "‸" marks a cursor, "⟨" and "⟩" a selection; several of them make several ranges.
function make(marked: string): EditorState {
  const ranges = [];
  let text = "";
  let anchor = -1;
  for (const char of marked) {
    if (char === "‸") {
      ranges.push(EditorSelection.cursor(text.length));
    } else if (char === "⟨") {
      anchor = text.length;
    } else if (char === "⟩") {
      ranges.push(EditorSelection.range(anchor, text.length));
    } else {
      text += char;
    }
  }
  return EditorState.create({
    doc: text,
    selection: EditorSelection.create(ranges.length > 0 ? ranges : [EditorSelection.cursor(0)]),
    extensions: EditorState.allowMultipleSelections.of(true),
  });
}

function show(state: EditorState): string {
  let text = state.doc.toString();
  const ranges = [...state.selection.ranges].sort((a, b) => b.from - a.from);
  for (const range of ranges) {
    text = range.empty ? `${text.slice(0, range.from)}‸${text.slice(range.from)}` : `${text.slice(0, range.from)}⟨${text.slice(range.from, range.to)}⟩${text.slice(range.to)}`;
  }
  return text;
}

function run(marked: string, command: (state: EditorState) => TransactionSpec): string {
  return show(make(marked).update(command(make(marked))).state);
}

describe("inline styles", () => {
  it("wraps a selection and unwraps it again", () => {
    expect(run("a ⟨word⟩ b", (state) => toggleInline(state, "bold"))).toBe("a **⟨word⟩** b");
    expect(run("a **⟨word⟩** b", (state) => toggleInline(state, "bold"))).toBe("a ⟨word⟩ b");
    expect(run("a ⟨**word**⟩ b", (state) => toggleInline(state, "bold"))).toBe("a ⟨word⟩ b");
    expect(run("⟨x⟩", (state) => toggleInline(state, "strikethrough"))).toBe("~~⟨x⟩~~");
    expect(run("~~⟨x⟩~~", (state) => toggleInline(state, "strikethrough"))).toBe("⟨x⟩");
    expect(run("⟨x⟩", (state) => toggleInline(state, "code"))).toBe("`⟨x⟩`");
    expect(run("`⟨x⟩`", (state) => toggleInline(state, "code"))).toBe("⟨x⟩");
  });

  it("tells italic from bold", () => {
    expect(run("**⟨word⟩**", (state) => toggleInline(state, "italic"))).toBe("***⟨word⟩***");
    expect(run("***⟨word⟩***", (state) => toggleInline(state, "italic"))).toBe("**⟨word⟩**");
    expect(run("*⟨word⟩*", (state) => toggleInline(state, "italic"))).toBe("⟨word⟩");
    expect(run("_⟨word⟩_", (state) => toggleInline(state, "italic"))).toBe("⟨word⟩");
    expect(run("*⟨word⟩*", (state) => toggleInline(state, "bold"))).toBe("***⟨word⟩***");
  });

  it("uses the word at a cursor, or inserts an empty pair", () => {
    expect(run("say he‸llo now", (state) => toggleInline(state, "bold"))).toBe("say **he‸llo** now");
    expect(run("say **he‸llo** now", (state) => toggleInline(state, "bold"))).toBe("say he‸llo now");
    expect(run("say ‸ now", (state) => toggleInline(state, "italic"))).toBe("say *‸* now");
    expect(run("say *‸* now", (state) => toggleInline(state, "italic"))).toBe("say ‸ now");
  });

  it("works on every cursor in one transaction", () => {
    expect(run("⟨one⟩ and ⟨two⟩", (state) => toggleInline(state, "bold"))).toBe("**⟨one⟩** and **⟨two⟩**");
    const state = make("⟨one⟩ and ⟨two⟩");
    const next = state.update(toggleInline(state, "code")).state;
    expect(next.doc.toString()).toBe("`one` and `two`");
  });
});

describe("links", () => {
  it("inserts, wraps text or a URL, and unwraps", () => {
    expect(run("see ‸", toggleLink)).toBe("see [‸]()");
    expect(run("see ⟨docs⟩", toggleLink)).toBe("see [docs](‸)");
    expect(run("see ⟨https://x.dev⟩", toggleLink)).toBe("see [‸](https://x.dev)");
    expect(run("see ⟨[docs](https://x.dev)⟩", toggleLink)).toBe("see ⟨docs⟩");
  });
});

describe("headings", () => {
  it("reads heading levels", () => {
    expect(headingLevel("## Title")).toBe(2);
    expect(headingLevel("#hashtag")).toBe(0);
    expect(headingLevel("#")).toBe(1);
  });

  it("sets, changes and removes a heading", () => {
    expect(run("Ti‸tle", (state) => setHeading(state, 1))).toBe("# Ti‸tle");
    expect(run("# Ti‸tle", (state) => setHeading(state, 2))).toBe("## Ti‸tle");
    expect(run("## Ti‸tle", (state) => setHeading(state, 2))).toBe("Ti‸tle");
    expect(run("### Ti‸tle", (state) => setHeading(state, 0))).toBe("Ti‸tle");
  });

  it("applies to every selected line", () => {
    expect(run("⟨one\ntwo⟩", (state) => setHeading(state, 3))).toBe("### ⟨one\n### two⟩");
  });
});

describe("line prefixes", () => {
  it("adds and removes bullets", () => {
    expect(run("⟨one\ntwo⟩", (state) => toggleLinePrefix(state, "bullet"))).toBe("- ⟨one\n- two⟩");
    expect(run("⟨- one\n- two⟩", (state) => toggleLinePrefix(state, "bullet"))).toBe("⟨one\ntwo⟩");
  });

  it("numbers lines and switches list kinds", () => {
    expect(run("⟨one\ntwo\nthree⟩", (state) => toggleLinePrefix(state, "ordered"))).toBe("1. ⟨one\n2. two\n3. three⟩");
    expect(run("⟨- one\n- two⟩", (state) => toggleLinePrefix(state, "ordered"))).toBe("⟨1. one\n2. two⟩");
    expect(run("⟨1. one\n2. two⟩", (state) => toggleLinePrefix(state, "task"))).toBe("⟨- [ ] one\n- [ ] two⟩");
    expect(run("⟨- [x] one⟩", (state) => toggleLinePrefix(state, "task"))).toBe("⟨one⟩");
    expect(run("⟨- [ ] one⟩", (state) => toggleLinePrefix(state, "bullet"))).toBe("⟨- one⟩");
  });

  it("keeps indentation and skips blank lines among several", () => {
    expect(run("⟨  one\n\n  two⟩", (state) => toggleLinePrefix(state, "bullet"))).toBe("⟨  - one\n\n  - two⟩");
    expect(run("‸", (state) => toggleLinePrefix(state, "bullet"))).toBe("- ‸");
  });

  it("does not touch the line a selection ends at the start of", () => {
    expect(run("⟨one\n⟩two", (state) => toggleLinePrefix(state, "quote"))).toBe("> ⟨one\n⟩two");
  });

  it("quotes and unquotes", () => {
    expect(run("⟨one\ntwo⟩", (state) => toggleLinePrefix(state, "quote"))).toBe("> ⟨one\n> two⟩");
    expect(run("⟨> one\n>two⟩", (state) => toggleLinePrefix(state, "quote"))).toBe("⟨one\ntwo⟩");
  });
});

describe("code blocks", () => {
  it("fences selected lines and removes the fences again", () => {
    expect(run("⟨let a;\nlet b;⟩", toggleCodeBlock)).toBe("```\n⟨let a;\nlet b;⟩\n```");
    expect(run("```\n⟨let a;⟩\n```", toggleCodeBlock)).toBe("⟨let a;⟩");
    expect(run("⟨```\nlet a;\n```⟩", toggleCodeBlock)).toBe("⟨let a;⟩");
  });

  it("inserts an empty block at a cursor", () => {
    expect(run("‸", toggleCodeBlock)).toBe("```\n‸\n```");
    expect(run("te‸xt", toggleCodeBlock)).toBe("text\n```\n‸\n```");
  });
});

describe("tables", () => {
  it("builds a template", () => {
    expect(tableTemplate(2, 1)).toBe("| Column 1 | Column 2 |\n| -------- | -------- |\n|          |          |");
  });

  it("inserts a 3 column table and selects the first header", () => {
    const table = tableTemplate(3, 2);
    expect(run("‸", (state) => insertTable(state))).toBe(`| ⟨Column 1⟩${table.slice("| Column 1".length)}`);
    const after = run("Intro‸\nNext", (state) => insertTable(state));
    expect(after.startsWith("Intro\n\n| ⟨Column 1⟩ | Column 2 | Column 3 |\n")).toBe(true);
    expect(after.endsWith("|\n\nNext")).toBe(true);
  });
});

describe("task items", () => {
  it("ticks and unticks a task on a line", () => {
    const state = make("- [ ] one\n  - [x] two\n> 1. [ ] three\nplain");
    const apply = (lineIndex: number) => {
      const spec = toggleTaskAt(state, lineIndex);
      return spec ? state.update(spec).state.doc.line(lineIndex + 1).text : null;
    };
    expect(apply(0)).toBe("- [x] one");
    expect(apply(1)).toBe("  - [ ] two");
    expect(apply(2)).toBe("> 1. [x] three");
    expect(apply(3)).toBeNull();
    expect(apply(9)).toBeNull();
  });
});
