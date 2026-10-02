// The "Add to .gitignore" submenu of the Files panel and the Changes list, and what its items do.

import { api } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import type { IgnoreOutcome, IgnoreTarget } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import type { MenuItem } from "$lib/ui/menu.svelte";
import { type IgnoreChoice, ignoreChoices, KIND_HINTS } from "./gitignore";

const TARGET_NAMES: Record<IgnoreTarget, string> = {
  gitignore: ".gitignore",
  exclude: ".git/info/exclude",
};

function addedMessage(outcome: IgnoreOutcome, pattern: string, target: IgnoreTarget): string {
  const file = TARGET_NAMES[target];
  return outcome.added.length > 0 ? `Added ${pattern} to ${file}` : `${pattern} is already in ${file}`;
}

/** Tracked files stay tracked: offers `git rm --cached` for them, which the user confirms. */
async function offerUntrack(repoRoot: string, trackedPaths: string[]): Promise<void> {
  const count = trackedPaths.length;
  const what = count === 1 ? trackedPaths[0] : `${count} tracked files`;
  const confirmed = await dialogs.confirm({
    title: "Remove from Git?",
    message:
      `Tracked files stay tracked: ${what} ${count === 1 ? "is" : "are"} still in git. ` +
      `Remove ${count === 1 ? "it" : "them"} from git with git rm --cached? The files stay on disk, ` +
      "and the removal is committed like any other change.",
    confirmLabel: "Remove from Git",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  await repoStore.run("Remove from Git", (repoPath) => api.untrackFiles(repoPath, trackedPaths), {
    repoPath: repoRoot,
    success: count === 1 ? `Removed ${trackedPaths[0]} from git` : `Removed ${count} files from git`,
  });
}

export async function addToIgnore(repoRoot: string, choice: IgnoreChoice, target: IgnoreTarget): Promise<void> {
  const outcome = await repoStore.run(
    target === "gitignore" ? "Add to .gitignore" : "Add to .git/info/exclude",
    (repoPath) => api.addToIgnore(repoPath, [choice.pattern], target, [choice.scopePath]),
    { repoPath: repoRoot, success: (result) => addedMessage(result, choice.pattern, target) },
  );
  const tracked = outcome?.trackedPaths ?? [];
  if (tracked.length > 0) {
    await offerUntrack(repoRoot, tracked);
  }
}

/** Edit .gitignore: opens the root .gitignore (created empty when missing) in an editor tab. */
export async function editIgnoreFile(repoRoot: string, target: IgnoreTarget = "gitignore"): Promise<void> {
  const filePath = await repoStore.run("Open .gitignore", (repoPath) => api.ensureIgnoreFile(repoPath, target), {
    repoPath: repoRoot,
  });
  if (filePath) {
    await repoStore.openFile(filePath, { pin: true });
  }
}

function choiceItems(repoRoot: string, choices: IgnoreChoice[], target: IgnoreTarget, busy: boolean): MenuItem[] {
  return choices.map((choice) => ({
    label: choice.pattern,
    hint: KIND_HINTS[choice.kind],
    disabled: busy,
    action: () => void addToIgnore(repoRoot, choice, target),
  }));
}

/**
 * The "Add to .gitignore" submenu for a repo-relative file or folder, or null for the
 * repository root (nothing to ignore there).
 */
export function ignoreMenu(repoRoot: string, repoRelativePath: string, isDir: boolean): MenuItem | null {
  const choices = ignoreChoices(repoRelativePath, isDir);
  if (choices.length === 0) {
    return null;
  }
  const busy = repoStore.busy !== null;
  return {
    label: "Add to .gitignore",
    submenu: [
      ...choiceItems(repoRoot, choices, "gitignore", busy),
      { separator: true },
      { label: "Add to .git/info/exclude", submenu: choiceItems(repoRoot, choices, "exclude", busy) },
      { separator: true },
      { label: "Edit .gitignore", action: () => void editIgnoreFile(repoRoot) },
    ],
  };
}
