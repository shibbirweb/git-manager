// Labels and targets for the Files panel's "Reveal" and "Open in Integrated Terminal" items.

import { parentOf } from "$lib/stores/workspacePaths";

/** What the system file manager is called, like VS Code's menu labels. */
export function revealLabel(platform: string): string {
  if (platform === "Windows") {
    return "Reveal in File Explorer";
  }
  if (platform === "Linux") {
    return "Open Containing Folder";
  }
  return "Reveal in Finder";
}

/** A folder opens a terminal in itself; a file in the folder that holds it. */
export function terminalFolderFor(absolutePath: string, isDir: boolean): string {
  return isDir ? absolutePath : parentOf(absolutePath);
}
