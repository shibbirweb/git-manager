import { javascript } from "@codemirror/lang-javascript";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { bracketDecorations, openBracketsAt } from "./bracketColors";

function colored(doc: string, from = 0, to = doc.length): string[] {
  const state = EditorState.create({ doc, extensions: [javascript()] });
  ensureSyntaxTree(state, state.doc.length, 5000);
  const found: string[] = [];
  bracketDecorations(state, [{ from, to }]).between(0, doc.length, (start, _end, decoration) => {
    found.push(`${doc[start]}${String(decoration.spec.class).replace("cm-gm-bracket-", "")}`);
  });
  return found;
}

describe("bracket colors", () => {
  it("colors code brackets by depth and skips strings and comments", () => {
    expect(colored("f(a[1], { b: '(' }) // )")).toEqual(["(1", "[2", "]2", "{2", "}2", ")1"]);
  });

  it("knows the depth at the top of the screen from the nodes around it", () => {
    const doc = "function f() {\n  if (x) {\n    g([1]);\n  }\n}\n";
    const lineStart = doc.indexOf("    g");
    const state = EditorState.create({ doc, extensions: [javascript()] });
    const tree = ensureSyntaxTree(state, state.doc.length, 5000);
    if (!tree) {
      throw new Error("the file was not parsed");
    }
    expect(openBracketsAt(tree, lineStart)).toBe(2);
    expect(colored(doc, lineStart, doc.indexOf("\n  }"))).toEqual(["(3", "[1", "]1", ")3"]);
  });

  it("colors nothing without a language", () => {
    const state = EditorState.create({ doc: "(a)" });
    expect(bracketDecorations(state, [{ from: 0, to: 3 }]).size).toBe(0);
  });
});
