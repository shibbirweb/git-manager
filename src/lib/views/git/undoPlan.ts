// Git > Undo Last Action: what the latest HEAD movement in the reflog was and how to take it
// back. Pure, so every case is tested; undoActions.ts asks and runs the plan.

import type { HeadBackMode, LastAction, OpKind, ReflogAction } from "$lib/types";

/** A branch deleted in this session, with the commit it pointed at. */
export interface DeletedBranch {
  repoRoot: string;
  branchName: string;
  commitId: string;
  /** When it was deleted (ms since the epoch). */
  deletedAt: number;
}

export type UndoPlan =
  | { kind: "none"; reason: string }
  | {
      kind: "moveHead";
      title: string;
      message: string;
      mode: HeadBackMode;
      headId: string;
      commitId: string;
      /** The undone commit is on a remote already: undoing it rewrites published history. */
      pushed: boolean;
      /** Toast after it worked. */
      success: string;
    }
  | { kind: "switchBranch"; title: string; message: string; branchName: string; success: string }
  | { kind: "detach"; title: string; message: string; commitId: string; success: string }
  | { kind: "restoreBranch"; title: string; message: string; branchName: string; commitId: string; success: string };

export interface UndoInputs {
  last: LastAction | null;
  op: OpKind;
  bisecting: boolean;
  /** The latest branch deleted in this repository during this session. */
  deleted: DeletedBranch | null;
  /** Local branch names now, so a branch restored by hand is not offered again. */
  localBranches: readonly string[];
}

const ZERO_ID = /^0+$/;

function short(commitId: string): string {
  return commitId.slice(0, 8);
}

const PUSHED_WARNING = " It is already pushed, so this rewrites published history.";

function moveHead(
  title: string,
  message: string,
  success: string,
  mode: HeadBackMode,
  last: LastAction,
  warnWhenPushed: boolean,
): UndoPlan {
  const entry = last.entry;
  if (!entry) {
    return { kind: "none", reason: "Nothing to undo" };
  }
  const pushed = warnWhenPushed && last.pushed;
  return {
    kind: "moveHead",
    title,
    message: pushed ? `${message}${PUSHED_WARNING}` : message,
    mode,
    headId: entry.newId,
    commitId: entry.oldId,
    pushed,
    success,
  };
}

/** Actions Undo can take back, for the toasts that offer an Undo button. */
export const UNDOABLE_ACTIONS: readonly ReflogAction[] = ["commit", "amend", "merge", "pull", "reset", "checkout", "cherryPick", "revert"];

export function undoPlan(inputs: UndoInputs): UndoPlan {
  if (inputs.op !== "none") {
    return { kind: "none", reason: "Finish or abort the operation in progress first" };
  }
  if (inputs.bisecting) {
    return { kind: "none", reason: "End the bisect first (Git > Bisect > Reset)" };
  }
  const last = inputs.last;
  const entry = last?.entry ?? null;
  const deleted = inputs.deleted;
  const deletedIsNewer = deleted !== null && (entry === null || deleted.deletedAt > entry.time * 1000);
  if (deleted && deletedIsNewer && !inputs.localBranches.includes(deleted.branchName)) {
    return {
      kind: "restoreBranch",
      title: "Restore Branch",
      message: `Restore the deleted branch '${deleted.branchName}' at ${short(deleted.commitId)}?`,
      branchName: deleted.branchName,
      commitId: deleted.commitId,
      success: `Restored ${deleted.branchName}`,
    };
  }
  if (!last || !entry) {
    return { kind: "none", reason: "Nothing to undo" };
  }
  if (ZERO_ID.test(entry.oldId) || entry.action === "initialCommit") {
    return { kind: "none", reason: "The first commit cannot be undone" };
  }
  if (entry.oldId === entry.newId && entry.action !== "checkout") {
    return { kind: "none", reason: "The last action did not move HEAD" };
  }
  const where = last.branch ?? "HEAD";
  switch (entry.action) {
    case "commit":
    case "cherryPick":
    case "revert":
      return moveHead(
        "Undo Commit",
        `Undo the commit "${entry.detail}" on ${where}? Its changes stay staged.`,
        "Commit undone",
        "soft",
        last,
        true,
      );
    case "amend":
      return moveHead(
        "Undo Amend",
        `Put ${where} back to the commit before the amend (${entry.oldShortId})? The amended changes stay staged.`,
        "Amend undone",
        "soft",
        last,
        true,
      );
    case "merge":
    case "pull": {
      const name = entry.action === "merge" ? "Merge" : "Pull";
      return moveHead(
        `Undo ${name}`,
        `Move ${where} back to ${entry.oldShortId}, before the ${name.toLowerCase()}? Local changes are kept.`,
        `${name} undone`,
        "keep",
        last,
        true,
      );
    }
    case "reset":
      return moveHead(
        "Undo Reset",
        `Move ${where} back to ${entry.oldShortId}, where it was before the reset? Local changes are kept.`,
        "Reset undone",
        "keep",
        last,
        false,
      );
    case "checkout": {
      const from = entry.checkoutFrom;
      if (from && last.fromBranchExists) {
        return {
          kind: "switchBranch",
          title: "Undo Checkout",
          message: `Switch back to ${from}?`,
          branchName: from,
          success: `Switched back to ${from}`,
        };
      }
      return {
        kind: "detach",
        title: "Undo Checkout",
        message: `Check out ${entry.oldShortId} again, where HEAD was before? HEAD will be detached.`,
        commitId: entry.oldId,
        success: `Checked out ${entry.oldShortId}`,
      };
    }
    case "rebase":
      return { kind: "none", reason: "A rebase cannot be undone here. Use Show Reflog to reset to an older entry." };
    default:
      return { kind: "none", reason: "The last action cannot be undone here. Use Show Reflog to go back further." };
  }
}

/** Where HEAD was when an Undo or Restore button was offered. */
export interface HeadSnapshot {
  /** HeadInfo.shortId: null when unborn. */
  shortId: string | null;
  /** The current branch, null when detached. */
  branch: string | null;
}

/**
 * A toast's Undo button still undoes what it was made for: HEAD has not moved and the same
 * branch is checked out. Unknown state counts as changed.
 */
export function undoStillValid(captured: HeadSnapshot | null, current: HeadSnapshot | null): boolean {
  if (!captured || !current || captured.shortId === null) {
    return false;
  }
  return captured.shortId === current.shortId && captured.branch === current.branch;
}

/** A Restore button still applies while no branch of that name exists again; unknown branches count as absent. */
export function restoreStillValid(branchName: string, localBranches: readonly string[] | null): boolean {
  return localBranches === null || !localBranches.includes(branchName);
}
