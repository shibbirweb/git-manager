// Flattened row model for the sidebar tree. Only rows inside expanded
// sections and folders are produced, so collapsed content never hits the DOM.

import type { LocalBranch, Refs, RemoteBranch, StashEntry, WorktreeInfo } from "$lib/types";

export type SectionId = "local" | "remote" | "tags" | "stashes" | "worktrees";

interface RowBase {
  key: string;
  depth: number;
  parentKey: string | null;
}

export type SidebarRow =
  | (RowBase & { kind: "section"; section: SectionId; label: string; count: number; expanded: boolean })
  | (RowBase & { kind: "group"; icon: "folder" | "cloud"; label: string; count: number; expanded: boolean })
  | (RowBase & { kind: "local"; label: string; branch: LocalBranch })
  | (RowBase & { kind: "remote"; label: string; branch: RemoteBranch })
  | (RowBase & { kind: "tag"; label: string; tagName: string })
  | (RowBase & { kind: "stash"; stash: StashEntry })
  | (RowBase & { kind: "worktree"; worktree: WorktreeInfo })
  | (RowBase & { kind: "empty"; label: string });

export type CollapsibleRow = Extract<SidebarRow, { kind: "section" | "group" }>;

export function isCollapsible(row: SidebarRow | null): row is CollapsibleRow {
  return row?.kind === "section" || row?.kind === "group";
}

export function sectionKey(section: SectionId): string {
  return `section:${section}`;
}

export interface BuildRowsInput {
  refs: Refs | null;
  stashes: StashEntry[];
  /** Worktrees of the repository; the section is left out while unknown (undefined). */
  worktrees?: WorktreeInfo[];
  filter: string;
  isExpanded: (key: string) => boolean;
}

interface FolderNode<T> {
  folders: Map<string, FolderNode<T>>;
  leaves: { label: string; item: T }[];
  count: number;
}

function newNode<T>(): FolderNode<T> {
  return { folders: new Map(), leaves: [], count: 0 };
}

// One collator for every sort: `localeCompare` with options builds one per call, which took
// most of the time for 20k refs.
const NAME_ORDER = new Intl.Collator(undefined, { numeric: true });

function compareNames(left: string, right: string): number {
  return NAME_ORDER.compare(left, right);
}

function buildTree<T>(items: T[], nameOf: (item: T) => string): FolderNode<T> {
  const root = newNode<T>();
  for (const item of items) {
    const parts = nameOf(item).split("/");
    const label = parts.pop() ?? "";
    let node = root;
    node.count++;
    for (const part of parts) {
      let child = node.folders.get(part);
      if (!child) {
        child = newNode<T>();
        node.folders.set(part, child);
      }
      child.count++;
      node = child;
    }
    node.leaves.push({ label, item });
  }
  return root;
}

type LeafFactory<T> = (label: string, item: T, key: string, depth: number, parentKey: string | null) => SidebarRow;

function emitTree<T>(
  node: FolderNode<T>,
  prefix: string,
  depth: number,
  parentKey: string | null,
  isExpanded: (key: string) => boolean,
  makeLeaf: LeafFactory<T>,
  rows: SidebarRow[],
): void {
  const folderNames = [...node.folders.keys()].sort(compareNames);
  for (const folderName of folderNames) {
    const child = node.folders.get(folderName) ?? null;
    if (!child) {
      continue;
    }
    const key = `${prefix}${folderName}/`;
    const expanded = isExpanded(key);
    rows.push({ kind: "group", icon: "folder", key, depth, parentKey, label: folderName, count: child.count, expanded });
    if (expanded) {
      emitTree(child, key, depth + 1, key, isExpanded, makeLeaf, rows);
    }
  }
  const leaves = [...node.leaves].sort((left, right) => compareNames(left.label, right.label));
  for (const leaf of leaves) {
    rows.push(makeLeaf(leaf.label, leaf.item, `${prefix}${leaf.label}`, depth, parentKey));
  }
}

export function buildRows(input: BuildRowsInput): SidebarRow[] {
  const needle = input.filter.trim().toLowerCase();
  const filtering = needle.length > 0;
  const matches = (text: string): boolean => !filtering || text.toLowerCase().includes(needle);

  const local = (input.refs?.local ?? []).filter((branch) => matches(branch.name));
  const remote = (input.refs?.remote ?? []).filter((branch) => matches(branch.name));
  const tags = (input.refs?.tags ?? []).filter((tagName) => matches(tagName));
  const stashes = (input.stashes ?? []).filter((stash) => matches(stash.message));
  const worktrees = (input.worktrees ?? []).filter(
    (worktree) => matches(worktree.path) || matches(worktree.branch ?? ""),
  );

  const rows: SidebarRow[] = [];

  const pushSection = (section: SectionId, label: string, count: number): boolean => {
    const key = sectionKey(section);
    const expanded = input.isExpanded(key);
    rows.push({ kind: "section", section, key, depth: 0, parentKey: null, label, count, expanded });
    return expanded;
  };

  const pushEmpty = (parentKey: string, label: string): void => {
    rows.push({ kind: "empty", key: `${parentKey}:empty`, depth: 1, parentKey, label });
  };

  if (!filtering || local.length > 0) {
    const parentKey = sectionKey("local");
    if (pushSection("local", "Local", local.length)) {
      if (local.length === 0) {
        pushEmpty(parentKey, "No branches");
      }
      const tree = buildTree(local, (branch) => branch.name);
      emitTree(
        tree,
        "local:",
        1,
        parentKey,
        input.isExpanded,
        (label, branch, key, depth, leafParent) => ({ kind: "local", key, depth, parentKey: leafParent, label, branch }),
        rows,
      );
    }
  }

  if (!filtering || remote.length > 0) {
    const parentKey = sectionKey("remote");
    if (pushSection("remote", "Remote", remote.length)) {
      const byRemote = new Map<string, RemoteBranch[]>();
      if (!filtering) {
        for (const remoteName of input.refs?.remotes ?? []) {
          byRemote.set(remoteName, []);
        }
      }
      for (const branch of remote) {
        const list = byRemote.get(branch.remote) ?? [];
        list.push(branch);
        byRemote.set(branch.remote, list);
      }
      if (byRemote.size === 0) {
        pushEmpty(parentKey, "No remotes");
      }
      const remoteNames = [...byRemote.keys()].sort(compareNames);
      for (const remoteName of remoteNames) {
        const branches = byRemote.get(remoteName) ?? [];
        const groupKey = `remote:${remoteName}`;
        const expanded = input.isExpanded(groupKey);
        rows.push({
          kind: "group",
          icon: "cloud",
          key: groupKey,
          depth: 1,
          parentKey,
          label: remoteName,
          count: branches.length,
          expanded,
        });
        if (!expanded) {
          continue;
        }
        if (branches.length === 0) {
          rows.push({ kind: "empty", key: `${groupKey}:empty`, depth: 2, parentKey: groupKey, label: "No branches" });
        }
        emitTree(
          buildTree(branches, (branch) => branch.branch),
          `${groupKey}:`,
          2,
          groupKey,
          input.isExpanded,
          (label, branch, key, depth, leafParent) => ({ kind: "remote", key, depth, parentKey: leafParent, label, branch }),
          rows,
        );
      }
    }
  }

  if (!filtering || tags.length > 0) {
    const parentKey = sectionKey("tags");
    if (pushSection("tags", "Tags", tags.length)) {
      if (tags.length === 0) {
        pushEmpty(parentKey, "No tags");
      }
      emitTree(
        buildTree(tags, (tagName) => tagName),
        "tag:",
        1,
        parentKey,
        input.isExpanded,
        (label, tagName, key, depth, leafParent) => ({ kind: "tag", key, depth, parentKey: leafParent, label, tagName }),
        rows,
      );
    }
  }

  if (!filtering || stashes.length > 0) {
    const parentKey = sectionKey("stashes");
    if (pushSection("stashes", "Stashes", stashes.length)) {
      if (stashes.length === 0) {
        pushEmpty(parentKey, "No stashes");
      }
      for (const stash of stashes) {
        rows.push({ kind: "stash", key: `stash:${stash.index}`, depth: 1, parentKey, stash });
      }
    }
  }

  if (input.worktrees !== undefined && (!filtering || worktrees.length > 0)) {
    const parentKey = sectionKey("worktrees");
    if (pushSection("worktrees", "Worktrees", worktrees.length)) {
      if (worktrees.length === 0) {
        pushEmpty(parentKey, "No worktrees");
      }
      for (const worktree of worktrees) {
        rows.push({ kind: "worktree", key: `worktree:${worktree.path}`, depth: 1, parentKey, worktree });
      }
    }
  }

  return rows;
}
