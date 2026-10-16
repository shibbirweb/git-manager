// The Navigation Bar as the UI library draws it: crumbs for Breadcrumbs (the file with its type icon,
// repositories in the accent color) and a folder's rows as CrumbPopup entries in their git colors, with one entry
// that searches the whole workspace when nothing matches.
import type { FileIconView } from "@git-manager/ui/components/FileIcon.svelte";
import type { IconName } from "@git-manager/ui/icons";
import { partsToRanges } from "@git-manager/ui/logic/highlight";
import type { FileTone } from "$lib/views/files/tones";
import type { NavCrumb, NavRow } from "./navBarModel";
import { FOCUSED_GROUP } from "$lib/views/workspaceDom";

export const SEARCH_ENTRY_ID = "search everywhere";

export interface ShownCrumb {
  label: string;
  kind: "repo" | "folder" | "file";
  icon?: IconName;
  fileIcon?: FileIconView;
}

export interface NavEntry {
  id: string;
  name: string;
  ranges?: [number, number][];
  icon?: IconName;
  fileIcon?: FileIconView;
  tone?: FileTone | "ignored" | "search";
  folder?: boolean;
  title?: string;
}

type IconOf = (fileName: string) => FileIconView;

function crumbIcon(crumb: NavCrumb): IconName | undefined {
  if (crumb.kind === "workspace") {
    return "app-window";
  }
  if (crumb.isRepo) {
    return "folder-git";
  }
  return crumb.kind === "folder" ? "folder" : undefined;
}

export function shownCrumbs(crumbs: readonly NavCrumb[], iconOf: IconOf): ShownCrumb[] {
  return crumbs.map((crumb) => {
    if (crumb.kind === "file") {
      return { label: crumb.name, kind: "file", fileIcon: iconOf(crumb.name) };
    }
    const icon = crumbIcon(crumb);
    return { label: crumb.name, kind: crumb.isRepo ? "repo" : "folder", ...(icon ? { icon } : {}) };
  });
}

export function navEntries(
  rows: readonly NavRow[],
  query: string,
  ready: boolean,
  toneOf: (path: string) => FileTone | undefined,
  iconOf: IconOf,
): NavEntry[] {
  if (rows.length === 0 && query.trim() !== "" && ready) {
    return [{ id: SEARCH_ENTRY_ID, name: `Search everywhere for "${query.trim()}"`, icon: "search", tone: "search" }];
  }
  return rows.map((row) => {
    const name = partsToRanges(row.nameParts);
    const item = row.item;
    const tone = item.ignored ? "ignored" : item.isDir ? undefined : toneOf(item.path);
    const look = item.isDir ? { icon: item.isRepo ? "folder-git" : "folder" } : { fileIcon: iconOf(item.name) };
    return { id: item.path, name: name.text, ranges: name.ranges, title: item.path, folder: item.isDir, tone, ...look };
  }) as NavEntry[];
}

/** What the list says without entries: still loading, the error, or an empty folder. */
export function navMessage(loading: boolean, loadError: string | null, query: string, count: number): string {
  if (loading) {
    return "Loading...";
  }
  return loadError ?? (query.trim() === "" && count === 0 ? "Empty folder" : "");
}

/** The top left of the focused editor group (else the editor area), where the bar floats when hidden. */
export function floatingAnchor(): { top: number; left: number; maxWidth: number } | null {
  const area = document.querySelector<HTMLElement>(FOCUSED_GROUP) ?? document.querySelector<HTMLElement>("main");
  const rect = area?.getBoundingClientRect();
  if (!rect || rect.width === 0) {
    return null;
  }
  return { top: rect.top + 6, left: rect.left + 8, maxWidth: Math.max(160, rect.width - 16) };
}
