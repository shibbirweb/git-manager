// The folders the Files panel opens for "Select Opened File".

import { isInside, parentOf } from "$lib/stores/workspacePaths";

/** Every folder from the workspace folder down to the file's parent, outermost first; empty when the file is outside it. */
export function foldersToOpen(folderRoot: string, filePath: string): string[] {
  if (filePath === folderRoot || !isInside(folderRoot, filePath)) {
    return [];
  }
  const folders: string[] = [];
  for (let dirPath = parentOf(filePath); dirPath !== folderRoot && isInside(folderRoot, dirPath); dirPath = parentOf(dirPath)) {
    folders.unshift(dirPath);
  }
  folders.unshift(folderRoot);
  return folders;
}

/** The scroll position that puts a row in the middle of the list, or null when it is already fully visible. */
export function centeredScrollTop(rowIndex: number, rowHeight: number, scrollTop: number, viewportHeight: number): number | null {
  const top = rowIndex * rowHeight;
  if (top >= scrollTop && top + rowHeight <= scrollTop + viewportHeight) {
    return null;
  }
  return Math.max(0, top - (viewportHeight - rowHeight) / 2);
}
