// What each item of the Branches popup's branch submenu does. Each runs in the popup's
// repository and reuses the sidebar's branch actions where they exist.

import { api } from "$lib/api";
import { branchTabPath, type BranchTabRef } from "$lib/stores/branchTabs";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import type { LocalBranch, OpOutcome, RemoteBranch } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import type { MenuItem } from "$lib/ui/menu.svelte";
import { decodeRefPick, refPickItems } from "../changes/repoPickers";
import {
  checkoutLocalBranch,
  checkoutRemoteBranch,
  deleteLocalBranch,
  newBranchFrom,
  rebaseCurrentOnto,
  renameLocalBranch,
  type RepoTarget,
} from "../sidebar/actions";
import { type BranchAction, type BranchActionRow, type BranchPopupContext, localBranchActions, remoteBranchActions } from "./branchPopup";
import { gitDialogs } from "./gitDialogs.svelte";
import { DEFAULT_REBASE_OPTIONS, rebaseRequest } from "./integrateOptions";

export type PopupBranch = { kind: "local"; branch: LocalBranch } | { kind: "remote"; remoteBranch: RemoteBranch };

function nameOf(picked: PopupBranch): string {
  return picked.kind === "local" ? picked.branch.name : picked.remoteBranch.name;
}

function openBranchTab(ref: BranchTabRef): void {
  repoStore.openPseudoTab(branchTabPath(ref));
}

/** Checks out `name` (a local branch, or a remote one as its tracking branch), then rebases it onto `current`. */
function checkoutAndRebase(target: RepoTarget, repoRoot: string, picked: PopupBranch, current: string): Promise<OpOutcome | undefined> {
  const localName = picked.kind === "local" ? picked.branch.name : picked.remoteBranch.branch;
  return repoStore.runOp(
    "Rebase",
    async (repoPath) => {
      if (picked.kind === "remote") {
        await api.checkoutRemoteBranch(repoPath, picked.remoteBranch.name, localName);
        return api.rebaseWithOptions(repoPath, rebaseRequest({ ...DEFAULT_REBASE_OPTIONS, onto: current }));
      }
      return api.rebaseWithOptions(repoPath, rebaseRequest({ ...DEFAULT_REBASE_OPTIONS, onto: current, branchName: localName }));
    },
    `Checked out ${localName} and rebased it onto ${current}`,
    target.repoRoot ?? repoRoot,
  );
}

/** Track Remote Branch...: picks a remote branch for the current branch's upstream. */
async function trackRemote(target: RepoTarget, repoRoot: string, branchName: string): Promise<void> {
  const picked = decodeRefPick(
    await dialogs.pick({
      title: `Track Remote Branch for '${branchName}'`,
      placeholder: "Select the remote branch to track",
      items: refPickItems(target.refs, { local: false, remote: true }),
      emptyText: "No remote branches: fetch first",
    }),
  );
  if (picked?.kind !== "remote") {
    return;
  }
  await repoStore.run("Track remote branch", (repoPath) => api.setBranchUpstream(repoPath, branchName, picked.name), {
    repoPath: repoRoot,
    success: `${branchName} now tracks ${picked.name}`,
  });
}

function update(repoRoot: string, picked: PopupBranch): Promise<unknown> {
  if (picked.kind === "local" && picked.branch.isHead) {
    const mode = settings.updateMethod === "rebase" ? "rebase" : "merge";
    return repoStore.runOp(
      "Update",
      (repoPath) => api.pullWithOptions(repoPath, null, null, mode, false),
      `Updated ${picked.branch.name}`,
      repoRoot,
    );
  }
  const branchName = nameOf(picked);
  return repoStore.runOp("Update", (repoPath) => api.updateBranch(repoPath, branchName), `Updated ${branchName}`, repoRoot);
}

function run(action: BranchAction, picked: PopupBranch, target: RepoTarget, repoRoot: string, current: string | null): void {
  const name = nameOf(picked);
  switch (action) {
    case "checkout":
      if (picked.kind === "local") {
        checkoutLocalBranch(name, target);
      } else {
        checkoutRemoteBranch(picked.remoteBranch, target);
      }
      return;
    case "newBranch":
      void newBranchFrom(name, picked.kind === "remote" ? picked.remoteBranch.branch : "", target);
      return;
    case "checkoutRebase":
      if (current) {
        void checkoutAndRebase(target, repoRoot, picked, current);
      }
      return;
    case "compare":
      if (current) {
        openBranchTab({ kind: "compare", repoRoot, branchName: name, baseName: current });
      }
      return;
    case "diffWorktree":
      openBranchTab({ kind: "worktree", repoRoot, revision: name });
      return;
    case "rebaseOnto":
      rebaseCurrentOnto(name, target);
      return;
    case "merge":
      gitDialogs.open({ kind: "merge", repoRoot, branchName: name });
      return;
    case "update":
      void update(repoRoot, picked);
      return;
    case "push":
      if (picked.kind === "local" && picked.branch.isHead) {
        gitDialogs.open({ kind: "push", repoRoot });
      } else {
        void repoStore.runOp("Push", (repoPath) => api.pushBranch(repoPath, name), `Pushed ${name}`, repoRoot);
      }
      return;
    case "rename":
      void renameLocalBranch(name, target);
      return;
    case "delete":
      void deleteLocalBranch(name, target);
      return;
    case "trackRemote":
      void trackRemote(target, repoRoot, name);
      return;
    case "unsetUpstream":
      void repoStore.run("Unset upstream", (repoPath) => api.unsetBranchUpstream(repoPath, name), {
        repoPath: repoRoot,
        success: `${name} no longer tracks a remote branch`,
      });
      return;
  }
}

/** The submenu of `picked`; choosing an item closes the popup first, like JetBrains. */
export function branchMenuItems(
  picked: PopupBranch,
  context: BranchPopupContext,
  target: RepoTarget,
  repoRoot: string,
): MenuItem[] {
  const rows: BranchActionRow[] =
    picked.kind === "local" ? localBranchActions(picked.branch, context) : remoteBranchActions(picked.remoteBranch, context);
  return rows.map((row) =>
    row === "separator"
      ? { separator: true }
      : {
          label: row.label,
          disabled: row.disabled,
          danger: row.danger,
          hint: row.hint,
          action: () => {
            gitDialogs.close();
            run(row.action, picked, target, repoRoot, context.current);
          },
        },
  );
}
