// The file operation UI tools (create_file, create_folder, rename_path, copy_paths,
// move_paths, trash_paths): the same backend calls and follow-ups as the Files panel, so tabs
// re-point or close, unsaved edits are protected and the tree and git status refresh. The app
// side comes in through FileToolDeps, so the tests run every step against fakes. The Files
// panel could use these too.

import { fileTabsUnder } from "$lib/stores/tabs";
import { baseName, folderFor, type FolderRef, type PathMove, relativeTo } from "$lib/stores/workspacePaths";
import { checkDrop } from "$lib/views/files/dragDrop";
import { MAX_NAME_BYTES, nameBytes } from "$lib/views/files/fileNames";
import { topLevel } from "$lib/views/files/selection";
import { normalizeAbsolutePath, optionalBoolean, requiredPath, requiredString, ToolArgError, type ToolArgs } from "./args";
import { FILE_TOOL_MAX_PATHS } from "./toolDefs";

/** What the tools need from the app: the api wrappers, repoStore and the Files panel clipboard. */
export interface FileToolDeps {
  folders: () => FolderRef[];
  dirtyPaths: () => string[];
  fileCreate: (workspaceRoots: string[], parentDir: string, name: string, isDir: boolean) => Promise<string>;
  fileRename: (workspaceRoots: string[], entryPath: string, newName: string) => Promise<string>;
  fileCopy: (workspaceRoots: string[], sourcePaths: string[], targetDir: string) => Promise<string[]>;
  fileMove: (workspaceRoots: string[], sourcePaths: string[], targetDir: string) => Promise<PathMove[]>;
  fileTrash: (workspaceRoots: string[], entryPaths: string[]) => Promise<void>;
  /** Opens a file in a pinned tab; true when it is the active tab afterwards. */
  openFile: (filePath: string) => Promise<boolean>;
  retargetTabs: (moves: PathMove[]) => void;
  closeTabsUnder: (entryPaths: string[]) => void;
  clipboardFollow: (moves: PathMove[]) => void;
  clipboardForget: (removed: string[]) => void;
  /** Refreshes git status and the Files panel, like after a write in the panel. */
  filesWritten: (changedPaths: string[]) => Promise<void>;
}

type Structured = Record<string, unknown>;

function workspaceFolders(deps: FileToolDeps): FolderRef[] {
  const folders = deps.folders();
  if (folders.length === 0) {
    throw new ToolArgError("No folder is open in Git Manager");
  }
  return folders;
}

function roots(folders: FolderRef[]): string[] {
  return folders.map((folder) => folder.root);
}

/** The workspace folder of an absolute path; other paths are refused like the other UI tools do. */
function folderOf(folders: FolderRef[], absolutePath: string): FolderRef {
  const folder = folderFor(folders, absolutePath);
  if (!folder) {
    throw new ToolArgError(`Not inside an open workspace folder: ${absolutePath}`);
  }
  return folder;
}

/** Workspace folders make up the workspace: they only take new files and copies. */
function refuseRoots(folders: FolderRef[], entryPaths: string[], action: string): void {
  const root = entryPaths.find((entryPath) => folders.some((folder) => folder.root === entryPath));
  if (root) {
    throw new ToolArgError(`${baseName(root)} is a workspace folder and cannot be ${action}`);
  }
}

/** A list of absolute paths, each checked like a single path, without duplicates. */
export function requiredPaths(args: ToolArgs, key: string): string[] {
  const value = args[key];
  if (value === undefined || value === null) {
    throw new ToolArgError(`"${key}" is required`);
  }
  if (!Array.isArray(value)) {
    throw new ToolArgError(`"${key}" must be a list of absolute paths`);
  }
  if (value.length === 0) {
    throw new ToolArgError(`"${key}" needs at least one path`);
  }
  if (value.length > FILE_TOOL_MAX_PATHS) {
    throw new ToolArgError(`"${key}" takes at most ${FILE_TOOL_MAX_PATHS} paths`);
  }
  const paths = value.map((entry) => {
    if (typeof entry !== "string" || entry === "") {
      throw new ToolArgError(`"${key}" must be a list of absolute paths`);
    }
    return normalizeAbsolutePath(entry, key);
  });
  return [...new Set(paths)];
}

/**
 * The Files panel's refusal when an open file in `entryPaths` (or inside one of those
 * folders) has unsaved edits, or null when there is none.
 */
export function unsavedProblem(dirtyPaths: string[], entryPaths: string[]): string | null {
  const dirty = fileTabsUnder(dirtyPaths, entryPaths);
  if (dirty.length === 0) {
    return null;
  }
  const names = dirty.map((tabPath) => baseName(tabPath));
  if (dirty.length === 1) {
    return `Save or revert ${names[0]} first; it has unsaved changes (save_file saves it)`;
  }
  return `Save or revert ${dirty.length} files first; they have unsaved changes: ${names.join(", ")}`;
}

function guardUnsaved(deps: FileToolDeps, entryPaths: string[]): void {
  const problem = unsavedProblem(deps.dirtyPaths(), entryPaths);
  if (problem) {
    throw new ToolArgError(problem);
  }
}

/** Renames and moves: open tabs and a pending cut or copy follow, then the tree and git catch up. */
async function followMoves(deps: FileToolDeps, moves: PathMove[]): Promise<void> {
  deps.retargetTabs(moves);
  deps.clipboardFollow(moves);
  await deps.filesWritten(moves.flatMap((move) => [move.from, move.to]));
}

/** create_file and create_folder: the path relative to its workspace folder, missing folders included. */
async function createEntry(deps: FileToolDeps, entryPath: string, isDir: boolean): Promise<string> {
  const folders = workspaceFolders(deps);
  const folder = folderOf(folders, entryPath);
  const name = relativeTo(folder.root, entryPath);
  if (name === "") {
    throw new ToolArgError(`${entryPath} is a workspace folder and exists already`);
  }
  const created = await deps.fileCreate(roots(folders), folder.root, name, isDir);
  await deps.filesWritten([created]);
  return created;
}

export async function createFile(deps: FileToolDeps, args: ToolArgs): Promise<Structured> {
  const filePath = requiredPath(args, "filePath");
  const open = optionalBoolean(args, "open") ?? true;
  const created = await createEntry(deps, filePath, false);
  const opened = open ? await deps.openFile(created) : false;
  return { filePath: created, opened };
}

export async function createFolder(deps: FileToolDeps, args: ToolArgs): Promise<Structured> {
  const folderPath = requiredPath(args, "folderPath");
  return { folderPath: await createEntry(deps, folderPath, true) };
}

export async function renamePath(deps: FileToolDeps, args: ToolArgs): Promise<Structured> {
  const entryPath = requiredPath(args, "entryPath");
  const newName = requiredString(args, "newName", MAX_NAME_BYTES);
  // The file system counts bytes: "é" is two.
  if (nameBytes(newName) > MAX_NAME_BYTES) {
    throw new ToolArgError(`"newName" is too long: a name holds at most ${MAX_NAME_BYTES} bytes`);
  }
  const folders = workspaceFolders(deps);
  folderOf(folders, entryPath);
  refuseRoots(folders, [entryPath], "renamed");
  if (newName === baseName(entryPath)) {
    return { from: entryPath, to: entryPath };
  }
  guardUnsaved(deps, [entryPath]);
  const renamed = await deps.fileRename(roots(folders), entryPath, newName);
  await followMoves(deps, [{ from: entryPath, to: renamed }]);
  return { from: entryPath, to: renamed };
}

/** The sources and target of copy_paths and move_paths, checked; nested sources go with their folder. */
function sourcesAndTarget(deps: FileToolDeps, args: ToolArgs): { folders: FolderRef[]; sources: string[]; targetFolder: string } {
  const paths = requiredPaths(args, "paths");
  const targetFolder = requiredPath(args, "targetFolder");
  const folders = workspaceFolders(deps);
  for (const entryPath of [...paths, targetFolder]) {
    folderOf(folders, entryPath);
  }
  return { folders, sources: topLevel(paths), targetFolder };
}

export async function copyPaths(deps: FileToolDeps, args: ToolArgs): Promise<Structured> {
  const { folders, sources, targetFolder } = sourcesAndTarget(deps, args);
  if (checkDrop(sources, targetFolder, "copy") === "intoItself") {
    throw new ToolArgError("A folder cannot be copied into itself");
  }
  const created = await deps.fileCopy(roots(folders), sources, targetFolder);
  if (created.length > 0) {
    await deps.filesWritten(created);
  }
  return { created };
}

export async function movePaths(deps: FileToolDeps, args: ToolArgs): Promise<Structured> {
  const { folders, sources, targetFolder } = sourcesAndTarget(deps, args);
  refuseRoots(folders, sources, "moved");
  const check = checkDrop(sources, targetFolder, "move");
  if (check === "intoItself") {
    throw new ToolArgError("A folder cannot move into itself");
  }
  if (check === "noop") {
    return { moved: [], note: "Everything is in that folder already" };
  }
  guardUnsaved(deps, sources);
  const moved = await deps.fileMove(roots(folders), sources, targetFolder);
  if (moved.length > 0) {
    await followMoves(deps, moved);
  }
  return { moved: moved.map((move) => ({ from: move.from, to: move.to })) };
}

export async function trashPaths(deps: FileToolDeps, args: ToolArgs): Promise<Structured> {
  const paths = requiredPaths(args, "paths");
  const folders = workspaceFolders(deps);
  for (const entryPath of paths) {
    folderOf(folders, entryPath);
  }
  const trashed = topLevel(paths);
  refuseRoots(folders, trashed, "moved to the Trash");
  guardUnsaved(deps, trashed);
  await deps.fileTrash(roots(folders), trashed);
  deps.closeTabsUnder(trashed);
  deps.clipboardForget(trashed);
  await deps.filesWritten(trashed);
  return { trashed };
}

