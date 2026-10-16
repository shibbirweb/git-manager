// What an open workspace keeps running while it shows: the window keys (with Double Shift and the mouse side
// buttons), the open files' watcher, the Changes selection, background fetches, and cleanup when it closes.
// Workspace.svelte calls runWorkspace() once while it starts.
import { onDestroy, onMount, untrack } from "svelte";
import { api } from "$lib/api";
import { runCommand, windowKeys } from "$lib/commands/commandRuntime";
import { navBarStore } from "$lib/navBar/navBarStore.svelte";
import { quickOpen } from "$lib/quickOpen/quickOpenStore.svelte";
import { recentFilesStore } from "$lib/recentFiles/recentFilesStore.svelte";
import { DoubleShift } from "$lib/search/doubleShift";
import { fileSearch } from "$lib/search/fileSearchStore.svelte";
import { autoFetch } from "$lib/stores/autoFetch.svelte";
import { navigation } from "$lib/stores/navigation.svelte";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import { dialogs } from "$lib/ui/dialog.svelte";
import { changesSelection } from "./changes/selection.svelte";
import { gitDialogs } from "./git/gitDialogs.svelte";
import { followOpenTab } from "./repoSelection.svelte";
import { openFileSearch, runWorkspaceShortcut } from "./workspaceActions";
import { textFieldKeeps, WINDOW_COMMANDS, windowCommand } from "./workspaceShortcuts";

export function runWorkspace(): void {
  // Settings > Editor > Split editor turned off: every group's tabs join the first group.
  $effect(() => {
    if (!settings.splitEditor) {
      untrack(() => repoStore.mergeGroups());
    }
  });

  // Closing the workspace (Close Folder) stops its shells.
  onDestroy(() => terminalStore.closeAll());

  // The selected change must stay valid even while the Changes sidebar is hidden.
  $effect(() => {
    void repoStore.statuses;
    void repoStore.fileVersions;
    void repoStore.repos;
    untrack(() => changesSelection.sync());
  });

  // The watcher reports changes to the open files even where git ignores them (a log file).
  let watchedFiles = "";
  $effect(() => {
    const filePaths = repoStore.openFilePaths;
    const key = filePaths.join("\0");
    if (key !== watchedFiles) {
      watchedFiles = key;
      void api.watchOpenFiles(filePaths).catch(() => undefined);
    }
  });
  onDestroy(() => void api.watchOpenFiles([]).catch(() => undefined));

  // With Auto (status bar repository picker), the active repository follows the open tab.
  followOpenTab();

  // Recent Files (Cmd+E) follows the tab on screen and the files edited.
  recentFilesStore.follow();

  // A new workspace starts with nothing selected and an empty Back / Forward history.
  $effect(() => {
    void repoStore.workspace?.root;
    untrack(() => {
      changesSelection.reset();
      navigation.clear();
    });
  });

  // Double Shift opens Search Everywhere. Capture phase, so it is seen
  // even when an editor or the terminal handles the key itself.
  const doubleShift = new DoubleShift();
  onMount(() => {
    const onShiftKey = (event: KeyboardEvent) => {
      if (doubleShift.handle(event) && !fileSearch.isOpen) {
        openFileSearch("everywhere");
      }
    };
    const onBlur = () => doubleShift.reset();
    window.addEventListener("keydown", onShiftKey, true);
    window.addEventListener("keyup", onShiftKey, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onShiftKey, true);
      window.removeEventListener("keyup", onShiftKey, true);
      window.removeEventListener("blur", onBlur);
    };
  });

  // Background fetches run while a workspace is open (Settings > Git > Auto fetch).
  onMount(() => autoFetch.start());

  // Closing the workspace closes the popup too.
  onDestroy(() => fileSearch.close());

  // Mouse side buttons navigate like in a browser.
  function onMouseUp(event: MouseEvent): void {
    if (event.button === 3) {
      event.preventDefault();
      void navigation.goBack();
    } else if (event.button === 4) {
      event.preventDefault();
      void navigation.goForward();
    }
  }

  /**
   * The window shortcuts (workspaceShortcuts.ts lists them) and every command with a custom key
   * from Settings > Keyboard Shortcuts.
   */
  function onKeydown(event: KeyboardEvent): void {
    const command = windowCommand(
      event,
      {
        dialogOpen:
          dialogs.active !== null ||
          gitDialogs.active !== null ||
          fileSearch.isOpen ||
          quickOpen.isOpen ||
          recentFilesStore.isOpen ||
          navBarStore.isOpen,
        mergeOpen: repoStore.mergeTarget !== null,
      },
      windowKeys(),
    );
    if (!command || textFieldKeeps(command.id, event.target)) {
      return;
    }
    // The menus show these keys too; the page sees a key first, so preventing its default
    // here keeps the menu item from running it a second time.
    event.preventDefault();
    const shortcut = WINDOW_COMMANDS[command.id];
    if (shortcut) {
      runWorkspaceShortcut(shortcut);
    } else {
      runCommand(command.id);
    }
  }

  onMount(() => {
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  });
}
