// Starts an interactive rebase from the dialog's rows: asks before rewriting pushed commits, offers to stash a
// dirty working tree, then runs the rebase and says how it went.
import { api } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { RebasePlan } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { rebaseEntries, type RebaseRow } from "./rebaseModel";

/** Runs the rebase; `close` shuts the dialog once the user has said yes to everything. */
export async function startRebase(repoRoot: string, plan: RebasePlan, rows: RebaseRow[], close: () => void) {
  if (plan.pushedTo) {
    const confirmed = await dialogs.confirm({
      title: "Rewrite Pushed Commits",
      message: `These commits are already on ${plan.pushedTo}; rewriting them needs a force push.`,
      confirmLabel: "Rebase Anyway",
      danger: true,
    });
    if (!confirmed) {
      return;
    }
  }
  let autostash = false;
  if (plan.dirty) {
    const choice = await dialogs.choose<"stash">({
      title: "Uncommitted Changes",
      message: "The rebase needs a clean working tree. Stash the changes, rebase, then bring them back?",
      options: [{ value: "stash", label: "Stash and Rebase", description: "git rebase -i --autostash" }],
    });
    if (choice !== "stash") {
      return;
    }
    autostash = true;
  }
  const entries = rebaseEntries(rows);
  const base = plan.base;
  const count = rows.filter((row) => row.action !== "drop").length;
  const branch = repoStore.statuses[repoRoot]?.head.branch ?? "HEAD";
  close();
  const outcome = await repoStore.runOp(
    "Rebase",
    (repoPath) => api.interactiveRebase(repoPath, base, entries, autostash),
    undefined,
    repoRoot,
  );
  if (outcome && !outcome.conflicts) {
    // An Edit row stops the rebase on purpose; the banner and the Git menu offer Continue.
    const stopped = (repoStore.statuses[repoRoot]?.op.kind ?? "none") === "rebase";
    toast.success(
      stopped
        ? "Rebase stopped for editing: amend, then Continue Rebase"
        : `Rebased ${branch}: ${count} ${count === 1 ? "commit" : "commits"}`,
    );
  }
}
