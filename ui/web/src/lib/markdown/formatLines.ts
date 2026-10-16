// Line formats for the editor toolbar: headings, list and quote prefixes, code blocks, tables and task boxes.
// Like format.ts, each returns one transaction spec (every cursor, one undo step) and toggles off when present.

import { EditorSelection, type ChangeSpec, type EditorState, type Line, type TransactionSpec } from "@codemirror/state";
import { USER_EVENT } from "./format";

export type LinePrefix = "bullet" | "ordered" | "task" | "quote";

/** Line edits with the selection kept after inserted prefixes. */
function lineEdit(state: EditorState, changes: ChangeSpec[]): TransactionSpec {
  const changeSet = state.changes(changes);
  return {
    changes: changeSet,
    selection: state.selection.map(changeSet, 1),
    scrollIntoView: true,
    userEvent: USER_EVENT,
  };
}

/**
 * The lines the selections touch, in order and without repeats. A selection
 * ending at the start of a line does not touch it. Of several lines, blank
 * ones are skipped.
 */
function touchedLines(state: EditorState): Line[] {
  const numbers = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    let last = state.doc.lineAt(range.to).number;
    if (!range.empty && last > first && state.doc.line(last).from === range.to) {
      last--;
    }
    for (let number = first; number <= last; number++) {
      numbers.add(number);
    }
  }
  const lines = [...numbers].sort((a, b) => a - b).map((number) => state.doc.line(number));
  const filled = lines.filter((line) => line.text.trim() !== "");
  return filled.length > 0 && filled.length < lines.length ? filled : lines;
}

const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+|$)/;

/** The ATX heading level of a line, 0 for none. */
export function headingLevel(text: string): number {
  return HEADING.exec(text)?.[1].length ?? 0;
}

/** Makes every touched line a heading of `level` (0 makes it plain text); lines already at that level become plain. */
export function setHeading(state: EditorState, level: number): TransactionSpec {
  const lines = touchedLines(state);
  const remove = level === 0 || lines.every((line) => headingLevel(line.text) === level);
  const changes = lines.map((line) => {
    const current = HEADING.exec(line.text)?.[0].length ?? 0;
    return { from: line.from, to: line.from + current, insert: remove ? "" : `${"#".repeat(level)} ` };
  });
  return lineEdit(state, changes);
}

const LIST_ITEM = /^(\s*)(?:[-*+]|\d{1,9}[.)])[ \t]+(\[[ xX]\][ \t]+)?/;
const QUOTE = /^(\s*)>[ \t]?/;

function listKind(text: string): Exclude<LinePrefix, "quote"> | null {
  const match = LIST_ITEM.exec(text);
  if (!match) {
    return null;
  }
  if (match[2]) {
    return "task";
  }
  return /^\s*\d/.test(text) ? "ordered" : "bullet";
}

function listMarker(prefix: Exclude<LinePrefix, "quote">, number: number): string {
  if (prefix === "ordered") {
    return `${number}. `;
  }
  return prefix === "task" ? "- [ ] " : "- ";
}

/** Bulleted, numbered or task list, or quote, on every touched line; removed when all of them have it. */
export function toggleLinePrefix(state: EditorState, prefix: LinePrefix): TransactionSpec {
  const lines = touchedLines(state);
  const changes: ChangeSpec[] = [];
  if (prefix === "quote") {
    const remove = lines.every((line) => QUOTE.test(line.text));
    for (const line of lines) {
      const match = QUOTE.exec(line.text);
      if (remove && match) {
        changes.push({ from: line.from + match[1].length, to: line.from + match[0].length });
      } else if (!remove) {
        changes.push({ from: line.from, insert: "> " });
      }
    }
    return lineEdit(state, changes);
  }
  const remove = lines.every((line) => listKind(line.text) === prefix);
  let number = 0;
  let previous = -1;
  for (const line of lines) {
    // Numbering restarts where the touched lines are not consecutive.
    number = line.number === previous + 1 ? number + 1 : 1;
    previous = line.number;
    const match = LIST_ITEM.exec(line.text);
    const indent = match ? match[1].length : (/^\s*/.exec(line.text)?.[0].length ?? 0);
    const end = match ? match[0].length : indent;
    changes.push({ from: line.from + indent, to: line.from + end, insert: remove ? "" : listMarker(prefix, number) });
  }
  return lineEdit(state, changes);
}

const FENCE = /^\s*(```|~~~)/;

/** Fences the selected lines as a code block (or removes the fences around them); a cursor gets an empty block. */
export function toggleCodeBlock(state: EditorState): TransactionSpec {
  const doc = state.doc;
  const spec = state.changeByRange((range) => {
    if (range.empty) {
      const line = doc.lineAt(range.head);
      if (line.text.trim() === "") {
        return {
          changes: { from: line.from, to: line.to, insert: "```\n\n```" },
          range: EditorSelection.cursor(line.from + 4),
        };
      }
      return {
        changes: { from: line.to, insert: "\n```\n\n```" },
        range: EditorSelection.cursor(line.to + 5),
      };
    }
    const first = doc.lineAt(range.from);
    let last = doc.lineAt(range.to);
    if (last.number > first.number && last.from === range.to) {
      last = doc.line(last.number - 1);
    }
    // The selection includes its fences.
    if (last.number > first.number && FENCE.test(first.text) && FENCE.test(last.text)) {
      const inner = doc.sliceString(doc.line(first.number + 1).from, doc.line(last.number - 1).to);
      const empty = last.number === first.number + 1;
      return {
        changes: { from: first.from, to: last.to, insert: empty ? "" : inner },
        range: EditorSelection.range(first.from, first.from + (empty ? 0 : inner.length)),
      };
    }
    // The fences sit just around the selected lines.
    const before = first.number > 1 ? doc.line(first.number - 1) : null;
    const after = last.number < doc.lines ? doc.line(last.number + 1) : null;
    if (before && after && FENCE.test(before.text) && FENCE.test(after.text)) {
      const length = last.to - first.from;
      return {
        changes: [
          { from: before.from, to: first.from },
          { from: last.to, to: after.to },
        ],
        range: EditorSelection.range(before.from, before.from + length),
      };
    }
    const length = last.to - first.from;
    return {
      changes: [
        { from: first.from, insert: "```\n" },
        { from: last.to, insert: "\n```" },
      ],
      range: EditorSelection.range(first.from + 4, first.from + 4 + length),
    };
  });
  return { ...spec, scrollIntoView: true, userEvent: USER_EVENT };
}

/** A Markdown table with `columns` columns, a header and `rows` empty rows. */
export function tableTemplate(columns: number, rows: number): string {
  const titles = Array.from({ length: columns }, (_value, index) => `Column ${index + 1}`);
  const row = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const lines = [row(titles), row(titles.map((title) => "-".repeat(title.length)))];
  for (let index = 0; index < rows; index++) {
    lines.push(row(titles.map((title) => " ".repeat(title.length))));
  }
  return lines.join("\n");
}

/** Inserts a table template below each cursor's line (or on it when blank), with the first header selected. */
export function insertTable(state: EditorState, columns = 3, rows = 2): TransactionSpec {
  const doc = state.doc;
  const table = tableTemplate(columns, rows);
  const spec = state.changeByRange((range) => {
    const line = doc.lineAt(range.to);
    const next = line.number < doc.lines ? doc.line(line.number + 1) : null;
    // A blank line after the table so the following text is not read as a row.
    const tail = next && next.text.trim() !== "" ? "\n" : "";
    if (line.text.trim() === "") {
      return {
        changes: { from: line.from, to: line.to, insert: `${table}${tail}` },
        range: EditorSelection.range(line.from + 2, line.from + 2 + "Column 1".length),
      };
    }
    const start = line.to + 2;
    return {
      changes: { from: line.to, insert: `\n\n${table}${tail}` },
      range: EditorSelection.range(start + 2, start + 2 + "Column 1".length),
    };
  });
  return { ...spec, scrollIntoView: true, userEvent: USER_EVENT };
}

const TASK_ITEM = /^((?:\s*>)*\s*(?:[-*+]|\d{1,9}[.)])[ \t]+\[)([ xX])\]/;

/** Ticks or unticks the task list item on a 0-based line; null when that line has none. */
export function toggleTaskAt(state: EditorState, lineIndex: number): TransactionSpec | null {
  if (lineIndex < 0 || lineIndex >= state.doc.lines) {
    return null;
  }
  const line = state.doc.line(lineIndex + 1);
  const match = TASK_ITEM.exec(line.text);
  if (!match) {
    return null;
  }
  const position = line.from + match[1].length;
  return {
    changes: { from: position, to: position + 1, insert: match[2] === " " ? "x" : " " },
    userEvent: USER_EVENT,
  };
}
