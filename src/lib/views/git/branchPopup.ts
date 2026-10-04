// The Branches popup, kept pure: the filtered branch list and the submenu of each
// branch (which actions it offers, their labels and when they are disabled). The popup
// component maps each action to the code that runs it.

import type { LocalBranch, Refs, RemoteBranch } from "$lib/types";

export interface BranchPopupContext {
  /** The checked-out branch; null when HEAD is detached. */
  current: string | null;
  busy: boolean;
  /** A merge, rebase, cherry-pick or revert is in progress. */
  operation: boolean;
  hasRemotes: boolean;
}

export type BranchAction =
  | "checkout"
  | "newBranch"
  | "checkoutRebase"
  | "compare"
  | "diffWorktree"
  | "rebaseOnto"
  | "merge"
  | "update"
  | "push"
  | "rename"
  | "delete"
  | "trackRemote"
  | "unsetUpstream";

export interface BranchActionItem {
  action: BranchAction;
  label: string;
  disabled: boolean;
  danger?: boolean;
  hint?: string;
}

export type BranchActionRow = BranchActionItem | "separator";

function item(action: BranchAction, label: string, disabled: boolean, extra: Partial<BranchActionItem> = {}): BranchActionItem {
  return { action, label, disabled, ...extra };
}

/** The actions comparing or integrating `name` with the current branch. */
function againstCurrent(name: string, context: BranchPopupContext): BranchActionRow[] {
  const current = context.current;
  const blocked = context.busy || context.operation;
  if (!current) {
    return [item("diffWorktree", "Show Diff with Working Tree", false)];
  }
  return [
    item("checkoutRebase", `Checkout and Rebase onto '${current}'`, blocked),
    "separator",
    item("compare", `Compare with '${current}'`, false),
    item("diffWorktree", "Show Diff with Working Tree", false),
    "separator",
    item("rebaseOnto", `Rebase '${current}' onto '${name}'`, blocked),
    item("merge", `Merge '${name}' into '${current}'...`, blocked),
  ];
}

export function localBranchActions(branch: LocalBranch, context: BranchPopupContext): BranchActionRow[] {
  const busy = context.busy;
  const upstreamHint = branch.upstream ?? undefined;
  if (branch.isHead) {
    const rows: BranchActionRow[] = [
      item("newBranch", `New Branch from '${branch.name}'...`, busy),
      "separator",
      item("update", "Update", busy || context.operation || !branch.upstream, { hint: upstreamHint }),
      item("push", "Push...", busy || context.operation || !context.hasRemotes),
      "separator",
      item("trackRemote", "Track Remote Branch...", busy || !context.hasRemotes),
    ];
    if (branch.upstream) {
      rows.push(item("unsetUpstream", "Unset Upstream", busy, { hint: branch.upstream }));
    }
    rows.push("separator", item("rename", "Rename...", busy));
    return rows;
  }
  return [
    item("checkout", "Checkout", busy || context.operation),
    item("newBranch", `New Branch from '${branch.name}'...`, busy),
    ...againstCurrent(branch.name, context),
    "separator",
    item("update", "Update", busy || !branch.upstream, { hint: upstreamHint }),
    item("push", "Push", busy || !(context.hasRemotes || branch.upstream)),
    "separator",
    item("rename", "Rename...", busy),
    item("delete", "Delete", busy, { danger: true }),
  ];
}

export function remoteBranchActions(remoteBranch: RemoteBranch, context: BranchPopupContext): BranchActionRow[] {
  return [
    item("checkout", "Checkout", context.busy || context.operation),
    item("newBranch", `New Branch from '${remoteBranch.name}'...`, context.busy),
    ...againstCurrent(remoteBranch.name, context),
  ];
}

export interface BranchList {
  local: LocalBranch[];
  remote: RemoteBranch[];
}

function matches(name: string, words: string[]): boolean {
  const text = name.toLowerCase();
  return words.every((word) => text.includes(word));
}

/** Branches whose name has every word of `query`; the current branch first. */
export function filterBranches(refs: Refs | null, query: string): BranchList {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word !== "");
  const local = (refs?.local ?? []).filter((branch) => matches(branch.name, words));
  local.sort((a, b) => Number(b.isHead) - Number(a.isHead));
  const remote = (refs?.remote ?? []).filter((remoteBranch) => matches(remoteBranch.name, words));
  return { local, remote };
}

/** The row hint: the upstream and how far ahead of or behind it the branch is. */
export function trackingHint(branch: LocalBranch): string {
  const parts: string[] = [];
  if (branch.upstream) {
    parts.push(branch.upstream);
  }
  if (branch.ahead > 0) {
    parts.push(`${branch.ahead} ahead`);
  }
  if (branch.behind > 0) {
    parts.push(`${branch.behind} behind`);
  }
  return parts.join(", ");
}
