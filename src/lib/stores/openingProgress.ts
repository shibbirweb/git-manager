// Text for the progress shown while a folder opens (see repoStore.opening and loadingChanges).

/** The last part of a path: "/work/acme" becomes "acme". */
export function baseName(folderPath: string): string {
  const trimmed = folderPath.replace(/[/\\]+$/, "");
  return trimmed.slice(Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\")) + 1) || folderPath;
}

/** "Opening acme", or "Opening 3 folders" for a workspace. */
export function openingTitle(folderPaths: string[]): string {
  if (folderPaths.length === 1) {
    return `Opening ${baseName(folderPaths[0])}`;
  }
  return `Opening ${folderPaths.length} folders`;
}

/** The status bar text while statuses load: "Reading changes 2 of 5". */
export function loadingChangesText(done: number, total: number): string {
  return total === 1 ? "Reading changes" : `Reading changes ${Math.min(done + 1, total)} of ${total}`;
}
