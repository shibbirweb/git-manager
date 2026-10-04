import { describe, expect, it } from "vitest";
import type { PaletteItem } from "$lib/commands/registry";
import { pathRows } from "$lib/search/fileSearchModel";
import type { OutlineItem } from "$lib/types";
import {
  commandRows,
  fileRows,
  firstSelectableRow,
  helpRows,
  isSelectableRow,
  lineRow,
  matchingRecent,
  moveSelectableRow,
  outlineRows,
  parseGoToLine,
  parsePickQuery,
  parseQuickOpen,
  type QuickRow,
  recentOrder,
} from "./quickOpenModel";

const folders = [{ root: "/repo", name: "repo" }];

describe("parsePickQuery", () => {
  it("searches files only while picking a file", () => {
    expect(parsePickQuery(" >notes.md ")).toEqual({ mode: "files", prefix: "", text: ">notes.md" });
    expect(parsePickQuery("@x")).toEqual({ mode: "files", prefix: "", text: "@x" });
  });
});

describe("parseQuickOpen", () => {
  it("picks the mode from the first character", () => {
    expect(parseQuickOpen("")).toEqual({ mode: "files", prefix: "", text: "" });
    expect(parseQuickOpen(" cart.ts ")).toEqual({ mode: "files", prefix: "", text: "cart.ts" });
    expect(parseQuickOpen(">git push")).toEqual({ mode: "commands", prefix: ">", text: "git push" });
    expect(parseQuickOpen("> ")).toEqual({ mode: "commands", prefix: ">", text: "" });
    expect(parseQuickOpen(":120:5")).toEqual({ mode: "line", prefix: ":", text: "120:5" });
    expect(parseQuickOpen("@render")).toEqual({ mode: "symbols", prefix: "@", text: "render" });
    expect(parseQuickOpen("#Cart")).toEqual({ mode: "workspaceSymbols", prefix: "#", text: "Cart" });
    expect(parseQuickOpen("?")).toEqual({ mode: "help", prefix: "?", text: "" });
  });

  it("switches back to files once the prefix is deleted or not first", () => {
    expect(parseQuickOpen("git push").mode).toBe("files");
    expect(parseQuickOpen(" >git").mode).toBe("files");
    // "name:42" is a file with a line, not Go to Line.
    expect(parseQuickOpen("cart.ts:42")).toEqual({ mode: "files", prefix: "", text: "cart.ts:42" });
  });

  it("lists every prefix in help", () => {
    expect(helpRows().map((row) => (row.kind === "help" ? row.prefix : null))).toEqual(["", ">", ":", "@", "#", "?"]);
  });
});

describe("Go to Line", () => {
  it("parses a line and an optional column", () => {
    expect(parseGoToLine("120")).toEqual({ line: 120, column: null });
    expect(parseGoToLine("120:5")).toEqual({ line: 120, column: 5 });
    expect(parseGoToLine(" 120 , 5 ")).toEqual({ line: 120, column: 5 });
    // While typing the column.
    expect(parseGoToLine("120:")).toEqual({ line: 120, column: null });
    expect(parseGoToLine("0")).toEqual({ line: 1, column: null });
    expect(parseGoToLine("")).toBeNull();
    expect(parseGoToLine("abc")).toBeNull();
    expect(parseGoToLine("12:x")).toBeNull();
    expect(parseGoToLine("99999999999999999999")).toBeNull();
  });

  it("describes where Enter goes, clamped to the document", () => {
    const caret = { line: 12, column: 4, lineCount: 340 };
    expect(lineRow("", caret)).toEqual({ label: "Current line: 12, column 4. Type a line number between 1 and 340.", target: null });
    expect(lineRow("120", caret)).toEqual({ label: "Go to line 120", target: { line: 120, column: 1 } });
    expect(lineRow("120:5", caret)).toEqual({ label: "Go to line 120, column 5", target: { line: 120, column: 5 } });
    expect(lineRow("9000", caret).target).toEqual({ line: 340, column: 1 });
    expect(lineRow("x", caret).target).toBeNull();
    expect(lineRow("10", null)).toEqual({ label: "Open a text editor to go to a line", target: null });
  });
});

describe("outlineRows", () => {
  const items: OutlineItem[] = [
    { name: "Cart", kind: "class", container: null, line: 1, column: 1, depth: 0 },
    { name: "addItem", kind: "method", container: "Cart", line: 2, column: 3, depth: 1 },
    { name: "total", kind: "function", container: null, line: 9, column: 1, depth: 0 },
    { name: "Install", kind: "heading", container: null, line: 12, column: 1, depth: 1 },
  ];

  it("keeps file order and nesting without a query", () => {
    const rows = outlineRows(items, "");
    expect(rows.map((row) => [row.line, row.depth])).toEqual([
      [1, 0],
      [2, 1],
      [9, 0],
      [12, 1],
    ]);
    expect(rows[0].kind.letter).toBe("C");
    expect(rows[3].kind.label).toBe("Heading");
  });

  it("filters by name, best first, with highlights", () => {
    const rows = outlineRows(items, "add");
    expect(rows.map((row) => row.line)).toEqual([2]);
    expect(rows[0].nameParts).toEqual([
      { text: "add", match: true },
      { text: "Item", match: false },
    ]);
    expect(outlineRows(items, "t").map((row) => row.line)[0]).toBe(9);
    expect(outlineRows(items, "zzz")).toEqual([]);
  });

  it("caps the rows", () => {
    const many = Array.from({ length: 50 }, (_, index) => ({ ...items[2], name: `f${index}`, line: index + 1 }));
    expect(outlineRows(many, "", 10)).toHaveLength(10);
    expect(outlineRows(many, "f", 10)).toHaveLength(10);
  });
});

describe("recent files", () => {
  it("puts the file on screen last", () => {
    expect(recentOrder(["/repo/a", "/repo/b", "/repo/c"], "/repo/a")).toEqual(["/repo/b", "/repo/c", "/repo/a"]);
    expect(recentOrder(["/repo/a"], "/repo/z")).toEqual(["/repo/a"]);
    expect(recentOrder(["/repo/a"], null)).toEqual(["/repo/a"]);
  });

  it("matches recent files by folder and name", () => {
    const rows = pathRows(["/repo/src/cart.ts", "/repo/src/lib/App.svelte", "/repo/README.md"], folders);
    expect(matchingRecent(rows, "").map((row) => row.path)).toHaveLength(3);
    const app = matchingRecent(rows, "app");
    expect(app.map((row) => row.path)).toEqual(["/repo/src/lib/App.svelte"]);
    expect(app[0].nameParts[0]).toEqual({ text: "App", match: true });
    expect(matchingRecent(rows, "srcart").map((row) => row.path)).toEqual(["/repo/src/cart.ts"]);
    expect(matchingRecent(rows, "nothing")).toEqual([]);
  });

  it("lists recent files first and the other results without repeats", () => {
    const recent = pathRows(["/repo/src/cart.ts"], folders);
    const results = pathRows(["/repo/src/cart.ts", "/repo/src/cart.test.ts"], folders);
    const rows = fileRows(recent, results, true);
    expect(rows.map((row) => row.key)).toEqual(["h:recent", "r:/repo/src/cart.ts", "h:files", "f:/repo/src/cart.test.ts"]);
    expect(fileRows([], results, true).map((row) => row.kind)).toEqual(["file", "file"]);
    expect(fileRows(recent, results, false).map((row) => row.key)).toEqual(["h:recent", "r:/repo/src/cart.ts"]);
  });
});

function command(commandId: string, enabled = true): PaletteItem {
  return {
    key: commandId,
    commandId: commandId as PaletteItem["commandId"],
    categoryParts: [],
    titleParts: [],
    shortcut: null,
    enabled,
    checked: null,
    reason: enabled ? null : "Not available now",
  };
}

describe("rows and selection", () => {
  it("heads the recently used commands", () => {
    const rows = commandRows([command("git.push")], [command("git.pull"), command("git.fetch", false)]);
    expect(rows.map((row) => row.key)).toEqual(["h:recent", "r:git.push", "h:other", "c:git.pull", "c:git.fetch"]);
    expect(commandRows([], [command("git.pull")]).map((row) => row.kind)).toEqual(["command"]);
  });

  it("skips headings and messages, wrapping single steps", () => {
    const rows: QuickRow[] = commandRows([command("a")], [command("b"), command("c")]);
    expect(firstSelectableRow(rows)).toBe(1);
    expect(moveSelectableRow(rows, 1, 1)).toBe(3);
    expect(moveSelectableRow(rows, 4, 1)).toBe(1);
    expect(moveSelectableRow(rows, 1, -1)).toBe(4);
    expect(moveSelectableRow(rows, 1, 10)).toBe(4);
    const message: QuickRow[] = [{ kind: "message", key: "message", label: "Nothing" }];
    expect(moveSelectableRow(message, 0, 1)).toBe(0);
    expect(isSelectableRow({ kind: "line", key: "line", label: "x", target: null })).toBe(false);
    expect(isSelectableRow({ kind: "line", key: "line", label: "x", target: { line: 1, column: 1 } })).toBe(true);
  });
});
