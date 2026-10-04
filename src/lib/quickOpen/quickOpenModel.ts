// Pure logic of Quick Open (QuickOpen.svelte): which mode the typed prefix picks, Go to
// Line targets, the rows of each mode and keyboard selection over them.

import { fuzzyMatch } from "$lib/commands/fuzzy";
import type { PaletteItem } from "$lib/commands/registry";
import { highlight, moveSelection, type SearchRow, type TextPart } from "$lib/search/fileSearchModel";
import { KIND_INFO, type KindInfo, type SymbolRow } from "$lib/search/symbolSearchModel";
import type { OutlineItem, OutlineKind } from "$lib/types";

export type QuickOpenMode = "files" | "commands" | "line" | "symbols" | "workspaceSymbols" | "help";

export interface QuickOpenPrefix {
  prefix: string;
  mode: QuickOpenMode;
  label: string;
}

/** Like VS Code: no prefix finds files; the others switch mode as soon as they are typed. */
export const PREFIXES: readonly QuickOpenPrefix[] = [
  { prefix: "", mode: "files", label: "Go to File" },
  { prefix: ">", mode: "commands", label: "Show and Run Commands" },
  { prefix: ":", mode: "line", label: "Go to Line" },
  { prefix: "@", mode: "symbols", label: "Go to Symbol in Editor" },
  { prefix: "#", mode: "workspaceSymbols", label: "Go to Symbol in Workspace" },
  { prefix: "?", mode: "help", label: "Help" },
];

export interface ParsedQuery {
  mode: QuickOpenMode;
  prefix: string;
  /** What follows the prefix, trimmed. */
  text: string;
}

export function parseQuickOpen(value: string): ParsedQuery {
  const first = value.charAt(0);
  const known = PREFIXES.find((entry) => entry.prefix !== "" && entry.prefix === first);
  if (known) {
    return { mode: known.mode, prefix: known.prefix, text: value.slice(1).trim() };
  }
  return { mode: "files", prefix: "", text: value.trim() };
}

/** Picking a file (Compare with...) searches files only: a typed prefix is part of the name. */
export function parsePickQuery(value: string): ParsedQuery {
  return { mode: "files", prefix: "", text: value.trim() };
}

export interface LineTarget {
  /** 1-based. */
  line: number;
  /** 1-based; null when not typed. */
  column: number | null;
}

/** ":120", ":120:5" and ":120,5", without the colon; null for anything else. */
export function parseGoToLine(text: string): LineTarget | null {
  const match = /^\s*(\d+)\s*(?:[:,]\s*(\d*)\s*)?$/.exec(text);
  if (!match) {
    return null;
  }
  const line = Number(match[1]);
  const column = match[2] ? Number(match[2]) : null;
  if (!Number.isSafeInteger(line) || (column !== null && !Number.isSafeInteger(column))) {
    return null;
  }
  return { line: Math.max(1, line), column: column === null ? null : Math.max(1, column) };
}

/** Where the editor's caret is, and how long the document is. */
export interface CaretInfo {
  line: number;
  column: number;
  lineCount: number;
}

export interface LineRowInfo {
  label: string;
  /** Where Enter goes (clamped to the document); null when there is nowhere to go. */
  target: { line: number; column: number } | null;
}

/** What the ":" mode shows for `text`. */
export function lineRow(text: string, caret: CaretInfo | null): LineRowInfo {
  if (!caret) {
    return { label: "Open a text editor to go to a line", target: null };
  }
  const range = `between 1 and ${caret.lineCount}`;
  if (text === "") {
    return {
      label: `Current line: ${caret.line}, column ${caret.column}. Type a line number ${range}.`,
      target: null,
    };
  }
  const parsed = parseGoToLine(text);
  if (!parsed) {
    return { label: `Type a line number ${range}, then :column if needed`, target: null };
  }
  const line = Math.min(parsed.line, Math.max(1, caret.lineCount));
  const column = parsed.column ?? 1;
  const label = parsed.column === null ? `Go to line ${line}` : `Go to line ${line}, column ${column}`;
  return { label, target: { line, column } };
}

/** Badges for the "@" mode: the symbol kinds of Search Everywhere plus Markdown headings. */
const HEADING: KindInfo = { letter: "H", label: "Heading", tone: "interface" };

function kindInfo(kind: OutlineKind): KindInfo {
  return kind === "heading" ? HEADING : (KIND_INFO[kind] ?? KIND_INFO.function);
}

export interface OutlineRow {
  key: string;
  /** 1-based. */
  line: number;
  /** 1-based, UTF-16. */
  column: number;
  kind: KindInfo;
  nameParts: TextPart[];
  container: string | null;
  /** Indentation, only without a query (the file's own order). */
  depth: number;
}

/** Most "@" rows rendered for one query; the list is virtualized, this only bounds the work. */
export const OUTLINE_LIMIT = 2000;

/** The "@" rows: the whole outline in file order without a query, else the matches by score. */
export function outlineRows(items: readonly OutlineItem[], query: string, limit = OUTLINE_LIMIT): OutlineRow[] {
  const row = (item: OutlineItem, indices: number[], depth: number): OutlineRow => ({
    key: `${item.line}:${item.column}:${item.name}`,
    line: item.line,
    column: item.column,
    kind: kindInfo(item.kind),
    nameParts: highlight(item.name, indices, 0),
    container: item.container,
    depth,
  });
  if (query.trim() === "") {
    return items.slice(0, limit).map((item) => row(item, [], Math.min(item.depth, 6)));
  }
  const matches: { item: OutlineItem; score: number; indices: number[] }[] = [];
  for (const item of items) {
    const match = fuzzyMatch(query, item.name);
    if (match) {
      matches.push({ item, score: match.score, indices: match.indices });
    }
  }
  matches.sort((a, b) => b.score - a.score || a.item.line - b.item.line);
  return matches.slice(0, limit).map((match) => row(match.item, match.indices, 0));
}

/**
 * Recently opened files, like VS Code: the file on screen goes last, so Cmd+P then Enter
 * returns to the file before it.
 */
export function recentOrder(filePaths: readonly string[], activePath: string | null): string[] {
  if (activePath === null || !filePaths.includes(activePath)) {
    return [...filePaths];
  }
  return [...filePaths.filter((filePath) => filePath !== activePath), activePath];
}

/** A recent file row matched against `query` (its folder and name), highlighted; null when it does not match. */
export function matchRecentRow(row: SearchRow, query: string): { row: SearchRow; score: number } | null {
  const folder = row.folderParts.map((part) => part.text).join("");
  const path = folder ? `${folder}/${row.name}` : row.name;
  const match = fuzzyMatch(query, path);
  if (!match) {
    return null;
  }
  const nameStart = Array.from(path).length - Array.from(row.name).length;
  return {
    row: {
      ...row,
      nameParts: highlight(row.name, match.indices, nameStart),
      folderParts: folder ? highlight(folder, match.indices, 0) : [],
    },
    score: match.score,
  };
}

/** Recently opened files that match `query` (their folder and name), best first. */
export function matchingRecent(rows: readonly SearchRow[], query: string): SearchRow[] {
  if (query.trim() === "") {
    return [...rows];
  }
  const scored: { row: SearchRow; score: number; recency: number }[] = [];
  rows.forEach((row, recency) => {
    const match = matchRecentRow(row, query);
    if (match) {
      scored.push({ ...match, recency });
    }
  });
  scored.sort((a, b) => b.score - a.score || a.recency - b.recency);
  return scored.map((entry) => entry.row);
}

export type QuickRow =
  | { kind: "header"; key: string; label: string }
  | { kind: "message"; key: string; label: string }
  | { kind: "file"; key: string; file: SearchRow }
  | { kind: "command"; key: string; command: PaletteItem }
  | { kind: "symbol"; key: string; symbol: SymbolRow }
  | { kind: "outline"; key: string; item: OutlineRow }
  | { kind: "line"; key: string; label: string; target: { line: number; column: number } | null }
  | { kind: "help"; key: string; prefix: string; label: string };

export function isSelectableRow(row: QuickRow): boolean {
  return row.kind !== "header" && row.kind !== "message" && !(row.kind === "line" && row.target === null);
}

export function firstSelectableRow(rows: readonly QuickRow[]): number {
  return Math.max(0, rows.findIndex(isSelectableRow));
}

/** The row after a key, skipping headings: single steps wrap, page steps stop at the ends. */
export function moveSelectableRow(rows: readonly QuickRow[], selected: number, step: number): number {
  const selectable: number[] = [];
  rows.forEach((row, index) => {
    if (isSelectableRow(row)) {
      selectable.push(index);
    }
  });
  if (selectable.length === 0) {
    return selected;
  }
  let position = selectable.findIndex((index) => index >= selected);
  if (position < 0) {
    position = selectable.length - 1;
  }
  return selectable[moveSelection(position, selectable.length, step)];
}

/** Rows of the "?" mode: every prefix and what it does. */
export function helpRows(): QuickRow[] {
  return PREFIXES.map((entry) => ({
    kind: "help",
    key: `help:${entry.mode}`,
    prefix: entry.prefix,
    label: entry.label,
  }));
}

/** The palette's rows, under "recently used" and "other commands" headings like VS Code. */
export function commandRows(recent: readonly PaletteItem[], other: readonly PaletteItem[]): QuickRow[] {
  const rows: QuickRow[] = [];
  if (recent.length > 0) {
    rows.push({ kind: "header", key: "h:recent", label: "Recently used" });
    for (const command of recent) {
      rows.push({ kind: "command", key: `r:${command.key}`, command });
    }
    if (other.length > 0) {
      rows.push({ kind: "header", key: "h:other", label: "Other commands" });
    }
  }
  for (const command of other) {
    rows.push({ kind: "command", key: `c:${command.key}`, command });
  }
  return rows;
}

/** Files mode: matching recent files first, then the other results without repeating them. */
export function fileRows(recent: readonly SearchRow[], results: readonly SearchRow[], hasQuery: boolean): QuickRow[] {
  const rows: QuickRow[] = [];
  const shown = new Set<string>();
  if (recent.length > 0) {
    rows.push({ kind: "header", key: "h:recent", label: "Recently opened" });
    for (const file of recent) {
      shown.add(file.path);
      rows.push({ kind: "file", key: `r:${file.path}`, file });
    }
  }
  const rest = results.filter((file) => !shown.has(file.path));
  if (hasQuery && rest.length > 0) {
    if (rows.length > 0) {
      rows.push({ kind: "header", key: "h:files", label: "File results" });
    }
    for (const file of rest) {
      rows.push({ kind: "file", key: `f:${file.path}`, file });
    }
  }
  return rows;
}
