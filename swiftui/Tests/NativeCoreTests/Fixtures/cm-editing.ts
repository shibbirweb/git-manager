// Writes cm-edit-*.txt: editing cases run through CodeMirror itself (the current app's versions of @codemirror/*,
// and its own textCommands.ts and findModel.ts), so EditingTests.swift can check the native engine against them.
// Run from the repository root, with the current app's node_modules:
//   NODE_PATH=<checkout>/node_modules bun swiftui/Tests/NativeCoreTests/Fixtures/cm-editing.ts
// Lines: C name lang indent | D json-doc (D+ continues) | S ranges main | > step | = doc (=+) | s ranges main.

import { closeBrackets, deleteBracketPair, insertBracket } from "@codemirror/autocomplete";
import * as commands from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { ensureSyntaxTree, indentOnInput, indentUnit } from "@codemirror/language";
import { selectNextOccurrence } from "@codemirror/search";
import { EditorSelection, EditorState, type Transaction, type TransactionSpec } from "@codemirror/state";
import { writeFileSync } from "node:fs";
import { cases } from "./cm-editing-cases";
import { occurrenceRanges } from "../../../../src/lib/editor/findModel";
import { duplicateSelection, joinLines, sortLines, toggleCase } from "../../../../src/lib/editor/textCommands";

let now = 1_000_000;
Date.now = () => now;

type Target = { state: EditorState; dispatch: (tr: Transaction) => void };
type Command = (target: Target) => boolean;

function fromSpec(build: (state: EditorState) => TransactionSpec | null): Command {
  return ({ state, dispatch }) => {
    const spec = build(state);
    if (!spec) {
      return false;
    }
    dispatch(state.update(spec));
    return true;
  };
}

const selectAllOccurrences: Command = ({ state, dispatch }) => {
  const found = occurrenceRanges(state);
  if (!found || found.tooMany) {
    return false;
  }
  const ranges = found.ranges.map((range) => EditorSelection.range(range.from, range.to));
  dispatch(state.update({ selection: EditorSelection.create(ranges, found.main), userEvent: "select.search.matches" }));
  return true;
};

const named: Record<string, Command> = {
  ...(commands as unknown as Record<string, Command>),
  selectNextOccurrence: selectNextOccurrence as unknown as Command,
  deleteBracketPair: deleteBracketPair as unknown as Command,
  duplicate: fromSpec(duplicateSelection),
  joinLines: fromSpec(joinLines),
  toggleCase: fromSpec(toggleCase),
  sortLines: fromSpec(sortLines),
  selectAllOccurrences,
};

function create(lang: string, indent: number, doc: string, ranges: number[][], main: number): EditorState {
  const unit = indent === 0 ? "\t" : " ".repeat(indent);
  return EditorState.create({
    doc,
    selection: EditorSelection.create(
      ranges.map(([a, h]) => EditorSelection.range(Math.min(a, doc.length), Math.min(h, doc.length))),
      main,
    ),
    extensions: [
      lang === "ts" ? javascript({ typescript: true }) : [],
      indentUnit.of(unit),
      EditorState.tabSize.of(indent === 0 ? 4 : indent),
      EditorState.allowMultipleSelections.of(true),
      commands.history(),
      closeBrackets(),
      indentOnInput(),
    ],
  });
}

function run(state: EditorState, step: string): EditorState {
  ensureSyntaxTree(state, state.doc.length, 5000);
  let next = state;
  const target: Target = { state, dispatch: (tr) => (next = tr.state) };
  if (step.startsWith("wait:")) {
    now += Number(step.slice(5));
    return state;
  }
  now += 10;
  if (step.startsWith("type:")) {
    const text = JSON.parse(step.slice(5)) as string;
    const tr = insertBracket(state, text) ?? state.update(state.replaceSelection(text), {
      userEvent: "input.type",
      scrollIntoView: true,
    });
    return tr.state;
  }
  if (step.startsWith("paste:")) {
    const pasted = state.replaceSelection(JSON.parse(step.slice(6)) as string);
    return state.update(pasted, { userEvent: "input.paste" }).state;
  }
  if (step.startsWith("sel:")) {
    const [spec, main] = step.slice(4).split("@");
    const ranges = spec.split(";").map((part) => part.split(",").map(Number));
    const selection = EditorSelection.create(ranges.map(([a, h]) => EditorSelection.range(a, h)), Number(main ?? 0));
    return state.update({ selection, userEvent: "select" }).state;
  }
  const command = named[step];
  if (!command) {
    throw new Error(`Unknown step ${step}`);
  }
  command(target);
  return next;
}

function ranges(state: EditorState): string {
  return state.selection.ranges.map((range) => `${range.anchor},${range.head}`).join(";");
}

function chunked(tag: string, text: string): string[] {
  const json = JSON.stringify(text);
  const lines: string[] = [];
  for (let start = 0; start < json.length; start += 100) {
    lines.push(`${start === 0 ? tag : `${tag}+`}\t${json.slice(start, start + 100)}`);
  }
  return lines;
}

const files: string[][] = [[]];
for (const item of cases) {
  let state = create(item.lang, item.indent, item.doc, item.sel, item.main ?? 0);
  const out = [`C\t${item.name}\t${item.lang}\t${item.indent}`, ...chunked("D", item.doc)];
  out.push(`S\t${ranges(state)}\t${state.selection.mainIndex}`);
  for (const step of item.steps) {
    state = run(state, step);
    if (process.env.TRACE === item.name) {
      console.log(step.padEnd(24), JSON.stringify(state.doc.toString()), ranges(state));
    }
    out.push(`>\t${step}`);
  }
  out.push(...chunked("=", state.doc.toString()), `s\t${ranges(state)}\t${state.selection.mainIndex}`);
  if (files[files.length - 1].length + out.length > 290) {
    files.push([]);
  }
  files[files.length - 1].push(...out);
}
files.forEach((lines, index) => {
  writeFileSync(new URL(`cm-edit-${index + 1}.txt`, import.meta.url), lines.join("\n") + "\n");
});
console.log(`${cases.length} cases in ${files.length} files`);
