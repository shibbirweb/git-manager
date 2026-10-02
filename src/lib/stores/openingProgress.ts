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

/**
 * The toast for a folder or workspace that failed to open: the folder in the title, and the
 * full path with the error below it. The path is left out of the detail when the error already names it.
 */
export function openFailure(folderPaths: string[], message: string): { title: string; detail: string } {
  const reason = message.trim() || "Unknown error";
  if (folderPaths.length === 1) {
    const folderPath = folderPaths[0];
    return {
      title: `Could not open ${baseName(folderPath)}`,
      detail: reason.includes(folderPath) ? reason : `${folderPath}\n${reason}`,
    };
  }
  return {
    title: folderPaths.length === 0 ? "Could not open the workspace" : `Could not open ${folderPaths.length} folders`,
    detail: [...folderPaths, reason].join("\n"),
  };
}
