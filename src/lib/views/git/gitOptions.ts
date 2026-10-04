// Pure rules behind the Git menu's dialogs: default push and pull targets, the git command
// each dialog will run (shown as a preview), reset modes, remote and clone validation, and
// the Update Project plan. Kept free of Svelte and Tauri so they are tested directly.

import type { FileStatus, HeadInfo, PullMode, RepoInfo, RepoStatus, ResetMode } from "$lib/types";

// Push

export interface PushTarget {
  remoteName: string;
  remoteBranch: string;
}

/** Splits "origin/feature/x" with the known remote names (a remote name may hold a slash). */
export function splitRemoteRef(remoteRef: string, remoteNames: string[]): PushTarget | null {
  const remoteName = remoteNames
    .filter((name) => remoteRef.startsWith(`${name}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (!remoteName) {
    return null;
  }
  return { remoteName, remoteBranch: remoteRef.slice(remoteName.length + 1) };
}

/** The remote a branch without an upstream goes to: origin, else the first one. */
export function defaultRemote(remoteNames: string[]): string | null {
  return remoteNames.includes("origin") ? "origin" : (remoteNames[0] ?? null);
}

/** Where Push sends the current branch: its upstream, else the same name on the default remote. */
export function defaultPushTarget(head: HeadInfo | null | undefined, remoteNames: string[]): PushTarget | null {
  const branch = head?.branch ?? null;
  if (!branch) {
    return null;
  }
  const upstream = head?.upstream ? splitRemoteRef(head.upstream, remoteNames) : null;
  if (upstream) {
    return upstream;
  }
  const remoteName = defaultRemote(remoteNames);
  return remoteName ? { remoteName, remoteBranch: branch } : null;
}

export interface PushOptions extends PushTarget {
  localBranch: string;
  forceWithLease: boolean;
  pushTags: boolean;
  /** The branch has no upstream yet, so the push sets it. */
  setUpstream: boolean;
}

/** The command the Push dialog runs, as shown under its options. */
export function pushCommand(options: PushOptions): string {
  const parts = ["git push"];
  if (options.forceWithLease) {
    parts.push("--force-with-lease");
  }
  if (options.pushTags) {
    parts.push("--tags");
  }
  if (options.setUpstream) {
    parts.push("-u");
  }
  parts.push(options.remoteName);
  parts.push(options.localBranch === options.remoteBranch ? options.localBranch : `${options.localBranch}:${options.remoteBranch}`);
  return parts.join(" ");
}

// Pull

export interface PullOptions {
  remoteName: string | null;
  branchName: string | null;
  mode: PullMode;
  noCommit: boolean;
}

export const PULL_MODES: { value: PullMode; label: string; description: string }[] = [
  { value: "merge", label: "Merge", description: "Merge the incoming changes into the current branch" },
  { value: "rebase", label: "Rebase", description: "Rebase the current branch on top of the incoming changes" },
  { value: "ffOnly", label: "Fast-forward only", description: "Update only when no merge or rebase is needed" },
];

export function pullCommand(options: PullOptions): string {
  const parts = ["git pull"];
  parts.push(options.mode === "rebase" ? "--rebase" : options.mode === "ffOnly" ? "--ff-only" : "--no-rebase");
  if (options.noCommit && options.mode === "merge") {
    parts.push("--no-commit");
  }
  if (options.remoteName) {
    parts.push(options.remoteName);
    if (options.branchName) {
      parts.push(options.branchName);
    }
  }
  return parts.join(" ");
}

// Reset HEAD

/** The Reset HEAD modes with their one-line explanations. */
export const RESET_MODES: { value: ResetMode; label: string; description: string; danger?: boolean }[] = [
  { value: "soft", label: "Soft", description: "Files won't change, differences will be staged for commit." },
  { value: "mixed", label: "Mixed", description: "Files won't change, differences won't be staged." },
  {
    value: "hard",
    label: "Hard",
    description: "Files will be reverted to the state of the selected commit. Any local changes will be lost.",
    danger: true,
  },
  {
    value: "keep",
    label: "Keep",
    description: "Files will be reverted to the state of the selected commit, but local changes will be kept intact.",
  },
];

/** Git's ref name rules, roughly, for a revision typed into Reset HEAD; git has the last word. */
export function validateRevision(revision: string): string | null {
  const text = revision.trim();
  if (!text) {
    return "Enter a revision";
  }
  if (text.startsWith("-") || /\s/.test(text)) {
    return "Not a valid revision";
  }
  return null;
}

// Remotes

/** Git's ref name rules, roughly (git has the last word): for branch and remote names. */
export function isValidRefName(refName: string): boolean {
  return !(
    refName === "" ||
    /\s|\.\.|[~^:?*[\\]|@\{|\/\/|\/\./.test(refName) ||
    refName.startsWith("-") ||
    refName.startsWith(".") ||
    refName.startsWith("/") ||
    refName.endsWith("/") ||
    refName.endsWith(".") ||
    refName.endsWith(".lock") ||
    refName === "@"
  );
}

/** Git's rules for a remote name (a ref component), plus no duplicates. */
export function validateRemoteName(remoteName: string, existing: string[], current: string | null = null): string | null {
  const name = remoteName.trim();
  if (!name) {
    return "Enter a name";
  }
  if (!isValidRefName(name)) {
    return "Not a valid remote name";
  }
  if (name !== current && existing.includes(name)) {
    return "A remote with this name already exists";
  }
  return null;
}

export function validateRemoteUrl(url: string, optional = false): string | null {
  const text = url.trim();
  if (!text) {
    return optional ? null : "Enter a URL";
  }
  if (text.startsWith("-")) {
    return "Not a valid URL";
  }
  return null;
}

// Clone

/** The error a clone stopped by its Cancel button ends with (commands/remote.rs). */
export const CLONE_CANCELLED = "Clone cancelled";

/** The folder `git clone` would create for `url`: its last part without ".git" (git's "humanish" name). */
export function cloneFolderName(url: string): string {
  let text = url.trim().replace(/[/\\]+$/, "");
  text = text.replace(/[/\\]\.git$/i, "");
  text = text.replace(/[/\\]+$/, "");
  const last = text.split(/[/\\:]/).pop() ?? "";
  return last.replace(/\.(git|bundle)$/i, "");
}

/** A single folder name: no separators, not "." or "..". */
export function validateFolderName(folderName: string): string | null {
  const name = folderName.trim();
  if (!name) {
    return "Enter a folder name";
  }
  if (name === "." || name === ".." || /[/\\\0]/.test(name)) {
    return "Not a valid folder name";
  }
  return null;
}

// Update Project

export interface UpdateStep {
  repoRoot: string;
  name: string;
}

export interface UpdatePlan {
  steps: UpdateStep[];
  /** Repositories left out, with the reason, e.g. "no upstream". */
  skipped: { name: string; reason: string }[];
}

function skipReason(status: RepoStatus | undefined): string | null {
  if (!status) {
    return "status not loaded";
  }
  if (status.op.kind !== "none") {
    return "an operation is in progress";
  }
  if (!status.head.branch) {
    return "detached HEAD";
  }
  if (status.head.unborn) {
    return "no commits yet";
  }
  if (!status.head.upstream) {
    return "no upstream";
  }
  return null;
}

/** Every repository of the workspace that can be pulled, in order, and the ones that cannot. */
export function updatePlan(repos: RepoInfo[], statuses: Record<string, RepoStatus>): UpdatePlan {
  const plan: UpdatePlan = { steps: [], skipped: [] };
  for (const repo of repos) {
    const reason = skipReason(statuses[repo.root]);
    if (reason) {
      plan.skipped.push({ name: repo.name, reason });
    } else {
      plan.steps.push({ repoRoot: repo.root, name: repo.name });
    }
  }
  return plan;
}

/** "Updating 2 of 5: name". */
export function updateProgressText(index: number, total: number, name: string): string {
  return total > 1 ? `Updating ${index + 1} of ${total}: ${name}` : `Updating ${name}`;
}

// Rollback

/** The changes Rollback lists: tracked files with staged or unstaged changes, no conflicts, no untracked files. */
export function rollbackCandidates(files: FileStatus[]): FileStatus[] {
  return files.filter((file) => !file.conflicted && file.unstaged !== "untracked" && (file.staged !== null || file.unstaged !== null));
}

/** Paths sent to the rollback: each file and, for a staged rename, its old path too. */
export function rollbackPaths(files: FileStatus[]): string[] {
  const paths = new Set<string>();
  for (const file of files) {
    paths.add(file.path);
    if (file.origPath) {
      paths.add(file.origPath);
    }
  }
  return [...paths];
}

/** Files Rollback would unversion (added in the index, not in HEAD). */
export function addedFiles(files: FileStatus[]): FileStatus[] {
  return files.filter((file) => file.staged === "added");
}
