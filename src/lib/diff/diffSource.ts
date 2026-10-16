// What a diff compares, so every place that shows one (the Changes diff and tab, a commit, a compare, a shelf...)
// gets the same panes and buttons from GitDiffView: which three panes fit, which setting picks two or three
// columns, and which revisions a change's Revert and Apply work between.
import type { FileDiff, FileStatus } from "$lib/types";
import { stagingViewFits } from "$lib/views/changes/stagingDiffs.svelte";
import { MERGE_PANES_TITLE, STAGING_PANES_TITLE, WORK_TREE_PANES_TITLE } from "./diffToolbar";

export type DiffSource =
  /** The Changes diff: the index against the work tree (unstaged) or HEAD against the index (staged). */
  | { kind: "changes"; repoRoot: string; filePath: string; area: "staged" | "unstaged"; status: FileStatus | null }
  /** HEAD against the work tree, staged and unstaged together (the Changes tab). */
  | { kind: "head"; repoRoot: string; filePath: string; origPath: string | null; status: FileStatus | null }
  /** A commit's file against a parent; `secondParent` is the file against parent 2 of a merge. */
  | {
      kind: "commit";
      repoRoot: string;
      commitId: string;
      filePath: string;
      origPath: string | null;
      /** The parent the diff is against; null for a root commit. */
      parentId: string | null;
      secondParent: FileDiff | null;
      parents: string[];
    }
  /** Two revisions, or a revision against the work tree (`to` null): branch compare, compare with a revision. */
  | { kind: "revisions"; repoRoot: string; filePath: string; origPath: string | null; from: string; to: string | null }
  /** Anything else (a shelf, two files, local history): read-only. */
  | { kind: "plain" };

/** HEAD | index | work tree, parent 1 | merge | parent 2, or older | newer | work tree. */
export type ThreePaneKind = "staging" | "merge" | "workTree";

export type PanesKey = "changesDiffPanes" | "mergeDiffPanes";

export function textual(diff: FileDiff): boolean {
  return !diff.binary && !diff.tooLarge && !diff.lfs;
}

/** The three panes this diff can show, or null when only two make sense. */
export function threePaneKind(source: DiffSource, diff: FileDiff): ThreePaneKind | null {
  if (!textual(diff)) {
    return null;
  }
  switch (source.kind) {
    case "changes":
    case "head":
      return stagingViewFits(source.status) ? "staging" : null;
    case "commit":
      if (source.secondParent) {
        return textual(source.secondParent) ? "merge" : null;
      }
      // A deleted file has no newer side to put next to the work tree.
      return diff.modified === "" ? null : "workTree";
    case "revisions":
      return source.to !== null && diff.modified !== "" ? "workTree" : null;
    case "plain":
      return null;
  }
}

/** The setting that picks two or three columns: one for uncommitted changes, one for history. */
export function panesKey(source: DiffSource): PanesKey {
  return source.kind === "changes" || source.kind === "head" ? "changesDiffPanes" : "mergeDiffPanes";
}

export const THREE_PANE_TITLES: Record<ThreePaneKind, string> = {
  staging: STAGING_PANES_TITLE,
  merge: MERGE_PANES_TITLE,
  workTree: WORK_TREE_PANES_TITLE,
};

/** The revisions a change's Revert and Apply work between; null where the work tree cannot take a change. */
export interface ChangeRevisions {
  repoRoot: string;
  filePath: string;
  origPath: string | null;
  /** The older side; null when the file did not exist there (a root commit). */
  oldRevision: string | null;
  /** The newer side; null when it is the work tree itself, so only Revert makes sense. */
  newRevision: string | null;
}

export function changeRevisions(source: DiffSource): ChangeRevisions | null {
  switch (source.kind) {
    case "head": {
      const { repoRoot, filePath, origPath } = source;
      return { repoRoot, filePath, origPath, oldRevision: "HEAD", newRevision: null };
    }
    case "commit": {
      const { repoRoot, filePath, origPath } = source;
      return { repoRoot, filePath, origPath, oldRevision: source.parentId, newRevision: source.commitId };
    }
    case "revisions": {
      const { repoRoot, filePath, origPath } = source;
      return { repoRoot, filePath, origPath, oldRevision: source.from, newRevision: source.to };
    }
    case "changes":
    case "plain":
      return null;
  }
}
