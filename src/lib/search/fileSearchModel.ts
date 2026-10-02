// Pure helpers for the Files results of the Search Everywhere popup (FileSearch.svelte):
// rows to show, match highlighting, Recent Files and keyboard selection.

import { isPseudoTab } from "$lib/stores/pseudoTabs";
import { type FolderRef, folderFor, relativeTo } from "$lib/stores/workspacePaths";
import type { FileSearchItem } from "$lib/types";

export interface TextPart {
  text: string;
  match: boolean;
}

export interface SearchRow {
  /** Absolute path; also the row key. */
  path: string;
  name: string;
  nameParts: TextPart[];
  /** Folder below the workspace folder, led by that folder's name when there are several. */
  folderParts: TextPart[];
}

/**
 * Splits `text` into matched and unmatched runs. `indices` are code point
 * positions in the whole relative path; `text` starts at code point `offset`.
 */
export function highlight(text: string, indices: number[], offset: number): TextPart[] {
  const matched = new Set(indices);
  const parts: TextPart[] = [];
  let position = offset;
  for (const character of text) {
    const match = matched.has(position);
    const last = parts[parts.length - 1];
    if (last && last.match === match) {
      last.text += character;
    } else {
      parts.push({ text: character, match });
    }
    position += 1;
  }
  return parts;
}

function codePoints(text: string): number {
  return Array.from(text).length;
}

function toRow(path: string, relativePath: string, folderName: string | null, indices: number[]): SearchRow {
  const slash = relativePath.lastIndexOf("/");
  const dir = slash >= 0 ? relativePath.slice(0, slash) : "";
  const name = relativePath.slice(slash + 1);
  const nameOffset = slash >= 0 ? codePoints(relativePath.slice(0, slash + 1)) : 0;
  const folderParts = highlight(dir, indices, 0);
  if (folderName !== null) {
    folderParts.unshift({ text: dir ? `${folderName}/` : folderName, match: false });
  }
  return { path, name, nameParts: highlight(name, indices, nameOffset), folderParts };
}

/** Rows for search results; the folder name leads only in a multi-folder workspace. */
export function resultRows(items: FileSearchItem[], folders: FolderRef[]): SearchRow[] {
  const several = folders.length > 1;
  return items.map((item) => {
    const folderName = several ? (folders.find((folder) => folder.root === item.root)?.name ?? null) : null;
    return toRow(item.path, item.relativePath, folderName, item.indices);
  });
}

/** Rows for absolute paths (Recent Files); paths outside every folder are left out. */
export function pathRows(paths: string[], folders: FolderRef[]): SearchRow[] {
  const several = folders.length > 1;
  return paths.flatMap((path) => {
    const folder = folderFor(folders, path);
    if (!folder || folder.root === path) {
      return [];
    }
    return [toRow(path, relativeTo(folder.root, path), several ? folder.name : null, [])];
  });
}

export const RECENT_LIMIT = 50;

/**
 * Recent Files, like JetBrains: the active tab, then files from the Back /
 * Forward history (most recent first), then the other open tabs. Terminal and
 * commit tabs are not files.
 */
export function recentFiles(activePath: string | null, historyPaths: string[], tabPaths: string[], limit = RECENT_LIMIT): string[] {
  const seen = new Set<string>();
  for (const path of [activePath, ...historyPaths, ...tabPaths]) {
    if (path && !isPseudoTab(path)) {
      seen.add(path);
    }
    if (seen.size >= limit) {
      break;
    }
  }
  return [...seen];
}

/**
 * The row to select after a key: single steps wrap around the ends (as in
 * JetBrains), page steps stop at them.
 */
export function moveSelection(selected: number, count: number, step: number): number {
  if (count === 0) {
    return 0;
  }
  if (Math.abs(step) === 1) {
    return (selected + step + count) % count;
  }
  return Math.max(0, Math.min(count - 1, selected + step));
}

/**
 * Splits a trailing ":LINE" or ":LINE:COL" off a query, like the backend.
 * An unfinished trailing ":" is dropped.
 */
export function splitLocation(query: string): { text: string; line: number | null; column: number | null } {
  let text = query.trim();
  if (text.endsWith(":")) {
    text = text.slice(0, -1);
  }
  const numbers: number[] = [];
  while (numbers.length < 2) {
    const match = /:(\d+)$/.exec(text);
    if (!match) {
      break;
    }
    numbers.unshift(Number(match[1]));
    text = text.slice(0, match.index);
  }
  return { text: text.trim(), line: numbers[0] ?? null, column: numbers[1] ?? null };
}
