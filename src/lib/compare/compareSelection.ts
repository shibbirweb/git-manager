// Which compare items the Files panel menu offers, like VS Code: "Select for Compare" on a
// file, then "Compare with Selected" on another one, or "Compare Selected" with two files
// selected. Pure, so the rules are tested; compareStore.svelte.ts keeps the chosen file.

export interface CompareEntry {
  /** Absolute path. */
  path: string;
  isDir: boolean;
}

export interface CompareMenuPlan {
  /** "Select for Compare": the one file the menu is for. */
  select: string | null;
  /** "Compare with Selected": the file selected earlier (left) and this one (right). */
  withSelected: [string, string] | null;
  /** "Compare Selected": the two selected files, in selection order. */
  pair: [string, string] | null;
}

const NONE: CompareMenuPlan = { select: null, withSelected: null, pair: null };

export function compareMenuPlan(entries: readonly CompareEntry[], selectedForCompare: string | null): CompareMenuPlan {
  if (entries.some((entry) => entry.isDir)) {
    return NONE;
  }
  if (entries.length === 2) {
    return { ...NONE, pair: [entries[0].path, entries[1].path] };
  }
  if (entries.length !== 1) {
    return NONE;
  }
  const filePath = entries[0].path;
  const withSelected: [string, string] | null =
    selectedForCompare !== null && selectedForCompare !== filePath ? [selectedForCompare, filePath] : null;
  return { select: filePath, withSelected, pair: null };
}
