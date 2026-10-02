// Which file operations the Files panel offers for a selection, and the keys that run them
// while the tree has the keyboard. Pure, so the menu and the keys can be tested without a DOM.

import type { MenuPlatform } from "$lib/menu/menuIds";
import { parentOf } from "$lib/stores/workspacePaths";

export type FileOp = "newFile" | "newFolder" | "cut" | "copy" | "paste" | "duplicate" | "rename" | "trash" | "copyPaths";

/** A row the operations act on. */
export interface FileOpTarget {
  path: string;
  isDir: boolean;
  /** A top-level workspace folder: it can take new files and pastes, but never moves or goes away. */
  isFolderRoot: boolean;
  /** Deleted from disk but still known to git. */
  deleted: boolean;
}

export interface FileOpItem {
  op: FileOp;
  disabled: boolean;
}

export const FILE_OP_LABELS: Record<FileOp, string> = {
  newFile: "New File...",
  newFolder: "New Folder...",
  cut: "Cut",
  copy: "Copy",
  paste: "Paste",
  duplicate: "Duplicate",
  rename: "Rename...",
  trash: "Move to Trash",
  copyPaths: "Copy Paths",
};

/**
 * The file operation groups of the context menu, separated by lines. One row gets everything
 * (a workspace folder only New File, New Folder and Paste); several rows get Cut, Copy, Paste,
 * Move to Trash and Copy Paths. Deleted rows get none.
 */
export function fileOpGroups(targets: FileOpTarget[], canPaste: boolean): FileOpItem[][] {
  if (targets.length === 0 || targets.some((target) => target.deleted)) {
    return [];
  }
  const item = (op: FileOp, disabled = false): FileOpItem => ({ op, disabled });
  const paste = item("paste", !canPaste);
  if (targets.length === 1) {
    const create = [item("newFile"), item("newFolder")];
    if (targets[0].isFolderRoot) {
      return [create, [paste]];
    }
    return [create, [item("cut"), item("copy"), paste, item("duplicate")], [item("rename"), item("trash")]];
  }
  const movable = targets.some((target) => !target.isFolderRoot);
  if (!movable) {
    return [[paste]];
  }
  return [[item("cut"), item("copy"), paste], [item("trash")], [item("copyPaths")]];
}

/** The rows an operation may move, copy or trash: workspace folders and deleted rows stay. */
export function movableTargets(targets: FileOpTarget[]): FileOpTarget[] {
  return targets.filter((target) => !target.isFolderRoot && !target.deleted);
}

/** Where New File, New Folder and Paste put things: into a folder, or next to a file. */
export function targetFolder(target: FileOpTarget | null, fallbackRoot: string | null): string | null {
  if (!target) {
    return fallbackRoot;
  }
  return target.isDir ? target.path : parentOf(target.path);
}

/** The keyboard operations of the tree; "clearCut" is Escape dropping a pending cut. */
export type FileKeyOp = "cut" | "copy" | "paste" | "duplicate" | "rename" | "trash" | "clearCut";

/** The parts of a KeyboardEvent the decision needs. */
export interface FileKey {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** Accelerators of the menu hints, written for `formatKeys`. */
export function fileOpAccelerator(op: FileOp, platform: MenuPlatform): string | null {
  switch (op) {
    case "cut":
      return "CmdOrCtrl+X";
    case "copy":
      return "CmdOrCtrl+C";
    case "paste":
      return "CmdOrCtrl+V";
    case "duplicate":
      return "CmdOrCtrl+D";
    case "rename":
      return "F2";
    case "trash":
      return platform === "macos" ? "Cmd+Backspace" : "Delete";
    default:
      return null;
  }
}

/**
 * The operation a key press in the tree means, or null. Cmd is Ctrl outside macOS. Both
 * Cmd+Backspace (macOS) and Delete trash, F2 (VS Code) and Shift+F6 (JetBrains) rename.
 */
export function fileKeyOp(event: FileKey, platform: MenuPlatform): FileKeyOp | null {
  const mod = platform === "macos" ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
  if (event.key === "F2" && plain && !event.shiftKey) {
    return "rename";
  }
  if (event.key === "F6" && plain && event.shiftKey) {
    return "rename";
  }
  if (event.key === "Delete" && plain && !event.shiftKey) {
    return "trash";
  }
  if (event.key === "Escape" && plain && !event.shiftKey) {
    return "clearCut";
  }
  if (!mod || event.altKey || event.shiftKey) {
    return null;
  }
  if (event.key === "Backspace") {
    return "trash";
  }
  switch (event.key.toLowerCase()) {
    case "x":
      return "cut";
    case "c":
      return "copy";
    case "v":
      return "paste";
    case "d":
      return "duplicate";
    default:
      return null;
  }
}
