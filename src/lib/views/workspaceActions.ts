// What the window-wide shortcuts do (workspaceShortcuts.ts decides which key means which),
// shared by Workspace.svelte's key handler and the View and Edit menus, so a key and its
// menu item always run the same code.

import { fileSearch } from "$lib/search/fileSearchStore.svelte";
import { focusedEditor } from "$lib/editor/editorCommands";
import { openerForShortcut, queryFromSelection, type SearchOpener } from "$lib/search/searchTabs";
import { navigation } from "$lib/stores/navigation.svelte";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { adjacentTab } from "$lib/stores/tabs";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import { dialogs } from "$lib/ui/dialog.svelte";
import { updates } from "$lib/update/updates.svelte";
import { changesSelection } from "./changes/selection.svelte";
import { gitDialogs } from "./git/gitDialogs.svelte";
import type { WorkspaceShortcut } from "./workspaceShortcuts";

/** The window shortcuts wait while a dialog, the Search Everywhere popup or the merge tool is up. */
export function shortcutsBlocked(): boolean {
  return dialogs.active !== null || gitDialogs.active !== null || fileSearch.isOpen || repoStore.mergeTarget !== null;
}

/** Search Everywhere waits while any dialog or the merge tool is up. */
function overlayOpen(): boolean {
  return (
    dialogs.active !== null ||
    gitDialogs.active !== null ||
    repoStore.mergeTarget !== null ||
    repoStore.conflictsOpen ||
    settings.dialogOpen ||
    updates.dialogOpen ||
    updates.whatsNewOpen
  );
}

/** The focused editor's selected text, read from its state so decorations never leak in. */
function editorSelection(): string {
  const view = focusedEditor()?.view ?? null;
  if (!view) {
    return "";
  }
  const { from, to } = view.state.selection.main;
  return queryFromSelection(view.state.sliceDoc(from, to));
}

/** Opens Search Everywhere; every tab starts with the editor's selection, like JetBrains. */
export function openFileSearch(opener: SearchOpener, replace = false): void {
  if (!overlayOpen()) {
    fileSearch.open(opener, editorSelection(), replace);
  }
}

export function runWorkspaceShortcut(shortcut: WorkspaceShortcut): void {
  switch (shortcut) {
    case "goBack":
      void navigation.goBack();
      break;
    case "goForward":
      void navigation.goForward();
      break;
    case "toggleExplorer":
      settings.toggleExplorer();
      break;
    case "toggleWordWrap":
      settings.toggleWordWrap();
      break;
    case "toggleSidebar":
      settings.setLeftPanel(settings.leftPanel === null ? "changes" : null);
      break;
    case "showChanges":
      settings.setLeftPanel("changes");
      break;
    case "showBranches":
      settings.setLeftPanel("branches");
      break;
    case "toggleLog":
      changesSelection.toggleLog();
      break;
    case "toggleTerminal":
      terminalStore.toggle();
      break;
    case "newTerminal":
      void terminalStore.create();
      break;
    case "goToFile":
    case "goToClass":
    case "goToSymbol":
    case "findInFiles":
      openFileSearch(openerForShortcut(shortcut) ?? "files");
      break;
    case "replaceInFiles":
      openFileSearch("text", true);
      break;
    case "nextTab":
    case "previousTab":
      switchTab(shortcut === "nextTab" ? 1 : -1);
      break;
  }
}

function switchTab(step: 1 | -1): void {
  const activePath = changesSelection.shownView === "file" ? repoStore.openFilePath : null;
  const next = adjacentTab(repoStore.tabs, activePath, step);
  if (next) {
    void repoStore.openFile(next);
  }
}
