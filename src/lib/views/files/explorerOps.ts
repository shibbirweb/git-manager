// The Files panel's file operations: new file or folder, rename, move, copy, duplicate, paste and Move to Trash.
// The backend refuses anything outside the workspace folders, so every call passes them; results come back as
// absolute paths, and the tree, the tabs and the clipboard follow them.
import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { baseName, folderFor, type FolderRef, parentOf, type PathMove, relativeTo } from "$lib/stores/workspacePaths";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { checkDrop } from "./dragDrop";
import { createEntry, renameEntry } from "./explorerNames";
import type { ExplorerTree } from "./explorerTree.svelte";
import { fileClipboard } from "./fileClipboard.svelte";
import { type FileOp, type FileOpTarget, movableTargets, targetFolder } from "./fileOps";
import { foldersToOpen } from "./locate";
import { rowAfterRemoval, selectAll, selectOnly, topLevel } from "./selection";

export interface ExplorerHost {
  tree: ExplorerTree;
  folders: () => FolderRef[];
  repoRoots: () => string[];
  /** The workspace folder that takes new files off the rows; none with several folders. */
  singleRoot: () => string | null;
  /** The visible rows' paths, top down. */
  order: () => string[];
  focus: () => void;
}

/** "a.ts, b.ts and 3 more" for messages about many entries. */
export function listNames(paths: string[]): string {
  const names = paths.slice(0, 5).map((path) => baseName(path));
  return paths.length > 5 ? `${names.join(", ")} and ${paths.length - 5} more` : names.join(", ");
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch (error) {
    toast.error("Could not copy", errorMessage(error));
  }
}

export class ExplorerOps {
  constructor(readonly host: ExplorerHost) {}

  roots(): string[] {
    return this.host.folders().map((folder) => folder.root);
  }

  /** A folder as messages name it: its path inside the workspace folder, or the folder's name. */
  folderLabel(dirPath: string): string {
    const folder = folderFor(this.host.folders(), dirPath);
    return folder ? relativeTo(folder.root, dirPath) || folder.name : baseName(dirPath);
  }

  /** After a write: reload the touched folders now, and let git and the open tabs catch up. */
  async afterWrite(changedPaths: string[], dirPaths: string[]): Promise<void> {
    await this.host.tree.reloadDirs(dirPaths, this.host.repoRoots());
    void repoStore.filesWritten(changedPaths);
  }

  /** Opens the folders down to `entryPaths` (and `alsoOpen`) and selects the entries; the last one comes in view. */
  async showEntries(entryPaths: string[], alsoOpen: string[] = []): Promise<void> {
    const dirPaths = new Set<string>(alsoOpen);
    for (const entryPath of entryPaths) {
      const folder = folderFor(this.host.folders(), entryPath);
      for (const dirPath of folder ? foldersToOpen(folder.root, entryPath) : []) {
        dirPaths.add(dirPath);
      }
    }
    this.host.tree.open(dirPaths);
    await this.host.tree.loadDirs(dirPaths, this.host.repoRoots());
    this.host.tree.selection = selectAll(entryPaths);
    this.host.focus();
  }

  /** Renames and moves: tabs, the clipboard, open folders and the selection follow the new paths. */
  applyMoves(moves: PathMove[]): void {
    if (moves.length === 0) {
      return;
    }
    repoStore.retargetTabs(moves);
    fileClipboard.follow(moves);
    void this.host.tree.loadDirs(this.host.tree.applyMoves(moves), this.host.repoRoots());
  }

  /** Moves into `targetDir`; true when done or nothing had to move. `ask` is for drag and drop. */
  async move(sourcePaths: string[], targetDir: string, ask: boolean): Promise<boolean> {
    const sources = topLevel(sourcePaths);
    const check = checkDrop(sources, targetDir, "move");
    if (check === "noop") {
      return true;
    }
    if (check === "intoItself") {
      toast.info("A folder cannot move into itself");
      return false;
    }
    if (!repoStore.checkUnsaved(sources)) {
      return false;
    }
    // Refuse a taken name before asking: the backend would refuse it after the question. The dry run checks the
    // folder on disk, so a closed folder is never listed for it.
    let clash: string | null;
    try {
      clash = await api.fileMoveClash(this.roots(), sources, targetDir);
    } catch (error) {
      toast.error("Could not move", errorMessage(error));
      return false;
    }
    if (clash) {
      toast.error("Could not move", `${clash} already exists in ${this.folderLabel(targetDir)}`);
      return false;
    }
    if (ask && settings.confirmDragAndDrop) {
      const what = sources.length === 1 ? baseName(sources[0]) : `${sources.length} items`;
      const confirmed = await dialogs.confirm({
        title: "Move",
        message: `Move ${what} into ${this.folderLabel(targetDir)}?\n\nTurn this question off in Settings, Layout.`,
        confirmLabel: "Move",
      });
      if (!confirmed) {
        this.host.focus();
        return false;
      }
    }
    let moves: PathMove[];
    try {
      moves = await api.fileMove(this.roots(), sources, targetDir);
    } catch (error) {
      toast.error("Could not move", errorMessage(error));
      return false;
    }
    if (moves.length > 0) {
      this.applyMoves(moves);
      await this.showEntries(moves.map((move) => move.to));
      await this.afterWrite(
        moves.flatMap((move) => [move.from, move.to]),
        sources.map((sourcePath) => parentOf(sourcePath)),
      );
    }
    return true;
  }

  async copy(sourcePaths: string[], targetDir: string): Promise<void> {
    const sources = topLevel(sourcePaths);
    if (checkDrop(sources, targetDir, "copy") === "intoItself") {
      toast.info("A folder cannot be copied into itself");
      return;
    }
    let created: string[];
    try {
      created = await api.fileCopy(this.roots(), sources, targetDir);
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
      return;
    }
    if (created.length > 0) {
      await this.showEntries(created);
      void repoStore.filesWritten(created);
    }
  }

  /** Copies each entry next to itself ("cart copy.ts"). */
  async duplicate(targets: FileOpTarget[]): Promise<void> {
    const byParent = new Map<string, string[]>();
    for (const sourcePath of topLevel(movableTargets(targets).map((target) => target.path))) {
      byParent.set(parentOf(sourcePath), [...(byParent.get(parentOf(sourcePath)) ?? []), sourcePath]);
    }
    const created: string[] = [];
    try {
      for (const [parentDir, sources] of byParent) {
        created.push(...(await api.fileCopy(this.roots(), sources, parentDir)));
      }
    } catch (error) {
      toast.error("Could not duplicate", errorMessage(error));
    }
    if (created.length > 0) {
      await this.showEntries(created);
      void repoStore.filesWritten(created);
    }
  }

  async paste(targetDir: string | null): Promise<void> {
    if (!targetDir) {
      return;
    }
    const sources = fileClipboard.paths.filter((path) => folderFor(this.host.folders(), path) !== null);
    if (sources.length === 0) {
      fileClipboard.clear();
    } else if (fileClipboard.mode === "cut") {
      if (await this.move(sources, targetDir, false)) {
        fileClipboard.clear();
      }
    } else {
      await this.copy(sources, targetDir);
    }
  }

  async trash(targets: FileOpTarget[]): Promise<void> {
    const movable = movableTargets(targets);
    const trashPaths = topLevel(movable.map((target) => target.path));
    if (trashPaths.length === 0 || !repoStore.checkUnsaved(trashPaths)) {
      return;
    }
    const folderInside = movable.some((target) => target.isDir && trashPaths.includes(target.path));
    const message =
      trashPaths.length === 1
        ? `Move ${baseName(trashPaths[0])} to the Trash?`
        : `Move ${trashPaths.length} items to the Trash? ${listNames(trashPaths)}.`;
    const confirmed = await dialogs.confirm({
      title: "Move to Trash",
      message: `${message}${folderInside ? " Everything inside goes too." : ""} You can put it back from the Trash.`,
      confirmLabel: "Move to Trash",
      danger: true,
    });
    if (!confirmed) {
      this.host.focus();
      return;
    }
    const next = rowAfterRemoval(this.host.order(), trashPaths);
    try {
      await api.fileTrash(this.roots(), trashPaths);
    } catch (error) {
      toast.error("Move to Trash failed", errorMessage(error));
      return;
    }
    repoStore.closeTabsUnder(trashPaths);
    fileClipboard.forget(trashPaths);
    this.host.tree.forgetPaths(trashPaths);
    this.host.tree.selection = selectOnly(next);
    await this.afterWrite(
      trashPaths,
      trashPaths.map((trashPath) => parentOf(trashPath)),
    );
    this.host.focus();
  }

  async run(op: FileOp, targets: FileOpTarget[]): Promise<void> {
    const first = targets[0] ?? null;
    const root = this.host.singleRoot();
    switch (op) {
      case "newFile":
      case "newFolder": {
        const parentDir = targetFolder(first, root);
        if (parentDir) {
          await createEntry(this, this.host, parentDir, op === "newFolder");
        }
        break;
      }
      case "cut":
      case "copy": {
        const paths = topLevel(movableTargets(targets).map((target) => target.path));
        if (paths.length > 0) {
          fileClipboard.set(op, paths);
        }
        break;
      }
      case "paste":
        await this.paste(targetFolder(first, root));
        break;
      case "duplicate":
        await this.duplicate(targets);
        break;
      case "rename":
        if (first && targets.length === 1) {
          await renameEntry(this, this.host, first);
        }
        break;
      case "trash":
        await this.trash(targets);
        break;
      case "copyPaths":
        await copyText(targets.map((target) => target.path).join("\n"));
        break;
    }
  }
}
