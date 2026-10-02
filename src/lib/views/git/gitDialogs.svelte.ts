// The Git menu's larger dialogs (Push, Pull, Reset HEAD, Rollback, Manage Remotes, Clone,
// Update Project, Interactive Rebase), one at a time, rendered by GitDialogHost.svelte.
// Confirmations on top of them still come from dialogs (DialogHost.svelte).

import type { RebasePlan } from "$lib/types";
import type { GitHubDialog } from "../github/githubDialogs";

export type GitDialog =
  | { kind: "push"; repoRoot: string }
  | { kind: "pull"; repoRoot: string }
  | { kind: "reset"; repoRoot: string }
  | { kind: "rollback"; repoRoot: string; filePaths: string[] | null }
  /** Shelve Changes: `filePaths` start ticked, null ticks every changed file. */
  | { kind: "shelve"; repoRoot: string; filePaths: string[] | null }
  | { kind: "remotes"; repoRoot: string }
  | { kind: "clone" }
  | { kind: "update" }
  | { kind: "rebase"; repoRoot: string; plan: RebasePlan }
  /** Git > Merge...: "Merge into BRANCH", with `branchName` filled in when given. */
  | { kind: "merge"; repoRoot: string; branchName: string | null }
  /** Git > Rebase...: "Rebase BRANCH" onto a branch or commit (`onto` filled in when given). */
  | { kind: "rebaseBranch"; repoRoot: string; onto: string | null }
  /** Git > Branches...: the Branches popup. */
  | { kind: "branches"; repoRoot: string }
  /** Git > GitHub: sign in, Share Project, Create Gist and their results (GitHubDialogHost.svelte). */
  | { kind: "github"; dialog: GitHubDialog }
  | { kind: "newWorktree"; repoRoot: string }
  | { kind: "addSubmodule"; repoRoot: string };

class GitDialogStore {
  active = $state<GitDialog | null>(null);

  open(dialog: GitDialog): void {
    this.active = dialog;
  }

  close(): void {
    this.active = null;
  }
}

export const gitDialogs = new GitDialogStore();
