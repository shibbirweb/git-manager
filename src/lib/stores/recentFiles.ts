// Recent Files of each workspace (Cmd+E), kept in state.json so they come back
// after a restart: the files shown in the editor, most recent first, and which of them were
// edited. Pure, so the order rules and the validation of a hand-edited state.json can be tested.

import { isPseudoTab } from "./pseudoTabs";
import { isSavablePath, MAX_PATH_LENGTH, MAX_TAB_SESSIONS } from "./tabSession";

export interface RecentFile {
  /** Absolute file path. */
  filePath: string;
  /** Changed in the editor since it joined the list (for "Show edited only"). */
  edited: boolean;
}

/** Files kept per workspace. */
export const MAX_RECENT_FILES = 50;

/** `files` with `filePath` first; the same array when it already is. Not a file (terminal, commit): unchanged. */
export function touchRecent(files: readonly RecentFile[], filePath: string, limit = MAX_RECENT_FILES): readonly RecentFile[] {
  if (isPseudoTab(filePath) || files[0]?.filePath === filePath) {
    return files;
  }
  const previous = files.find((file) => file.filePath === filePath);
  const rest = files.filter((file) => file.filePath !== filePath);
  return [{ filePath, edited: previous?.edited ?? false }, ...rest].slice(0, limit);
}

/** `files` with `filePath` marked edited (added first when missing); the same array when nothing changes. */
export function markEdited(files: readonly RecentFile[], filePath: string, limit = MAX_RECENT_FILES): readonly RecentFile[] {
  if (isPseudoTab(filePath)) {
    return files;
  }
  const index = files.findIndex((file) => file.filePath === filePath);
  if (index < 0) {
    return [{ filePath, edited: true }, ...files].slice(0, limit);
  }
  if (files[index].edited) {
    return files;
  }
  return files.map((file, position) => (position === index ? { ...file, edited: true } : file));
}

/** `files` without `filePath`; the same array when it was not there. */
export function removeRecent(files: readonly RecentFile[], filePath: string): readonly RecentFile[] {
  return files.some((file) => file.filePath === filePath) ? files.filter((file) => file.filePath !== filePath) : files;
}

/** One workspace's saved list: valid absolute paths only, no repeats, capped. */
export function parseRecentList(value: unknown): RecentFile[] {
  const files: RecentFile[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(value) ? value : []) {
    if (files.length >= MAX_RECENT_FILES) {
      break;
    }
    const data = entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Record<string, unknown>) : null;
    const filePath = data?.filePath;
    if (!data || !isSavablePath(filePath) || isPseudoTab(filePath) || seen.has(filePath)) {
      continue;
    }
    seen.add(filePath);
    files.push({ filePath, edited: data.edited === true });
  }
  return files;
}

/** Every workspace's list, by workspace id, the most recently saved last; empty lists are dropped. */
export function parseRecentFiles(value: unknown): Record<string, RecentFile[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const lists: [string, RecentFile[]][] = [];
  for (const [workspaceId, entry] of Object.entries(value as Record<string, unknown>)) {
    const files = workspaceId.length > 0 && workspaceId.length <= MAX_PATH_LENGTH * 4 ? parseRecentList(entry) : [];
    if (files.length > 0) {
      lists.push([workspaceId, files]);
    }
  }
  return Object.fromEntries(lists.slice(-MAX_TAB_SESSIONS));
}

/**
 * `lists` with `workspaceId` set to `files` (moved to the end, as the most recent), or removed
 * when `files` is empty; the oldest beyond `MAX_TAB_SESSIONS` are dropped.
 */
export function withRecentFiles(
  lists: Record<string, RecentFile[]>,
  workspaceId: string,
  files: readonly RecentFile[],
): Record<string, RecentFile[]> {
  const { [workspaceId]: _previous, ...rest } = lists;
  const entries = Object.entries(rest);
  if (files.length > 0) {
    entries.push([workspaceId, [...files]]);
  }
  return Object.fromEntries(entries.slice(-MAX_TAB_SESSIONS));
}
