// New Task, like Orca: a task name becomes a branch and a worktree folder, once per agent when several agents race
// on the same task. Pure, so it is tested directly.

import { defaultWorktreePath } from "$lib/views/git/worktrees/worktreeModel";

/** Most worktrees one task makes at once. */
export const MAX_RACE = 5;

/** A task name as a branch name: "Fix the login race!" becomes "fix-the-login-race". */
export function taskSlug(taskName: string): string {
  return taskName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/._-]+/g, "-")
    .replace(/[/._-]{2,}/g, (run) => (run.includes("/") ? "/" : "-"))
    .replace(/^[-./]+|[-./]+$/g, "")
    .slice(0, 60)
    .replace(/[-./]+$/g, "");
}

/** One worktree of a task: its branch and folder. */
export interface TaskWorktree {
  branchName: string;
  folderPath: string;
}

/**
 * The branches and folders for `count` worktrees of one task: `branch`, then `branch-2`, `branch-3`..., skipping
 * names a branch or folder already has, so a race never collides with earlier work.
 */
export function taskWorktrees(
  mainRoot: string,
  branch: string,
  count: number,
  takenBranches: ReadonlySet<string>,
  takenFolders: ReadonlySet<string>,
): TaskWorktree[] {
  const result: TaskWorktree[] = [];
  const usedBranches = new Set(takenBranches);
  const usedFolders = new Set(takenFolders);
  for (let suffix = 1; result.length < Math.max(0, count) && suffix < 1000; suffix++) {
    const branchName = suffix === 1 ? branch : `${branch}-${suffix}`;
    const folderPath = defaultWorktreePath(mainRoot, branchName);
    if (usedBranches.has(branchName) || usedFolders.has(folderPath)) {
      continue;
    }
    usedBranches.add(branchName);
    usedFolders.add(folderPath);
    result.push({ branchName, folderPath });
  }
  return result;
}
