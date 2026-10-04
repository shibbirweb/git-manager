// get_app_state and list_terminals: what the window shows now, read from the stores.

import { isBranchTab } from "$lib/stores/branchTabs";
import { isCompareTab } from "$lib/compare/compareTabs";
import { isCommitTab } from "$lib/stores/commitTabs";
import { fileCommands } from "$lib/stores/fileCommands.svelte";
import { isGitTab } from "$lib/stores/gitTabs";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { quickOpen } from "$lib/quickOpen/quickOpenStore.svelte";
import { navBarStore } from "$lib/navBar/navBarStore.svelte";
import { recentFilesStore } from "$lib/recentFiles/recentFilesStore.svelte";
import { fileSearch } from "$lib/search/fileSearchStore.svelte";
import { isTerminalTab } from "$lib/terminal/terminalTabs";
import { type TerminalEntry, terminalStore } from "$lib/terminal/terminalStore.svelte";
import type { RepoStatus } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { updates } from "$lib/update/updates.svelte";
import { changesSelection } from "$lib/views/changes/selection.svelte";
import { gitDialogs } from "$lib/views/git/gitDialogs.svelte";
import { helpDialogs } from "$lib/help/helpDialogs.svelte";
import { localHistory } from "$lib/localHistory/localHistory.svelte";
import { notifications } from "$lib/notifications/notifications.svelte";
import { mcpStore } from "./mcpStore.svelte";

function tabKind(tabPath: string): "file" | "terminal" | "commit" | "git" | "branch" | "compare" {
  if (isCompareTab(tabPath)) {
    return "compare";
  }
  if (isTerminalTab(tabPath)) {
    return "terminal";
  }
  if (isCommitTab(tabPath)) {
    return "commit";
  }
  if (isGitTab(tabPath)) {
    return "git";
  }
  return isBranchTab(tabPath) ? "branch" : "file";
}

function changeCounts(status: RepoStatus | null): { staged: number; unstaged: number; untracked: number; conflicted: number } {
  const files = status?.files ?? [];
  return {
    staged: files.filter((file) => file.staged !== null).length,
    unstaged: files.filter((file) => file.unstaged !== null && file.unstaged !== "untracked").length,
    untracked: files.filter((file) => file.unstaged === "untracked").length,
    conflicted: files.filter((file) => file.conflicted).length,
  };
}

/** The dialog or popup on top of the window, if any; app questions come first. */
export function openDialog(): { kind: string; title: string | null } | null {
  const active = dialogs.active;
  if (active) {
    return { kind: `question:${active.type}`, title: active.options.title };
  }
  if (gitDialogs.active) {
    return { kind: `git:${gitDialogs.active.kind}`, title: null };
  }
  if (repoStore.mergeTarget) {
    return { kind: "mergeTool", title: repoStore.mergeTarget };
  }
  if (repoStore.conflictsOpen) {
    return { kind: "conflicts", title: "Conflicts" };
  }
  if (fileSearch.isOpen) {
    return { kind: "fileSearch", title: "Search" };
  }
  if (quickOpen.isOpen) {
    return { kind: "quickOpen", title: "Quick Open" };
  }
  if (recentFilesStore.isOpen) {
    return { kind: "recentFiles", title: "Recent Files" };
  }
  if (navBarStore.isOpen) {
    return { kind: "navigationBar", title: "Navigation Bar" };
  }
  if (settings.dialogOpen) {
    return { kind: "settings", title: "Settings" };
  }
  if (helpDialogs.shortcutsOpen) {
    return { kind: "keyboardShortcuts", title: "Keyboard Shortcuts" };
  }
  if (mcpStore.toolsDialogOpen) {
    return { kind: "mcpTools", title: "Available MCP Tools" };
  }
  if (updates.whatsNewOpen) {
    return { kind: "whatsNew", title: "What's New" };
  }
  if (updates.dialogOpen) {
    return { kind: "update", title: "Update" };
  }
  if (localHistory.isOpen) {
    return { kind: "localHistory", title: "Local History" };
  }
  if (notifications.open) {
    return { kind: "notifications", title: "Notifications" };
  }
  return null;
}

export function terminalInfo(terminal: TerminalEntry): Record<string, unknown> {
  return {
    key: terminal.key,
    name: terminal.name,
    kind: terminal.location === "run" ? "run" : "terminal",
    location: terminal.location,
    folder: terminal.cwd,
    started: terminal.terminalId !== null,
    running: terminal.terminalId !== null && !terminal.exited,
    exitCode: terminal.exitCode,
    command: terminal.run?.description ?? null,
  };
}

export function terminalList(): Record<string, unknown> {
  return {
    terminals: terminalStore.terminals.map(terminalInfo),
    panelTerminal: terminalStore.activeKey,
    runTabSession: terminalStore.runActiveKey,
    bottomPanel: { open: terminalStore.panelOpen, tab: terminalStore.panelTab },
  };
}

export function appState(): Record<string, unknown> {
  const workspace = repoStore.workspace;
  const repo = repoStore.repo;
  const status = repoStore.status;
  const shownView = changesSelection.shownView;
  const tabOnScreen = shownView === "file" ? repoStore.openFilePath : null;
  const fileState = tabOnScreen ? (fileCommands.states[tabOnScreen] ?? null) : null;
  return {
    workspace: workspace
      ? {
          name: workspace.name,
          workspaceFile: workspace.file,
          folders: workspace.folders.map((folder) => ({ root: folder.root, name: folder.name, repoRoots: folder.repoRoots })),
        }
      : null,
    repositories: repoStore.repos.map((info) => {
      const repoStatus = repoStore.statuses[info.root] ?? null;
      return {
        root: info.root,
        name: info.name,
        branch: repoStatus?.head.branch ?? null,
        changes: repoStatus?.files.length ?? null,
        submodule: info.submodule ?? false,
        worktree: info.worktree ?? false,
      };
    }),
    activeRepository: repo
      ? {
          root: repo.root,
          name: repo.name,
          branch: status?.head.branch ?? null,
          detached: status ? status.head.branch === null && !status.head.unborn : false,
          headCommit: status?.head.shortId ?? null,
          unborn: status?.head.unborn ?? false,
          upstream: status?.head.upstream ?? null,
          ahead: status?.head.ahead ?? 0,
          behind: status?.head.behind ?? 0,
          operation: status?.op.kind ?? "none",
          changes: changeCounts(status),
          busy: repoStore.busy,
        }
      : null,
    tabs: repoStore.tabs.map((tab) => ({ path: tab.path, kind: tabKind(tab.path), dirty: tab.dirty, preview: tab.preview })),
    tabOnScreen,
    shownView,
    diffSelection: shownView === "diff" ? changesSelection.selected : null,
    leftPanel: settings.leftPanel,
    filesPanelOpen: settings.explorerOpen,
    bottomPanel: { open: terminalStore.panelOpen, tab: terminalStore.panelTab },
    terminals: terminalStore.terminals.map(terminalInfo),
    theme: settings.theme,
    darkMode:
      settings.theme === "dark" || (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches),
    dialog: openDialog(),
    markdownMode: fileState?.markdownMode ?? null,
  };
}
