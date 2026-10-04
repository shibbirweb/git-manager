import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { headerLines, headingLevel, headingScopes, indentScopes, onlyOpensBlock, stickyLinesFor } from "./stickyScope";
import { scopeSource } from "./stickyScroll";

function textOf(lines: string[]): (lineNumber: number) => string {
  return (lineNumber) => lines[lineNumber - 1] ?? "";
}

function stickyAt(doc: string, topLine: number, extensions: Extension[]): number[] {
  const state = EditorState.create({ doc, extensions });
  ensureSyntaxTree(state, state.doc.length, 5000);
  const lineText = (lineNumber: number) => state.doc.line(lineNumber).text;
  return headerLines(scopeSource(state)(topLine), topLine, lineText);
}

describe("sticky scroll scopes", () => {
  it("pins the first line of each open scope, outermost first", () => {
    const text = textOf(["a {", "  b {", "    c", "  }", "}"]);
    const scopes = [
      { startLine: 1, endLine: 5 },
      { startLine: 2, endLine: 4 },
    ];
    expect(headerLines(scopes, 3, text)).toEqual([1, 2]);
    // A scope that starts on the top line is on screen already.
    expect(headerLines(scopes, 2, text)).toEqual([1]);
    expect(headerLines(scopes, 5, text)).toEqual([1]);
    expect(headerLines(scopes, 6, text)).toEqual([]);
  });

  it("names an Allman block by the line before its brace", () => {
    const text = textOf(["void main()", "", "{", "  run();", "}"]);
    expect(onlyOpensBlock("  {")).toBe(true);
    expect(onlyOpensBlock("{ x")).toBe(false);
    expect(headerLines([{ startLine: 3, endLine: 5 }], 4, text)).toEqual([1]);
  });

  it("pins five lines at most", () => {
    const scopes = Array.from({ length: 8 }, (_unused, index) => ({ startLine: index + 1, endLine: 20 }));
    expect(headerLines(scopes, 10, () => "x")).toEqual([1, 2, 3, 4, 5]);
  });

  it("decides with the line under the pinned ones", () => {
    const scopesAt = (lineNumber: number) => (lineNumber >= 3 && lineNumber <= 9 ? [{ startLine: 2, endLine: 9 }] : []);
    expect(stickyLinesFor(5, scopesAt, (count) => 5 + count, () => "x")).toEqual([2]);
    // The block ends under the pinned line, so nothing stays pinned.
    expect(stickyLinesFor(9, scopesAt, (count) => 9 + count, () => "x")).toEqual([]);
  });

  it("finds scopes by indentation without a grammar", () => {
    const lines = ["root:", "  child:", "", "    leaf: 1", "  other: 2"];
    const text = textOf(lines);
    expect(indentScopes(text, lines.length, 4, 4)).toEqual([
      { startLine: 1, endLine: 4 },
      { startLine: 2, endLine: 4 },
    ]);
    // A blank top line takes the indent of the code below it.
    expect(indentScopes(text, lines.length, 3, 4).map((scope) => scope.startLine)).toEqual([1, 2]);
    expect(indentScopes(text, lines.length, 1, 4)).toEqual([]);
  });

  it("finds scopes by markdown headings", () => {
    const lines = ["# Title", "## One", "text", "## Two", "### Deep", "text"];
    const text = textOf(lines);
    expect(headingLevel("### Deep")).toBe(3);
    expect(headingLevel("#hashtag")).toBe(0);
    expect(headingScopes(text, 6).map((scope) => scope.startLine)).toEqual([1, 4, 5]);
    // A heading at the top closes its own level.
    expect(headingScopes(text, 4).map((scope) => scope.startLine)).toEqual([1]);
  });

  it("uses the foldable nodes of the syntax tree", () => {
    const doc = ["class A {", "  run(", "    value,", "  ) {", "    if (value) {", "      go();", "    }", "  }", "}"].join("\n");
    expect(stickyAt(doc, 6, [javascript()])).toEqual([1, 2, 5]);
  });

  it("uses the bodies of a Python file", () => {
    const doc = ["class A:", "    def run(self):", "        x = 1", "        return x", ""].join("\n");
    expect(stickyAt(doc, 4, [python()])).toEqual([1, 2]);
  });

  it("uses markdown headings and indentation for plain text", () => {
    expect(stickyAt("# A\n\ntext\n## B\nmore\n", 5, [markdown()])).toEqual([1, 4]);
    expect(stickyAt("a\n  b\n    c\n", 3, [])).toEqual([1, 2]);
  });
});
