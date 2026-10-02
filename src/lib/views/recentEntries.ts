// The recent folders and workspaces offered by the header's folder menu and File > Open
// Recent, kept in one place so both list the same entries in the same order.

export interface RecentSources {
  recentWorkspaceFiles: readonly string[];
  recentWorkspaces: readonly (readonly string[])[];
  recentRepos: readonly string[];
}

/** What is open now; it is left out of the list. */
export interface OpenWorkspaceInfo {
  file: string | null;
  folderRoots: readonly string[];
}

export type RecentEntry =
  | { kind: "workspaceFile"; label: string; hint: string; filePath: string }
  | { kind: "workspace"; label: string; hint: string; folderPaths: string[] }
  | { kind: "folder"; label: string; hint: string; folderPath: string };

export function shortPath(folderPath: string): string {
  return folderPath.replace(/^\/Users\/[^/]+/, "~");
}

export function folderName(folderPath: string): string {
  return folderPath.split("/").filter(Boolean).pop() ?? folderPath;
}

function workspaceFileLabel(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf("/") + 1).replace(/\.(gitmanager|code)-workspace$/, "");
}

/** Recent workspace files, then multi-folder workspaces, then single folders. */
export function recentEntries(sources: RecentSources, open: OpenWorkspaceInfo | null): RecentEntry[] {
  const openRoots = open?.folderRoots ?? [];
  const openKey = openRoots.join("\n");
  const entries: RecentEntry[] = [];
  for (const filePath of sources.recentWorkspaceFiles) {
    if (filePath === open?.file) {
      continue;
    }
    entries.push({ kind: "workspaceFile", label: workspaceFileLabel(filePath), hint: "workspace file", filePath });
  }
  for (const folders of sources.recentWorkspaces) {
    if (folders.join("\n") === openKey) {
      continue;
    }
    const names = folders.map(folderName);
    entries.push({
      kind: "workspace",
      label: `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3}` : ""}`,
      hint: `${folders.length} folders`,
      folderPaths: [...folders],
    });
  }
  for (const folderPath of sources.recentRepos) {
    if (openRoots.length === 1 && folderPath === openRoots[0]) {
      continue;
    }
    entries.push({ kind: "folder", label: folderName(folderPath), hint: shortPath(folderPath), folderPath });
  }
  return entries;
}

/** One line for a native menu, which has no room for a dimmed hint. */
export function recentMenuText(entry: RecentEntry): string {
  return entry.kind === "folder" ? entry.hint : `${entry.label} (${entry.hint})`;
}
