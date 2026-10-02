// Pure helpers for the Text (Find in Files) results of the Search Everywhere popup
// (FileSearch.svelte): batches streamed from the backend, flattened into file and
// line rows with the matches highlighted.

import { type FolderRef } from "$lib/stores/workspacePaths";
import type { TextSearchBatch, TextSearchOptions } from "$lib/types";
import type { TextPart } from "./fileSearchModel";

/** Fewer characters match nearly every line; the backend ignores them too. */
export const MIN_TEXT_QUERY = 2;

export const DEFAULT_TEXT_OPTIONS: TextSearchOptions = { matchCase: false, wholeWords: false, regex: false };

/** A file heading its matches; not selectable. */
export interface TextFileRow {
  kind: "textFile";
  key: string;
  path: string;
  name: string;
  /** Folder below the workspace folder, led by its name when there are several. */
  folder: string;
  count: number;
}

export interface TextLineRow {
  kind: "textLine";
  key: string;
  path: string;
  /** 1-based. */
  line: number;
  /** 1-based, UTF-16. */
  column: number;
  parts: TextPart[];
}

export type TextRow = TextFileRow | TextLineRow;

export interface TextResults {
  rows: TextRow[];
  matches: number;
  filesMatched: number;
  filesSearched: number;
  more: boolean;
  done: boolean;
  error: string | null;
}

export const EMPTY_TEXT: TextResults = {
  rows: [],
  matches: 0,
  filesMatched: 0,
  filesSearched: 0,
  more: false,
  done: true,
  error: null,
};

/** Whether `query` is long enough to search (code points, like the backend). */
export function searchable(query: string): boolean {
  return Array.from(query).length >= MIN_TEXT_QUERY;
}

/** Splits `text` at UTF-16 `ranges` (sorted, from the backend) into matched and plain runs. */
export function rangeParts(text: string, ranges: [number, number][]): TextPart[] {
  const parts: TextPart[] = [];
  let position = 0;
  for (const [start, end] of ranges) {
    const from = Math.max(start, position);
    const to = Math.min(end, text.length);
    if (to <= from) {
      continue;
    }
    if (from > position) {
      parts.push({ text: text.slice(position, from), match: false });
    }
    parts.push({ text: text.slice(from, to), match: true });
    position = to;
  }
  if (position < text.length) {
    parts.push({ text: text.slice(position), match: false });
  }
  return parts;
}

/** The results with `batch` added; `first` starts over (the first batch of a new search). */
export function appendBatch(results: TextResults, batch: TextSearchBatch, folders: FolderRef[], first: boolean): TextResults {
  const several = folders.length > 1;
  const rows: TextRow[] = first ? [] : results.rows.slice();
  // Each file comes once per search; a repeat would break the keyed list.
  const seen = new Set(rows.filter((row) => row.kind === "textFile").map((row) => row.path));
  for (const file of batch.files ?? []) {
    if (seen.has(file.path)) {
      continue;
    }
    seen.add(file.path);
    const slash = file.relativePath.lastIndexOf("/");
    const dir = slash >= 0 ? file.relativePath.slice(0, slash) : "";
    const folderName = several ? (folders.find((folder) => folder.root === file.root)?.name ?? null) : null;
    rows.push({
      kind: "textFile",
      key: `tf:${file.path}`,
      path: file.path,
      name: file.relativePath.slice(slash + 1),
      folder: folderName ? (dir ? `${folderName}/${dir}` : folderName) : dir,
      count: file.lines.length,
    });
    for (const line of file.lines ?? []) {
      rows.push({
        kind: "textLine",
        key: `tl:${file.path}:${line.line}`,
        path: file.path,
        line: line.line,
        column: line.column,
        parts: rangeParts(line.text, line.ranges ?? []),
      });
    }
  }
  return {
    rows,
    matches: batch.matches,
    filesMatched: batch.filesMatched,
    filesSearched: batch.filesSearched,
    more: batch.more,
    done: batch.done,
    error: batch.error ?? null,
  };
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString()} ${word}${count === 1 ? "" : "es"}`;
}

/** The status line of the Text tab. */
export function textStatus(results: TextResults, running: boolean): string {
  if (results.error) {
    return results.error;
  }
  const files = `${results.filesMatched.toLocaleString()} ${results.filesMatched === 1 ? "file" : "files"}`;
  if (running) {
    return results.matches > 0 ? `Searching... ${plural(results.matches, "match")} in ${files}` : "Searching...";
  }
  if (results.more) {
    return `Showing the first ${plural(results.matches, "match")} in ${files}`;
  }
  return results.matches > 0 ? `${plural(results.matches, "match")} in ${files}` : "";
}

let lastSearchId = 0;

/**
 * A text search id, growing across searches and window reloads: the backend
 * stops a search when a newer id arrives and ignores older ones arriving late.
 */
export function nextSearchId(now = Date.now()): number {
  lastSearchId = Math.max(lastSearchId + 1, now * 1000);
  return lastSearchId;
}
