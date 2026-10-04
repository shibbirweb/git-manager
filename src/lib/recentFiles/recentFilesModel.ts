// Pure logic of the Recent Files popup (RecentFiles.svelte): its rows, filtered as you type
// and kept in recent order, speed search style, and the row it starts on.

import { matchRecentRow } from "$lib/quickOpen/quickOpenModel";
import { pathRows, type SearchRow } from "$lib/search/fileSearchModel";
import type { RecentFile } from "$lib/stores/recentFiles";
import type { FolderRef } from "$lib/stores/workspacePaths";

export interface RecentRow {
  file: SearchRow;
  edited: boolean;
}

/** The rows for `query`, most recent first; `editedOnly` keeps the edited files (Cmd+E again). */
export function recentFileRows(
  files: readonly RecentFile[],
  folders: FolderRef[],
  query: string,
  editedOnly: boolean,
): RecentRow[] {
  const kept = editedOnly ? files.filter((file) => file.edited) : files;
  const edited = new Set(kept.filter((file) => file.edited).map((file) => file.filePath));
  const text = query.trim();
  const rows: RecentRow[] = [];
  const filePaths = kept.map((file) => file.filePath);
  for (const row of pathRows(filePaths, folders)) {
    const shown = text === "" ? row : (matchRecentRow(row, text)?.row ?? null);
    if (shown) {
      rows.push({ file: shown, edited: edited.has(shown.path) });
    }
  }
  return rows;
}

/**
 * The row selected first: the file before the one on screen, so Cmd+E then Enter goes back
 * to it. While filtering, the best (first) match.
 */
export function initialRecentSelection(rows: readonly RecentRow[], activePath: string | null, query: string): number {
  if (query.trim() === "" && rows.length > 1 && rows[0].file.path === activePath) {
    return 1;
  }
  return 0;
}
