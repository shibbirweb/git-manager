// The Files panel's tree (FileExplorer.svelte): the work tree loaded one folder at a time, which folders are open,
// the selection, and the nodes the UI library's Tree draws. Every path is absolute, so several workspace folders
// never collide. Collapsing a folder drops what was loaded below it, so memory stays flat.
import type { TreeNode } from "@nibtree/ui/logic/treeModel";
import { treeRows } from "@nibtree/ui/logic/treeModel";
import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import {
  baseName,
  folderFor,
  type FolderRef,
  isInside,
  movedPath,
  type PathMove,
  relativeTo,
} from "$lib/stores/workspacePaths";
import { applyAnswers, type FolderAnswer, groupByFolder, knownStamps, type TreeEntry } from "./folderListings";
import { EMPTY_SELECTION, retargetSelection, type TreeSelection } from "./selection";
import type { WorkspaceTones } from "./tones";

export interface FileNode extends TreeNode {
  entry: TreeEntry;
  children?: FileNode[];
}

function compareEntries(a: TreeEntry, b: TreeEntry): number {
  if (a.isDir !== b.isDir) {
    return a.isDir ? -1 : 1;
  }
  const left = a.name.toLowerCase();
  const right = b.name.toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
}

export class ExplorerTree {
  /** Loaded directory contents keyed by absolute directory path. */
  children = $state.raw<Map<string, TreeEntry[]>>(new Map());
  expanded = $state.raw<Set<string>>(new Set());
  truncated = $state.raw<Set<string>>(new Set());
  selection = $state.raw<TreeSelection>(EMPTY_SELECTION);
  rootErrors = $state.raw<Map<string, string>>(new Map());

  /** Each loaded folder's stamp from its last listing: a refresh sends them, and unchanged folders are not read. */
  readonly #stamps = new Map<string, string>();
  /** The latest request per folder, so an older answer never overwrites a newer one. */
  readonly #requests = new Map<string, number>();
  #requestCount = 0;

  constructor(
    private readonly folders: () => FolderRef[],
    private readonly changes: () => WorkspaceTones,
  ) {}

  get multiRoot(): boolean {
    return this.folders().length > 1;
  }

  /** Directory contents on disk plus files git knows were deleted there. */
  entriesOf(dirPath: string): TreeEntry[] {
    const onDisk = this.children.get(dirPath);
    if (!onDisk) {
      return [];
    }
    const gone = this.changes().deletedIn(dirPath);
    if (gone.length === 0) {
      return onDisk;
    }
    const entries = onDisk.slice();
    const present = new Set(onDisk.map((entry) => entry.path));
    for (const path of gone) {
      if (!present.has(path)) {
        const name = baseName(path);
        entries.push({ name, path, isDir: false, ignored: false, isRepo: false, deleted: true, isFolderRoot: false });
      }
    }
    return entries.sort(compareEntries);
  }

  /** The Tree's nodes: open folders hold their entries, closed ones an empty list. */
  nodes(repoRoots: ReadonlySet<string>): FileNode[] {
    const nodeFor = (entry: TreeEntry): FileNode => {
      if (!entry.isDir) {
        return { id: entry.path, label: entry.name, entry };
      }
      const open = this.expanded.has(entry.path);
      return {
        id: entry.path,
        label: entry.name,
        entry,
        children: open ? this.entriesOf(entry.path).map(nodeFor) : [],
      };
    };
    const folders = this.folders();
    if (this.multiRoot) {
      // Each workspace folder is a top-level row.
      return folders.map((folder) =>
        nodeFor({
          name: folder.name,
          path: folder.root,
          isDir: true,
          ignored: false,
          isRepo: repoRoots.has(folder.root),
          deleted: false,
          isFolderRoot: true,
        }),
      );
    }
    return folders[0] ? this.entriesOf(folders[0].root).map(nodeFor) : [];
  }

  /** Visible rows top down: the order Shift ranges and Shift+arrows follow. */
  rows(nodes: FileNode[]): { node: FileNode; expanded: boolean; isFolder: boolean }[] {
    return treeRows(nodes, this.expanded);
  }

  /** Lists folders (absolute paths) with one call per workspace folder and applies every answer at once. */
  async loadDirs(dirPaths: Iterable<string>, repoRoots: string[]): Promise<void> {
    const folders = this.folders();
    const groups = groupByFolder(dirPaths, (dirPath) => folderFor(folders, dirPath)?.root ?? null);
    if (groups.size === 0) {
      return;
    }
    const sent = new Map<string, number>();
    for (const group of groups.values()) {
      for (const dirPath of group) {
        this.#requests.set(dirPath, ++this.#requestCount);
        sent.set(dirPath, this.#requestCount);
      }
    }
    const answers = await Promise.all(
      [...groups].map(async ([root, group]): Promise<FolderAnswer> => {
        const relative = group.map((dirPath) => relativeTo(root, dirPath));
        const known = knownStamps(root, group, this.#stamps, this.children);
        try {
          const listings = await api.listDirectories(root, relative, repoRoots, known);
          return { root, dirPaths: group, listings, error: null };
        } catch (error) {
          return { root, dirPaths: group, listings: null, error: errorMessage(error) };
        }
      }),
    );
    const open = repoStore.workspace?.folders ?? [];
    const current = new Set<string>();
    for (const [dirPath, request] of sent) {
      if (this.#requests.get(dirPath) === request) {
        this.#requests.delete(dirPath);
        if (folderFor(open, dirPath)) {
          current.add(dirPath);
        }
      }
    }
    const state = {
      children: this.children,
      expanded: this.expanded,
      truncated: this.truncated,
      rootErrors: this.rootErrors,
    };
    const next = applyAnswers(state, answers, this.#stamps, (dirPath) => current.has(dirPath));
    this.children = next.children;
    this.expanded = next.expanded;
    this.truncated = next.truncated;
    this.rootErrors = next.rootErrors;
  }

  /** The folders shown now, read again; unchanged ones answer with their stamp only. */
  refreshLoaded(repoRoots: string[]): Promise<void> {
    const roots = new Set(this.folders().map((folder) => folder.root));
    const dirPaths = [...this.children.keys()].filter((dirPath) => roots.has(dirPath) || this.expanded.has(dirPath));
    return this.loadDirs(dirPaths, repoRoots);
  }

  /** Reads the folders again that are loaded or open, after a write. */
  reloadDirs(dirPaths: string[], repoRoots: string[]): Promise<void> {
    const shown = dirPaths.filter((dirPath) => this.children.has(dirPath) || this.expanded.has(dirPath));
    return this.loadDirs(shown, repoRoots);
  }

  /** The Tree opened and closed folders: load the new ones, drop what was below the closed ones. */
  setExpanded(ids: string[], repoRoots: string[]): void {
    const next = new Set(ids);
    const opened = ids.filter((id) => !this.expanded.has(id));
    for (const dirPath of this.expanded) {
      if (!next.has(dirPath)) {
        this.collapse(dirPath);
      }
    }
    if (opened.length > 0) {
      this.expanded = new Set([...this.expanded, ...opened]);
      void this.loadDirs(opened, repoRoots);
    }
  }

  open(dirPaths: Iterable<string>): void {
    this.expanded = new Set([...this.expanded, ...dirPaths]);
  }

  /** Collapsing also drops loaded contents below it; a workspace folder keeps its own listing. */
  collapse(dirPath: string): void {
    const prefix = `${dirPath}/`;
    const isRoot = this.folders().some((folder) => folder.root === dirPath);
    this.expanded = new Set([...this.expanded].filter((path) => path !== dirPath && !path.startsWith(prefix)));
    const next = new Map(this.children);
    for (const key of next.keys()) {
      if ((key === dirPath && !isRoot) || key.startsWith(prefix)) {
        next.delete(key);
      }
    }
    this.children = next;
  }

  collapseAll(): void {
    const roots = new Set(this.folders().map((folder) => folder.root));
    this.expanded = this.multiRoot ? new Set() : new Set(roots);
    this.children = new Map([...this.children].filter(([path]) => roots.has(path)));
  }

  /** Workspace folders were added or removed: forget the removed ones' listings. */
  forgetFolders(removed: string[]): void {
    const isRemoved = (path: string) => removed.some((root) => path === root || path.startsWith(`${root}/`));
    this.children = new Map([...this.children].filter(([path]) => !isRemoved(path)));
    this.expanded = new Set([...this.expanded].filter((path) => !isRemoved(path)));
  }

  /** Renames and moves: open folders and the selection follow the new paths; returns the folders to load. */
  applyMoves(moves: PathMove[]): string[] {
    const isMoved = (path: string) => moves.some((move) => isInside(move.from, path));
    const reopened = [...this.expanded].filter(isMoved).map((path) => movedPath(path, moves));
    this.expanded = new Set([...[...this.expanded].filter((path) => !isMoved(path)), ...reopened]);
    // Listings under the old paths are stale; open folders load again under their new paths.
    this.children = new Map([...this.children].filter(([path]) => !isMoved(path)));
    this.selection = retargetSelection(this.selection, moves);
    return reopened;
  }

  /** Entries went to the Trash: forget them and what was below them. */
  forgetPaths(paths: string[]): void {
    const isGone = (path: string) => paths.some((gonePath) => isInside(gonePath, path));
    this.expanded = new Set([...this.expanded].filter((path) => !isGone(path)));
    this.children = new Map([...this.children].filter(([path]) => !isGone(path)));
  }

  namesIn(dirPath: string): Set<string> {
    return new Set((this.children.get(dirPath) ?? []).map((entry) => entry.name));
  }
}
