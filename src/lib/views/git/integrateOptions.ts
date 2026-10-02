// Pure rules of the Merge and Rebase dialogs: which options exclude each other, what is
// sent to the backend and the git command shown as a preview (the same arguments the
// backend builds in commands/integrate.rs).

import type { MergeOptions, RebaseOptions } from "$lib/types";
import { validateRevision } from "./gitOptions";

// Merge

export type MergeFlag = "noFf" | "ffOnly" | "squash" | "noCommit" | "noVerify";

export const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  noFf: false,
  ffOnly: false,
  squash: false,
  noCommit: false,
  message: null,
  noVerify: false,
};

export const MERGE_FLAGS: { flag: MergeFlag; label: string; description: string }[] = [
  { flag: "noFf", label: "--no-ff", description: "Always create a merge commit" },
  { flag: "ffOnly", label: "--ff-only", description: "Merge only when it is a fast-forward" },
  { flag: "squash", label: "--squash", description: "Stage the changes as one commit, without merging" },
  { flag: "noCommit", label: "--no-commit", description: "Stop before the merge commit" },
  { flag: "noVerify", label: "--no-verify", description: "Skip the pre-merge-commit and commit-msg hooks" },
];

/** Options that cannot be on together with `flag`. */
const MERGE_EXCLUDES: Record<MergeFlag, MergeFlag[]> = {
  noFf: ["ffOnly", "squash"],
  ffOnly: ["noFf", "squash", "noCommit"],
  squash: ["noFf", "ffOnly", "noCommit"],
  noCommit: ["ffOnly", "squash"],
  noVerify: [],
};

/** Turns `flag` on or off; turning it on turns off the options it excludes. */
export function toggleMergeFlag(options: MergeOptions, flag: MergeFlag, on: boolean): MergeOptions {
  const next = { ...options, [flag]: on };
  if (on) {
    for (const excluded of MERGE_EXCLUDES[flag]) {
      next[excluded] = false;
    }
  }
  return next;
}

/** A merge commit can be made, so its message matters. */
export function mergeShowsMessage(options: MergeOptions): boolean {
  return !options.ffOnly && !options.squash;
}

/** What the backend gets: no message where it does not apply, trimmed otherwise. */
export function mergeRequest(options: MergeOptions): MergeOptions {
  const message = mergeShowsMessage(options) ? (options.message ?? "").trim() : "";
  return { ...options, message: message === "" ? null : message };
}

function quote(text: string): string {
  return /^[\w./@:+-]+$/.test(text) ? text : `"${text.replace(/(["\\$`])/g, "\\$1")}"`;
}

/** The command preview, e.g. `git merge --no-ff -m "Release" feature`. */
export function mergeCommand(branchName: string, options: MergeOptions): string {
  const request = mergeRequest(options);
  const parts = ["git merge"];
  if (request.noFf) {
    parts.push("--no-ff");
  }
  if (request.ffOnly) {
    parts.push("--ff-only");
  }
  if (request.squash) {
    parts.push("--squash");
  }
  if (request.noCommit && !request.squash && !request.ffOnly) {
    parts.push("--no-commit");
  }
  if (request.noVerify) {
    parts.push("--no-verify");
  }
  parts.push(request.message ? `-m ${quote(request.message.split("\n")[0] ?? "")}` : "--no-edit");
  parts.push(branchName.trim() || "<branch>");
  return parts.join(" ");
}

/** The toast after a merge without conflicts. */
export function mergeDoneMessage(branchName: string, current: string, options: MergeOptions): string {
  if (options.squash) {
    return `Squashed ${branchName}: the changes are staged, commit them`;
  }
  if (options.noCommit && !options.ffOnly) {
    return `Merged ${branchName} without committing: review and commit`;
  }
  return `Merged ${branchName} into ${current}`;
}

// Rebase

export interface RebaseDialogOptions extends RebaseOptions {
  /** Opens the Interactive Rebase dialog for the commits instead. */
  interactive: boolean;
}

export const DEFAULT_REBASE_OPTIONS: RebaseDialogOptions = {
  onto: null,
  upstream: null,
  branchName: null,
  useOnto: false,
  rebaseMerges: false,
  keepEmpty: false,
  root: false,
  updateRefs: false,
  interactive: false,
};

export type RebaseFlag = "interactive" | "rebaseMerges" | "keepEmpty" | "root" | "updateRefs" | "useOnto";

export const REBASE_FLAGS: { flag: RebaseFlag; label: string; description: string }[] = [
  { flag: "interactive", label: "--interactive", description: "Edit, reorder, squash or drop the commits first" },
  { flag: "rebaseMerges", label: "--rebase-merges", description: "Keep merge commits instead of flattening them" },
  { flag: "keepEmpty", label: "--keep-empty", description: "Keep commits that change nothing" },
  { flag: "root", label: "--root", description: "Rebase every commit, down to the first one" },
  { flag: "updateRefs", label: "--update-refs", description: "Move branches that point into the rebased commits" },
  { flag: "useOnto", label: "--onto", description: "Move only the commits after an upstream onto a new base" },
];

/** Flags the Interactive Rebase dialog does not take: it keeps merges by itself. */
const NOT_INTERACTIVE: RebaseFlag[] = ["rebaseMerges", "keepEmpty", "root", "updateRefs", "useOnto"];

export function rebaseFlagDisabled(options: RebaseDialogOptions, flag: RebaseFlag): boolean {
  if (flag === "interactive") {
    return options.root || options.useOnto;
  }
  return options.interactive && NOT_INTERACTIVE.includes(flag);
}

export function toggleRebaseFlag(options: RebaseDialogOptions, flag: RebaseFlag, on: boolean): RebaseDialogOptions {
  const next = { ...options, [flag]: on };
  if (on && flag === "interactive") {
    for (const excluded of NOT_INTERACTIVE) {
      next[excluded] = false;
    }
  }
  if (on && (flag === "root" || flag === "useOnto")) {
    next.interactive = false;
  }
  return next;
}

function given(value: string | null): string | null {
  const text = (value ?? "").trim();
  return text === "" ? null : text;
}

/** Why the rebase cannot start yet, or null. */
export function validateRebase(options: RebaseDialogOptions): string | null {
  const onto = given(options.onto);
  const upstream = given(options.upstream);
  if (options.useOnto || !options.root) {
    if (!onto) {
      return options.useOnto ? "Choose the new base for --onto" : "Choose what to rebase onto";
    }
    const error = validateRevision(onto);
    if (error) {
      return error;
    }
  }
  if (options.useOnto && !options.root) {
    if (!upstream) {
      return "Choose the upstream: commits after it move onto the new base";
    }
    const error = validateRevision(upstream);
    if (error) {
      return error;
    }
  }
  return null;
}

/** What the backend gets: values trimmed, the upstream only with --onto. */
export function rebaseRequest(options: RebaseDialogOptions): RebaseOptions {
  return {
    onto: options.root && !options.useOnto ? null : given(options.onto),
    upstream: options.useOnto && !options.root ? given(options.upstream) : null,
    branchName: given(options.branchName),
    useOnto: options.useOnto,
    rebaseMerges: options.rebaseMerges,
    keepEmpty: options.keepEmpty,
    root: options.root,
    updateRefs: options.updateRefs,
  };
}

/** The command preview, mirroring the backend's arguments. */
export function rebaseCommand(options: RebaseDialogOptions): string {
  const request = rebaseRequest(options);
  const parts = ["git rebase"];
  if (options.interactive) {
    parts.push("--interactive");
  }
  if (request.rebaseMerges) {
    parts.push("--rebase-merges");
  }
  if (request.keepEmpty) {
    parts.push("--keep-empty");
  }
  if (request.updateRefs) {
    parts.push("--update-refs");
  }
  if (request.useOnto) {
    parts.push("--onto", request.onto ?? "<new base>");
  }
  if (request.root) {
    parts.push("--root");
  } else if (request.useOnto) {
    parts.push(request.upstream ?? "<upstream>");
  } else {
    parts.push(request.onto ?? "<branch or commit>");
  }
  if (request.branchName) {
    parts.push(request.branchName);
  }
  return parts.join(" ");
}
