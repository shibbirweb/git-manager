// The welcome screen's project list, like JetBrains: one list of recent workspaces and
// folders, each with a colored badge of its initials, filtered by the search field and walked
// with the arrow keys. Pure, so it is tested without a window.

import { type RecentEntry, shortPath } from "./recentEntries";

/** Badge colors, as terminal palette tokens so every color theme tints them; yellow is left out, white letters do not read on it. */
export const BADGE_COLORS = ["blue", "green", "magenta", "cyan", "red"] as const;
export type BadgeColor = (typeof BADGE_COLORS)[number];

/** The words of a name: split at spaces, dashes, underscores, dots and lower-to-upper case changes. */
function nameWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s\-_.,+]+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
}

/** Two letters for a project's badge: the first letters of its first two words, or the first two letters of one word. */
export function projectInitials(name: string): string {
  const words = nameWords(name);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return [...words[0]].slice(0, 2).join("").toUpperCase();
  }
  return ([...words[0]][0] + [...words[1]][0]).toUpperCase();
}

/** A color that stays the same for a project from run to run (a small string hash). */
export function badgeColor(key: string): BadgeColor {
  let hash = 0;
  for (const char of key) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return BADGE_COLORS[hash % BADGE_COLORS.length];
}

/** What identifies an entry: its file, its folder, or its folders. */
export function entryKey(entry: RecentEntry): string {
  if (entry.kind === "workspaceFile") {
    return entry.filePath;
  }
  return entry.kind === "folder" ? entry.folderPath : entry.folderPaths.join("\n");
}

/** The paths an entry stands for, for Copy Path. */
export function entryPaths(entry: RecentEntry): string[] {
  if (entry.kind === "workspaceFile") {
    return [entry.filePath];
  }
  return entry.kind === "folder" ? [entry.folderPath] : entry.folderPaths;
}

/** The dim line under the name: where it is, with the home folder as ~. */
export function entrySubtitle(entry: RecentEntry): string {
  return entryPaths(entry).map(shortPath).join(", ");
}

/**
 * The entries matching a search: every word of `query` must appear in the name or a path,
 * ignoring case. An empty query keeps them all.
 */
export function filterEntries(entries: readonly RecentEntry[], query: string): RecentEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [...entries];
  }
  return entries.filter((entry) => {
    const text = [entry.label, ...entryPaths(entry)].join("\n").toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** The row the arrow keys, Home and End move to, or null for any other key. */
export function moveSelection(index: number, key: string, count: number): number | null {
  if (count === 0) {
    return null;
  }
  switch (key) {
    case "ArrowDown":
      return Math.min(count - 1, index + 1);
    case "ArrowUp":
      return Math.max(0, index - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
