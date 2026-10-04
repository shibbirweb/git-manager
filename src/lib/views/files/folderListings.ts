// Applying `list_directories` answers to the Files panel's loaded folders. Every path here is
// absolute; the backend speaks paths relative to each workspace folder.
import { joinPath, relativeTo } from "$lib/stores/workspacePaths";
import type { FolderListing } from "$lib/types";

export interface TreeEntry {
  name: string;
  path: string;
  isDir: boolean;
  ignored: boolean;
  isRepo: boolean;
  /** Deleted from the work tree but still known to git. */
  deleted: boolean;
  /** A top-level workspace folder (multi-folder workspaces only). */
  isFolderRoot: boolean;
}

export interface LoadedFolders {
  /** Directory contents keyed by absolute directory path. */
  children: Map<string, TreeEntry[]>;
  expanded: Set<string>;
  truncated: Set<string>;
  /** Workspace folders that could not be listed, with the reason. */
  rootErrors: Map<string, string>;
}

/** One `list_directories` call: the folders asked for, in order, and its answer. */
export interface FolderAnswer {
  root: string;
  dirPaths: string[];
  /** In the order of `dirPaths`; null when the whole call failed. */
  listings: FolderListing[] | null;
  /** Why the whole call failed (the workspace folder itself is gone, for example). */
  error: string | null;
}

/** Groups absolute folder paths by the workspace folder holding them; paths outside every folder are dropped. */
export function groupByFolder(
  dirPaths: Iterable<string>,
  folderOf: (dirPath: string) => string | null,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const dirPath of new Set(dirPaths)) {
    const root = folderOf(dirPath);
    if (root === null) {
      continue;
    }
    const group = groups.get(root);
    if (group) {
      group.push(dirPath);
    } else {
      groups.set(root, [dirPath]);
    }
  }
  return groups;
}

/** The stamps to send for `dirPaths`: only folders still loaded can be answered "unchanged". */
export function knownStamps(
  root: string,
  dirPaths: string[],
  stamps: Map<string, string>,
  children: Map<string, TreeEntry[]>,
): Record<string, string> {
  const known: Record<string, string> = {};
  for (const dirPath of dirPaths) {
    const stamp = stamps.get(dirPath);
    if (stamp !== undefined && children.has(dirPath)) {
      known[relativeTo(root, dirPath)] = stamp;
    }
  }
  return known;
}

function sameEntries(left: TreeEntry[], right: TreeEntry[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((entry, index) => {
    const other = right[index];
    return (
      entry.name === other.name &&
      entry.path === other.path &&
      entry.isDir === other.isDir &&
      entry.ignored === other.ignored &&
      entry.isRepo === other.isRepo
    );
  });
}

/**
 * Applies the answers in one go. Unchanged folders keep their arrays and an answer with the same entries keeps
 * the old array too, so nothing below re-renders for a no-op refresh; collections are only copied when something
 * in them changes. `isCurrent(dirPath, index)` is false for an answer a newer request for that folder replaced.
 * `stamps` is updated in place and forgets folders that are no longer loaded.
 */
export function applyAnswers(
  state: LoadedFolders,
  answers: FolderAnswer[],
  stamps: Map<string, string>,
  isCurrent: (dirPath: string) => boolean,
): LoadedFolders {
  let children = state.children;
  let expanded = state.expanded;
  let truncated = state.truncated;
  let rootErrors = state.rootErrors;
  const setChildren = (dirPath: string, entries: TreeEntry[] | null) => {
    if (children === state.children) {
      children = new Map(children);
    }
    if (entries) {
      children.set(dirPath, entries);
    } else {
      children.delete(dirPath);
    }
  };
  const setTruncated = (dirPath: string, isTruncated: boolean) => {
    if (truncated.has(dirPath) === isTruncated) {
      return;
    }
    truncated = new Set(truncated);
    if (isTruncated) {
      truncated.add(dirPath);
    } else {
      truncated.delete(dirPath);
    }
  };
  const setRootError = (root: string, error: string | null) => {
    if ((rootErrors.get(root) ?? null) === error) {
      return;
    }
    rootErrors = new Map(rootErrors);
    if (error === null) {
      rootErrors.delete(root);
    } else {
      rootErrors.set(root, error);
    }
  };
  /** A folder that disappeared: forget it. */
  const forget = (dirPath: string) => {
    if (children.has(dirPath)) {
      setChildren(dirPath, null);
    }
    if (expanded.has(dirPath)) {
      expanded = new Set(expanded);
      expanded.delete(dirPath);
    }
    setTruncated(dirPath, false);
  };

  for (const answer of answers) {
    answer.dirPaths.forEach((dirPath, index) => {
      if (!isCurrent(dirPath)) {
        return;
      }
      const listing = answer.listings?.[index] ?? null;
      const error = answer.error ?? listing?.error ?? (listing ? null : "No answer");
      if (error !== null) {
        stamps.delete(dirPath);
        if (dirPath === answer.root) {
          setRootError(dirPath, error);
        } else {
          forget(dirPath);
        }
        return;
      }
      if (!listing) {
        return;
      }
      if (dirPath === answer.root) {
        setRootError(dirPath, null);
      }
      stamps.set(dirPath, listing.stamp);
      if (listing.unchanged) {
        return;
      }
      const entries: TreeEntry[] = listing.entries.map((entry) => ({
        name: entry.name,
        path: joinPath(dirPath, entry.name),
        isDir: entry.isDir,
        ignored: entry.ignored,
        isRepo: entry.isRepo,
        deleted: false,
        isFolderRoot: false,
      }));
      const old = children.get(dirPath);
      if (!old || !sameEntries(old, entries)) {
        setChildren(dirPath, entries);
      }
      setTruncated(dirPath, listing.truncated);
    });
  }
  for (const dirPath of stamps.keys()) {
    if (!children.has(dirPath)) {
      stamps.delete(dirPath);
    }
  }
  return { children, expanded, truncated, rootErrors };
}
