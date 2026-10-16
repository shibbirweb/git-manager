// New File, New Folder and Rename in the Files panel: a prompt that checks the name as it is typed (taken names,
// characters the system refuses, a nested path for new entries), then the backend call.
import { api, errorMessage } from "$lib/api";
import { platformFromUserAgent } from "$lib/menu/menuSpec";
import { repoStore } from "$lib/stores/repo.svelte";
import { baseName, parentOf } from "$lib/stores/workspacePaths";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import type { ExplorerHost, ExplorerOps } from "./explorerOps";
import { nameProblem, renameSelection } from "./fileNames";
import type { FileOpTarget } from "./fileOps";

const PLATFORM = platformFromUserAgent(navigator.userAgent);

export async function createEntry(
  ops: ExplorerOps,
  host: ExplorerHost,
  parentDir: string,
  isDir: boolean,
): Promise<void> {
  const taken = host.tree.namesIn(parentDir);
  const label = ops.folderLabel(parentDir);
  const result = await dialogs.prompt({
    title: isDir ? "New Folder" : "New File",
    label: `In ${label}`,
    placeholder: isDir ? "Folder name, or a/b for nested folders" : "File name, or folder/file.ts",
    confirmLabel: "Create",
    validate: (value) =>
      nameProblem(value, { nested: true, taken, folderLabel: label, ignoreCase: PLATFORM !== "linux" }),
  });
  if (!result) {
    host.focus();
    return;
  }
  let created: string;
  try {
    created = await api.fileCreate(ops.roots(), parentDir, result.value, isDir);
  } catch (error) {
    toast.error(isDir ? "Could not create the folder" : "Could not create the file", errorMessage(error));
    return;
  }
  await ops.showEntries([created], isDir ? [created] : []);
  void repoStore.filesWritten([created]);
  if (!isDir) {
    await repoStore.openFile(created, { pin: true });
  }
}

export async function renameEntry(ops: ExplorerOps, host: ExplorerHost, target: FileOpTarget): Promise<void> {
  if (target.isFolderRoot || target.deleted || !repoStore.checkUnsaved([target.path])) {
    return;
  }
  const name = baseName(target.path);
  const parentDir = parentOf(target.path);
  const taken = host.tree.namesIn(parentDir);
  const label = ops.folderLabel(parentDir);
  const ignoreCase = PLATFORM !== "linux";
  const result = await dialogs.prompt({
    title: target.isDir ? "Rename Folder" : "Rename File",
    label: "New name",
    initial: name,
    selection: renameSelection(name, target.isDir),
    confirmLabel: "Rename",
    validate: (value) => nameProblem(value, { nested: false, taken, folderLabel: label, current: name, ignoreCase }),
  });
  if (!result || result.value === name) {
    host.focus();
    return;
  }
  try {
    const renamed = await api.fileRename(ops.roots(), target.path, result.value);
    ops.applyMoves([{ from: target.path, to: renamed }]);
    await ops.afterWrite([target.path, renamed], [parentDir]);
    host.focus();
  } catch (error) {
    toast.error(`Could not rename ${name}`, errorMessage(error));
  }
}
