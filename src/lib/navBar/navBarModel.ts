// The Navigation Bar, like JetBrains': the path of the file on screen as crumbs, each folder
// with a popup of what it holds. Moving through the popups builds a trail of crumbs that
// may leave the file's path ("browsing"); closing the bar goes back to the file's path.
// Pure, so the key handling in NavigationBar.svelte stays small and tested.

import { fuzzyMatch } from "$lib/commands/fuzzy";
import { highlight, type TextPart } from "$lib/search/fileSearchModel";
import { folderFor, joinPath, relativeTo } from "$lib/stores/workspacePaths";
import type { DirEntry } from "$lib/types";

export type CrumbKind = "workspace" | "folder" | "dir" | "file";

export interface NavCrumb {
  /** Absolute path; "" for the workspace crumb. */
  path: string;
  name: string;
  kind: CrumbKind;
  /** The folder is the root of a git repository. */
  isRepo: boolean;
}

export interface NavFolder {
  root: string;
  name: string;
}

export interface NavItem {
  name: string;
  /** Absolute path. */
  path: string;
  isDir: boolean;
  isRepo: boolean;
  ignored: boolean;
  /** A workspace folder, listed in the workspace crumb's popup. */
  isFolderRoot: boolean;
}

export interface NavRow {
  item: NavItem;
  nameParts: TextPart[];
}

/**
 * The crumbs for `targetPath` (a file, or a folder when `targetIsDir`). A workspace with
 * several folders starts with a workspace crumb listing them. A path outside every folder
 * (or none) shows the first folder only.
 */
export function crumbsFor(
  folders: readonly NavFolder[],
  workspaceName: string,
  targetPath: string | null,
  repoRoots: ReadonlySet<string>,
  targetIsDir = false,
): NavCrumb[] {
  const crumbs: NavCrumb[] = [];
  if (folders.length > 1) {
    crumbs.push({ path: "", name: workspaceName, kind: "workspace", isRepo: false });
  }
  const folder = (targetPath === null ? null : folderFor([...folders], targetPath)) ?? folders[0] ?? null;
  if (folder === null) {
    return crumbs;
  }
  crumbs.push({ path: folder.root, name: folder.name, kind: "folder", isRepo: repoRoots.has(folder.root) });
  if (targetPath === null || folderFor([folder], targetPath) === null) {
    return crumbs;
  }
  const parts = relativeTo(folder.root, targetPath).split("/").filter((part) => part !== "");
  parts.forEach((part, index) => {
    const path = joinPath(folder.root, parts.slice(0, index + 1).join("/"));
    const isFile = index === parts.length - 1 && !targetIsDir;
    crumbs.push({ path, name: part, kind: isFile ? "file" : "dir", isRepo: !isFile && repoRoots.has(path) });
  });
  return crumbs;
}

/** The crumb whose contents the popup of crumb `index` lists: a file shows its own folder. */
export function listedIndex(crumbs: readonly NavCrumb[], index: number): number {
  return crumbs[index]?.kind === "file" ? index - 1 : index;
}

/** The entry to select when the popup of crumb `index` opens: the next crumb, or the file itself. */
export function selectedPathFor(crumbs: readonly NavCrumb[], index: number): string | null {
  const crumb = crumbs[index];
  if (!crumb) {
    return null;
  }
  return crumb.kind === "file" ? crumb.path : (crumbs[index + 1]?.path ?? null);
}

/** The crumb Left goes to from the popup of crumb `index` (one that lists something else), or `index`. */
export function previousPopup(crumbs: readonly NavCrumb[], index: number): number {
  const previous = listedIndex(crumbs, index) - 1;
  return previous >= 0 ? previous : index;
}

/** The crumb the bar opens on: the file's folder, so its popup lists the file's neighbors. */
export function startIndex(crumbs: readonly NavCrumb[]): number {
  return Math.max(0, listedIndex(crumbs, crumbs.length - 1));
}

/** The trail after going into `item` from the popup of crumb `index`: the crumbs past that folder are replaced. */
export function enterItem(crumbs: readonly NavCrumb[], index: number, item: NavItem): NavCrumb[] {
  const kept = crumbs.slice(0, listedIndex(crumbs, index) + 1);
  const kind: CrumbKind = item.isFolderRoot ? "folder" : item.isDir ? "dir" : "file";
  return [...kept, { path: item.path, name: item.name, kind, isRepo: item.isRepo }];
}

/** The popup items of a listed folder, in the order the backend gives (folders first). */
export function itemsOf(dirPath: string, entries: readonly DirEntry[]): NavItem[] {
  return entries.map((entry) => ({
    name: entry.name,
    path: joinPath(dirPath, entry.name),
    isDir: entry.isDir,
    isRepo: entry.isRepo,
    ignored: entry.ignored,
    isFolderRoot: false,
  }));
}

/** The workspace crumb's popup: every workspace folder. */
export function folderItems(folders: readonly NavFolder[], repoRoots: ReadonlySet<string>): NavItem[] {
  return folders.map((folder) => ({
    name: folder.name,
    path: folder.root,
    isDir: true,
    isRepo: repoRoots.has(folder.root),
    ignored: false,
    isFolderRoot: true,
  }));
}

/**
 * The rows for `query`: all items in order when it is empty, else the names that match it
 * (letters in order, like JetBrains' speed search), best first, ties in listing order.
 */
export function navRows(items: readonly NavItem[], query: string): NavRow[] {
  const text = query.trim();
  if (text === "") {
    return items.map((item) => ({ item, nameParts: [{ text: item.name, match: false }] }));
  }
  const scored: { row: NavRow; score: number; order: number }[] = [];
  items.forEach((item, order) => {
    const match = fuzzyMatch(text, item.name);
    if (match) {
      scored.push({ row: { item, nameParts: highlight(item.name, match.indices, 0) }, score: match.score, order });
    }
  });
  scored.sort((left, right) => right.score - left.score || left.order - right.order);
  return scored.map((entry) => entry.row);
}

/** The row to select: the one at `selectedPath`, else the first. */
export function rowIndexOf(rows: readonly NavRow[], selectedPath: string | null): number {
  const index = selectedPath === null ? -1 : rows.findIndex((row) => row.item.path === selectedPath);
  return Math.max(0, index);
}
