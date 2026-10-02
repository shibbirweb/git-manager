import { open, save } from "@tauri-apps/plugin-dialog";
import { repoStore } from "$lib/stores/repo.svelte";
import type { RecentEntry } from "./recentEntries";

async function pickFolder(title: string): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false, title });
  return typeof selected === "string" && selected ? selected : null;
}

/** Shows a folder picker and opens the chosen folder, git or not, replacing the workspace. */
export async function pickAndOpenRepo(): Promise<void> {
  const folder = await pickFolder("Open Folder");
  if (folder) {
    await repoStore.open(folder);
  }
}

/** Shows a folder picker and adds the chosen folder to the open workspace. */
export async function pickAndAddFolder(): Promise<void> {
  const folder = await pickFolder("Add Folder to Workspace");
  if (folder) {
    await repoStore.addFolder(folder);
  }
}

/** Opens a saved workspace file (ours or VS Code's). */
export async function pickAndOpenWorkspaceFile(): Promise<void> {
  const selected = await open({
    multiple: false,
    directory: false,
    title: "Open Workspace from File",
    filters: [{ name: "Workspace", extensions: ["gitmanager-workspace", "code-workspace"] }],
  });
  if (typeof selected === "string" && selected) {
    await repoStore.openWorkspaceFile(selected);
  }
}

/** Saves the open folders as a workspace file next to the first folder. */
export async function pickAndSaveWorkspace(): Promise<void> {
  const workspace = repoStore.workspace;
  if (!workspace) {
    return;
  }
  const first = workspace.folders[0]?.root ?? "";
  const parent = first.slice(0, Math.max(1, first.lastIndexOf("/")));
  const defaultPath = workspace.file ?? `${parent}/${workspace.name.replace(/[^\w.-]+/g, "-") || "workspace"}.gitmanager-workspace`;
  const target = await save({
    title: "Save Workspace As",
    defaultPath,
    filters: [{ name: "Git Manager Workspace", extensions: ["gitmanager-workspace"] }],
  });
  if (target) {
    await repoStore.saveWorkspaceAs(target);
  }
}

/** Reopens a recent folder, workspace or workspace file. */
export async function openRecent(entry: RecentEntry): Promise<void> {
  if (entry.kind === "workspaceFile") {
    await repoStore.openWorkspaceFile(entry.filePath);
  } else if (entry.kind === "workspace") {
    await repoStore.openFolders(entry.folderPaths);
  } else {
    await repoStore.open(entry.folderPath);
  }
}
