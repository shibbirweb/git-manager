// The AI panel's actions: the menus of its rows, New Worktree and Remove Worktree. Remove runs on the row's own
// repository, not the active one, and closes the agent tabs in the worktree first.

import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import type { WorktreeInfo } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import type { MenuItem } from "$lib/ui/menu.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { platformName } from "$lib/update/releases";
import { revealLabel } from "$lib/views/files/reveal";
import { gitDialogs } from "$lib/views/git/gitDialogs.svelte";
import { worktreeLabel } from "$lib/views/git/worktrees/worktreeModel";
import { aiStore } from "./aiStore.svelte";
import { finishTask } from "./aiTasks";
import type { PanelRow } from "./projects";
import { agentSessions, sessionMenu, startMenu } from "./sessions.svelte";

async function copyPath(folderPath: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(folderPath);
    toast.success("Copied path");
  } catch (error) {
    toast.error("Could not copy the path", errorMessage(error));
  }
}

async function reveal(folderPath: string): Promise<void> {
  try {
    await revealItemInDir(folderPath);
  } catch (error) {
    toast.error("Could not reveal the folder", errorMessage(error));
  }
}

/** New Task: a worktree (or a race of several) with an agent, from the repository's default branch. */
export function newTask(repoRoot: string): void {
  if (repoStore.busy === null) {
    gitDialogs.open({ kind: "newTask", repoRoot });
  }
}

export function newWorktree(repoRoot: string): void {
  if (repoStore.busy === null) {
    gitDialogs.open({ kind: "newWorktree", repoRoot, startAgent: true });
  }
}

/** Removes a linked worktree of `repoRoot`, closing the agent tabs that run in it; asks first. */
async function removeWorktree(repoRoot: string, worktree: WorktreeInfo): Promise<void> {
  const inside = agentSessions().filter(
    (session) => session.folderPath === worktree.path || session.folderPath.startsWith(`${worktree.path}/`),
  );
  const dirty = await api.worktreeHasChanges(worktree.path).catch(() => false);
  const label = worktreeLabel(worktree);
  const agentsNote = inside.length > 0 ? ` Its ${inside.length === 1 ? "agent tab is" : `${inside.length} agent tabs are`} closed.` : "";
  const confirmed = await dialogs.confirm({
    title: dirty ? "Worktree Has Changes" : "Remove Worktree",
    message: dirty
      ? `${worktree.path} (${label}) has uncommitted or untracked changes. Remove it anyway? The changes will be lost.${agentsNote}`
      : `Remove the worktree at ${worktree.path} (${label})? Its folder is deleted; the branch stays.${agentsNote}`,
    confirmLabel: dirty ? "Force Remove" : "Remove",
    danger: true,
  });
  if (!confirmed) {
    return;
  }
  for (const session of inside) {
    terminalStore.close(session.terminalKey);
  }
  const workspace = repoStore.workspace;
  if (workspace?.folders.some((folder) => folder.root === worktree.path) && workspace.folders.length > 1) {
    await repoStore.removeFolder(worktree.path);
  }
  await repoStore.run("Remove worktree", (repoPath) => api.removeWorktree(repoPath, worktree.path, dirty), {
    repoPath: repoRoot,
    success: `Removed worktree ${label}`,
  });
  await aiStore.reload();
}

function folderMenu(folderPath: string, missing: boolean): MenuItem[] {
  const inWorkspace = repoStore.workspace?.folders.some((folder) => folder.root === folderPath) ?? false;
  return [
    { label: "Start Agent", disabled: missing, submenu: startMenu(folderPath) },
    { separator: true },
    {
      label: "Open in Terminal",
      disabled: missing,
      action: () => void terminalStore.create({ folderPath, location: "editor" }),
    },
    { label: "Add to Workspace", disabled: missing || inWorkspace, action: () => void repoStore.addFolder(folderPath) },
    { separator: true },
    { label: revealLabel(platformName(navigator.userAgent)), disabled: missing, action: () => void reveal(folderPath) },
    { label: "Copy Path", action: () => void copyPath(folderPath) },
  ];
}

export function rowMenu(row: PanelRow): MenuItem[] {
  switch (row.kind) {
    case "project":
      return row.project.isRepo
        ? [
            { label: "New Task...", disabled: repoStore.busy !== null, action: () => newTask(row.project.root) },
            { label: "New Worktree...", disabled: repoStore.busy !== null, action: () => newWorktree(row.project.root) },
            { separator: true },
            ...folderMenu(row.project.root, false),
          ]
        : folderMenu(row.project.root, false);
    case "worktree": {
      const worktree = row.worktree;
      const removable = !worktree.isMain && !worktree.isCurrent && !worktree.locked && !row.missing;
      return [
        ...folderMenu(row.path, row.missing),
        { separator: true },
        {
          label: worktree.locked ? "Finish Task (unlock first)" : "Finish Task...",
          hint: "remove worktree and branch",
          danger: true,
          disabled: repoStore.busy !== null || !removable,
          action: () => void finishTask(row.project.root, worktree),
        },
        {
          label: worktree.locked ? "Remove Worktree (unlock first)" : "Remove Worktree...",
          hint: "keep the branch",
          danger: true,
          disabled: repoStore.busy !== null || !removable,
          action: () => void removeWorktree(row.project.root, worktree),
        },
      ];
    }
    case "session":
      return sessionMenu(row.session.terminalKey);
    default:
      return [];
  }
}
