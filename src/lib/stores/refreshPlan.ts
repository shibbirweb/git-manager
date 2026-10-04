// What a watcher event or an app write needs refreshed, kept pure so the rules
// are tested without the store. The watcher (src-tauri/src/watcher.rs) says
// which kind of change happened; each kind refreshes only what it can change.

import type { RepoChangedEvent, WorkspaceChangedEvent } from "$lib/types";

export interface RepoRefresh {
  /** Read the status again (with its hash, so an unchanged one costs no update). */
  status: boolean;
  /** Read branches, stashes, remotes and worktrees again (the active repository only). */
  refs: boolean;
}

/** Every repository event can change the status; only refs and config changes reach the branches. */
export function repoRefresh(event: RepoChangedEvent): RepoRefresh {
  return { status: true, refs: event.refs || event.config };
}

/**
 * HEAD, the index, entries or a `.gitattributes` changed: what Git LFS lists may have changed with them. A content
 * edit alone never changes it, so typing in a file costs no LFS check.
 */
export function treeChanged(event: RepoChangedEvent): boolean {
  return event.refs || event.index || event.structure || event.attributes;
}

export interface WorkspaceRefresh {
  /** The Files panel lists its open folders again. */
  listing: boolean;
  /** Tabs of files outside every repository read their file again. */
  looseFiles: boolean;
  /** Look for repositories that appeared or disappeared. */
  rescan: boolean;
}

export function workspaceRefresh(event: WorkspaceChangedEvent): WorkspaceRefresh {
  return {
    listing: event.structure || event.reposChanged,
    looseFiles: event.outsideRepos || event.structure || event.reposChanged,
    rescan: event.reposChanged,
  };
}

/** How long a write by the app waits for the watcher's event before refreshing by itself. */
export const WATCHER_FALLBACK_MS = 1500;

export interface WriteFallback {
  /** Repositories whose status was not read since the write. */
  statusOf: string[];
  /** No watcher event at all arrived since the write (ignored paths, or no watcher): refresh the files views. */
  files: boolean;
}

/**
 * After the app wrote files at `writtenAt`, the watcher's event normally
 * refreshes everything once. Checked `WATCHER_FALLBACK_MS` later, this says
 * what is still to do: a status read for each repository not read since,
 * and the files views when the watcher stayed quiet.
 */
export function writeFallback(
  writtenAt: number,
  repoRoots: string[],
  statusReadAt: (repoRoot: string) => number,
  watcherEventAt: number,
): WriteFallback {
  return {
    statusOf: repoRoots.filter((repoRoot) => statusReadAt(repoRoot) < writtenAt),
    files: watcherEventAt < writtenAt,
  };
}
