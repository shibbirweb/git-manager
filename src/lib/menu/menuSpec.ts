// The native menu bar, as plain data: appMenu.svelte.ts turns it into Tauri menus and
// menuActions.ts runs the items. Pure, so the tests can check ids, accelerators and the
// per-platform layout.
//
// Keys and the menu: macOS gives a key equivalent to the web view first and only passes it
// to the menu when the page leaves it unhandled. So a key the page handles (the editor's
// keymaps, the window shortcuts in workspaceShortcuts.ts) never also runs its menu item, and
// an accelerator only the menu knows (Cmd+W, Option+Cmd+S, Cmd+=...) still reaches it from
// the editor, the terminal or a text field. Both routes call the same functions.

import { acceleratorFor, EDITOR_SHORTCUTS, shortcutKey } from "$lib/editor/editorShortcuts";
import type { EditorAction, MenuAction, MenuMode, MenuPlatform } from "./menuIds";

/** Items the system implements (Tauri's predefined menu items). */
export type NativeItem =
  | "Cut"
  | "Copy"
  | "Paste"
  | "Services"
  | "Hide"
  | "HideOthers"
  | "ShowAll"
  | "Quit"
  | "Minimize"
  | "Maximize"
  | "Fullscreen"
  | "CloseWindow"
  | "BringAllToFront";

export type MenuEntry =
  | { kind: "action"; action: MenuAction; text: string; accelerator: string | null; check: boolean }
  | { kind: "native"; item: NativeItem; text: string | null }
  /** `visibleWith`: shown only while one of those items is (see `visible` in menuState.ts). */
  | { kind: "separator"; visibleWith?: MenuAction[] }
  | { kind: "submenu"; text: string; items: MenuEntry[]; visibleWith?: MenuAction[] }
  /** File > Open Recent: filled from the recent folders and workspaces, then `clear`. */
  | { kind: "recent"; text: string; clear: ActionEntry };

export type ActionEntry = Extract<MenuEntry, { kind: "action" }>;

export interface TopMenu {
  text: string;
  /** macOS lists the open windows in the "window" menu and puts a search field in the "help" one. */
  role: "window" | "help" | null;
  items: MenuEntry[];
}

export const APP_NAME = "Git Manager";

function item(action: MenuAction, text: string, accelerator: string | null = null): ActionEntry {
  return { kind: "action", action, text, accelerator, check: false };
}

function check(action: MenuAction, text: string, accelerator: string | null = null): MenuEntry {
  return { kind: "action", action, text, accelerator, check: true };
}

function native(nativeItem: NativeItem, text: string | null = null): MenuEntry {
  return { kind: "native", item: nativeItem, text };
}

const separator: MenuEntry = { kind: "separator" };

function editorItem(action: EditorAction, text: string, platform: MenuPlatform): MenuEntry {
  const shortcut = EDITOR_SHORTCUTS[action];
  return item(action, text, shortcut ? acceleratorFor(shortcutKey(shortcut, platform)) : null);
}

function appMenu(mode: MenuMode): TopMenu {
  return {
    text: APP_NAME,
    role: null,
    items: [
      item("app.about", `About ${APP_NAME}`),
      ...(mode === "app" ? [item("app.checkForUpdates", "Check for Updates...")] : []),
      separator,
      item("app.settings", "Settings...", "CmdOrCtrl+,"),
      separator,
      native("Services"),
      separator,
      native("Hide", `Hide ${APP_NAME}`),
      native("HideOthers", "Hide Others"),
      native("ShowAll", "Show All"),
      separator,
      native("Quit", `Quit ${APP_NAME}`),
    ],
  };
}

function fileMenu(platform: MenuPlatform): TopMenu {
  const items: MenuEntry[] = [
    item("file.newWindow", "New Window", "CmdOrCtrl+Shift+N"),
    separator,
    item("file.openFolder", "Open Folder..."),
    item("file.openFolderNewWindow", "Open Folder in New Window..."),
    item("file.openWorkspace", "Open Workspace from File..."),
    { kind: "recent", text: "Open Recent", clear: item("file.clearRecent", "Clear Recent") },
    separator,
    item("file.addFolder", "Add Folder to Workspace..."),
    item("file.saveWorkspace", "Save Workspace As..."),
    separator,
    item("file.save", "Save", "CmdOrCtrl+S"),
    item("file.saveAll", "Save All", "CmdOrCtrl+Alt+S"),
    item("file.revert", "Revert File"),
    item("file.compareWithClipboard", "Compare with Clipboard"),
    item("file.compareWith", "Compare with..."),
    item("file.localHistory", "Show Local History"),
    item("file.recentlyDeleted", "Recently Deleted Files..."),
    separator,
    item("file.closeTab", "Close Tab", "CmdOrCtrl+W"),
    item("file.reopenClosedTab", "Reopen Closed Tab", "CmdOrCtrl+Shift+T"),
    item("file.closeFolder", "Close Folder"),
    item("file.closeWindow", "Close Window", "CmdOrCtrl+Shift+W"),
  ];
  if (platform !== "macos") {
    items.push(separator, item("app.settings", "Settings...", "CmdOrCtrl+,"), separator, native("Quit", "Exit"));
  }
  return { text: "File", role: null, items };
}

function editMenu(platform: MenuPlatform, mode: MenuMode): TopMenu {
  const mac = platform === "macos";
  const items: MenuEntry[] = [
    // Custom items, so Undo and Redo reach the focused CodeMirror editor (its own history)
    // and fall back to the web view's undo in text fields. Elsewhere the page handles
    // these keys itself; an accelerator there would only take Ctrl+Z / Ctrl+A from the shell.
    item("edit.undo", "Undo", mac ? "CmdOrCtrl+Z" : null),
    item("edit.redo", "Redo", mac ? "Shift+CmdOrCtrl+Z" : null),
    separator,
    native("Cut"),
    native("Copy"),
    native("Paste"),
    item("edit.delete", "Delete"),
    item("edit.selectAll", "Select All", mac ? "CmdOrCtrl+A" : null),
    separator,
    editorItem("edit.find", "Find...", platform),
    editorItem("edit.replace", "Replace...", platform),
    editorItem("edit.findNext", "Find Next", platform),
    editorItem("edit.findPrevious", "Find Previous", platform),
    editorItem("edit.selectAllOccurrences", "Select All Occurrences", platform),
  ];
  if (mode === "app") {
    items.push(
      separator,
      item("edit.findInFiles", "Find in Files...", "CmdOrCtrl+Shift+F"),
      item("edit.replaceInFiles", "Replace in Files...", "CmdOrCtrl+Shift+R"),
      separator,
      // Cmd+P is Quick Open; Shift+Cmd+O still opens Search Everywhere on Files.
      item("edit.goToFile", "Go to File...", "CmdOrCtrl+P"),
      // Cmd+E; the commit message box keeps it for its history while focused.
      item("edit.recentFiles", "Recent Files...", "CmdOrCtrl+E"),
      // On macOS the editor gives Cmd+Up up for it (Cmd+Home still goes to the top).
      item("edit.navigationBar", "Jump to Navigation Bar", mac ? "Cmd+Up" : "Alt+Home"),
      item("edit.goToClass", "Go to Class...", "CmdOrCtrl+O"),
      item("edit.goToSymbol", "Go to Symbol...", "CmdOrCtrl+Alt+O"),
      // Double Shift cannot be a menu accelerator, so the label tells it.
      item("edit.searchEverywhere", "Search Everywhere (Double Shift)"),
    );
  }
  return { text: "Edit", role: null, items };
}

function viewMenu(platform: MenuPlatform): TopMenu {
  const items: MenuEntry[] = [
    // Quick Open with ">" typed.
    item("view.commandPalette", "Command Palette...", "CmdOrCtrl+Shift+P"),
    separator,
    // Shift+Cmd+G is Find Previous in the Edit menu; outside an editor it still shows Changes.
    check("view.changes", "Changes"),
    check("view.branches", "Branches and Stashes", "CmdOrCtrl+Shift+E"),
    check("view.scripts", "Scripts"),
    check("view.log", "Log", "CmdOrCtrl+Shift+L"),
    check("view.filesPanel", "Files Panel", "CmdOrCtrl+Alt+B"),
    check("view.sidebar", "Sidebar", "CmdOrCtrl+B"),
    check("view.terminal", "Terminal", "Ctrl+`"),
    check("view.gitConsole", "Git Console"),
    check("view.leftActivityBar", "Left Activity Bar"),
    check("view.rightActivityBar", "Right Activity Bar"),
    {
      kind: "submenu",
      text: "File Icons",
      items: [check("view.fileIconsOff", "No Icons"), check("view.fileIconsMinimal", "Minimal"), check("view.fileIconsMaterial", "Material Icons")],
    },
    item("view.notifications", "Notifications"),
    check("view.doNotDisturb", "Do Not Disturb"),
    separator,
    check("view.wordWrap", "Word Wrap", "Alt+Z"),
    check("view.stickyScroll", "Sticky Scroll"),
    check("view.minimap", "Minimap"),
    check("view.detectIndentation", "Detect Indentation"),
    {
      kind: "submenu",
      text: "Markdown",
      items: [
        check("view.markdownEditor", "Editor Only"),
        check("view.markdownSplit", "Editor and Preview"),
        check("view.markdownPreview", "Preview Only"),
      ],
    },
    separator,
    {
      kind: "submenu",
      text: "Appearance",
      items: [check("view.themeLight", "Light"), check("view.themeDark", "Dark"), check("view.themeSystem", "System")],
    },
    item("view.zoomIn", "Zoom In", "CmdOrCtrl+="),
    item("view.zoomOut", "Zoom Out", "CmdOrCtrl+-"),
    item("view.zoomReset", "Reset Zoom", "CmdOrCtrl+0"),
  ];
  if (platform === "macos") {
    items.push(separator, native("Fullscreen", "Enter Full Screen"));
  }
  return { text: "View", role: null, items };
}

function codeMenu(platform: MenuPlatform): TopMenu {
  const editor = (action: EditorAction, text: string) => editorItem(action, text, platform);
  return {
    text: "Code",
    role: null,
    items: [
      editor("code.lineComment", "Comment with Line Comment"),
      editor("code.blockComment", "Comment with Block Comment"),
      separator,
      editor("code.duplicate", "Duplicate Line or Selection"),
      editor("code.deleteLine", "Delete Line"),
      editor("code.joinLines", "Join Lines"),
      editor("code.moveLineUp", "Move Line Up"),
      editor("code.moveLineDown", "Move Line Down"),
      separator,
      editor("code.indent", "Indent Line"),
      editor("code.unindent", "Unindent Line"),
      separator,
      editor("code.toggleCase", "Toggle Case"),
      editor("code.sortLines", "Sort Lines"),
      separator,
      {
        kind: "submenu",
        text: "Folding",
        items: [
          editor("code.expand", "Expand"),
          editor("code.collapse", "Collapse"),
          editor("code.expandAll", "Expand All"),
          editor("code.collapseAll", "Collapse All"),
        ],
      },
      separator,
      editor("code.goToLine", "Go to Line..."),
      editor("code.selectNextOccurrence", "Select Next Occurrence"),
    ],
  };
}

/**
 * The Git menu. Its keys (Cmd+K, Cmd+T, Cmd+9, Option+Cmd+A) are macOS only: elsewhere
 * Ctrl+K and Ctrl+T belong to the shell in the terminal. Cmd+K stays the Markdown link in a
 * Markdown editor and clears the terminal there (the page sees the key first). Shift+Cmd+K is
 * Delete Line in the Code menu, so Push has no key.
 */
function gitMenu(platform: MenuPlatform): TopMenu {
  const key = (accelerator: string) => (platform === "macos" ? accelerator : null);
  const operation: MenuAction[] = ["git.resolveConflicts", "git.continueOp", "git.abortOp", "git.skipCommit"];
  return {
    text: "Git",
    role: null,
    items: [
      item("git.commit", "Commit...", key("Cmd+K")),
      item("git.push", "Push..."),
      item("git.updateProject", "Update Project...", key("Cmd+T")),
      item("git.pull", "Pull..."),
      item("git.fetchCurrent", "Fetch"),
      item("git.fetch", "Fetch All Remotes"),
      separator,
      item("git.merge", "Merge..."),
      item("git.rebase", "Rebase..."),
      item("git.interactiveRebase", "Interactive Rebase..."),
      item("git.branches", "Branches..."),
      item("git.newBranch", "New Branch..."),
      item("git.newTag", "New Tag..."),
      item("git.resetHead", "Reset HEAD..."),
      item("git.undoLast", "Undo Last Action..."),
      { kind: "separator", visibleWith: operation },
      item("git.resolveConflicts", "Resolve Conflicts..."),
      item("git.continueOp", "Continue"),
      item("git.abortOp", "Abort"),
      item("git.skipCommit", "Skip Commit"),
      separator,
      item("git.showLog", "Show Git Log", key("Cmd+9")),
      item("git.showConsole", "Show Git Console"),
      item("git.showReflog", "Show Reflog"),
      separator,
      {
        kind: "submenu",
        text: "Bisect",
        items: [
          item("git.bisect.start", "Start..."),
          separator,
          item("git.bisect.good", "Mark Good"),
          item("git.bisect.bad", "Mark Bad"),
          item("git.bisect.skip", "Skip"),
          separator,
          item("git.bisect.reset", "Reset"),
        ],
      },
      {
        kind: "submenu",
        text: "Patch",
        items: [
          item("git.patch.create", "Create Patch..."),
          item("git.patch.createFromCommit", "Create Patch from Commit..."),
          separator,
          item("git.patch.apply", "Apply Patch..."),
          item("git.patch.applyClipboard", "Apply Patch from Clipboard"),
        ],
      },
      {
        kind: "submenu",
        text: "Uncommitted Changes",
        items: [
          // The Changes diff's selection (DiffView); like the Git keys above, macOS only.
          item("git.lines.stage", "Stage Selected Lines", key("Cmd+Alt+Shift+S")),
          item("git.lines.unstage", "Unstage Selected Lines", key("Cmd+Alt+Shift+U")),
          item("git.lines.discard", "Discard Selected Lines...", key("Cmd+Alt+Shift+D")),
          separator,
          item("git.stash", "Stash Changes..."),
          item("git.unstash", "Unstash Changes..."),
          separator,
          item("git.shelve", "Shelve Changes..."),
          item("git.showShelf", "Show Shelf"),
          separator,
          item("git.rollback", "Rollback..."),
          item("git.showLocalChanges", "Show Local Changes"),
        ],
      },
      {
        kind: "submenu",
        text: "Current File",
        items: [
          item("git.file.commit", "Commit File..."),
          item("git.file.add", "Add to Git", key("Cmd+Alt+A")),
          separator,
          check("git.file.annotate", "Annotate with Git Blame"),
          item("git.file.showDiff", "Show Diff"),
          item("git.file.compareRevision", "Compare with Revision..."),
          item("git.file.compareBranch", "Compare with Branch..."),
          separator,
          item("git.file.history", "Show History"),
          item("git.file.historySelection", "Show History for Selection"),
          separator,
          item("git.file.rollback", "Rollback File..."),
        ],
      },
      {
        kind: "submenu",
        text: "Worktrees",
        items: [
          item("git.worktree.new", "New Worktree..."),
          item("git.worktree.show", "Show Worktrees"),
          separator,
          item("git.worktree.prune", "Prune Stale Worktrees"),
        ],
      },
      {
        kind: "submenu",
        text: "Submodules",
        items: [
          item("git.submodule.init", "Init Submodules"),
          item("git.submodule.update", "Update Submodules"),
          item("git.submodule.updateRemote", "Update to Latest Remote"),
          item("git.submodule.sync", "Sync URLs"),
          separator,
          item("git.submodule.add", "Add Submodule..."),
          item("git.submodule.remove", "Remove Submodule..."),
          separator,
          item("git.submodule.open", "Open Submodule as Repository..."),
        ],
      },
      {
        kind: "submenu",
        text: "LFS",
        items: [
          item("git.lfs.track", "Track Pattern..."),
          item("git.lfs.untrack", "Untrack Pattern..."),
          separator,
          item("git.lfs.pull", "Pull LFS Objects"),
          item("git.lfs.fetch", "Fetch LFS Objects"),
          item("git.lfs.prune", "Prune LFS Objects..."),
          separator,
          item("git.lfs.install", "Install Hooks"),
        ],
      },
      separator,
      item("git.manageRemotes", "Manage Remotes..."),
      item("git.openRemote", "Open Repository in Browser"),
      item("git.clone", "Clone..."),
      {
        kind: "submenu",
        text: "GitHub",
        visibleWith: ["git.github.share"],
        items: [
          item("git.github.share", "Share Project on GitHub..."),
          item("git.github.syncFork", "Sync Fork"),
          item("git.github.createGist", "Create Gist..."),
          separator,
          item("git.github.open", "Open on GitHub"),
          item("git.github.createPullRequest", "Create Pull Request"),
          item("git.github.pullRequests", "View Pull Requests"),
          separator,
          item("git.github.copyLink", "Copy GitHub Link"),
        ],
      },
      separator,
      item("git.cherryPick", "Cherry-Pick..."),
      item("git.forcePush", "Force Push..."),
    ],
  };
}

function windowMenu(platform: MenuPlatform, mode: MenuMode): TopMenu {
  const mac = platform === "macos";
  const items: MenuEntry[] = [native("Minimize"), native("Maximize", mac ? "Zoom" : "Maximize")];
  if (mode === "app") {
    // Ctrl+Shift+] / [ fold code outside macOS, so tabs switch with Ctrl+PageDown / PageUp there.
    items.push(
      separator,
      item("window.nextTab", "Next Tab", mac ? "Cmd+Shift+]" : "Ctrl+PageDown"),
      item("window.previousTab", "Previous Tab", mac ? "Cmd+Shift+[" : "Ctrl+PageUp"),
      item("window.pinTab", "Pin Tab"),
      separator,
      // Editor groups.
      item("window.splitRight", "Split Right", "CmdOrCtrl+\\"),
      item("window.moveTabToOtherGroup", "Move Tab to Other Group"),
      item("window.focusLeftGroup", "Focus Left Group", "CmdOrCtrl+1"),
      item("window.focusRightGroup", "Focus Right Group", "CmdOrCtrl+2"),
      item("window.closeGroup", "Close Group"),
    );
  } else {
    // git mergetool: Cmd+W closes the window, which asks before dropping the merge result.
    items.push(separator, native("CloseWindow"));
  }
  if (platform === "macos") {
    items.push(separator, native("BringAllToFront", "Bring All to Front"));
  }
  return { text: "Window", role: "window", items };
}

function helpMenu(platform: MenuPlatform, mode: MenuMode): TopMenu {
  const items: MenuEntry[] = [
    item("help.docs", `${APP_NAME} Help`),
    item("help.shortcuts", "Keyboard Shortcuts"),
    item("help.whatsNew", "What's New"),
    item("help.releaseNotes", "Release Notes"),
    ...(mode === "app" ? [separator, item("help.mcpTools", "Available MCP Tools...")] : []),
    separator,
    item("help.reportBug", "Report a Bug..."),
    item("help.requestFeature", "Request a Feature..."),
    item("help.star", "Star on GitHub"),
  ];
  if (platform !== "macos") {
    items.push(separator);
    if (mode === "app") {
      items.push(item("app.checkForUpdates", "Check for Updates..."));
    }
    items.push(item("app.about", `About ${APP_NAME}`));
  }
  return { text: "Help", role: "help", items };
}

/** The menu bar for a platform and window. */
export function menuSpec(platform: MenuPlatform, mode: MenuMode): TopMenu[] {
  const mac = platform === "macos";
  if (mode === "mergeTool") {
    const settingsMenu: TopMenu = {
      text: "File",
      role: null,
      items: [item("app.settings", "Settings...", "CmdOrCtrl+,"), separator, native("Quit", "Exit")],
    };
    return [mac ? appMenu(mode) : settingsMenu, editMenu(platform, mode), windowMenu(platform, mode), helpMenu(platform, mode)];
  }
  return [
    ...(mac ? [appMenu(mode)] : []),
    fileMenu(platform),
    editMenu(platform, mode),
    viewMenu(platform),
    codeMenu(platform),
    gitMenu(platform),
    windowMenu(platform, mode),
    helpMenu(platform, mode),
  ];
}

/** Every action item, submenus included, in menu order. */
export function actionEntries(menus: TopMenu[]): ActionEntry[] {
  const found: ActionEntry[] = [];
  const walk = (entries: MenuEntry[]) => {
    for (const entry of entries) {
      if (entry.kind === "action") {
        found.push(entry);
      } else if (entry.kind === "submenu") {
        walk(entry.items);
      } else if (entry.kind === "recent") {
        found.push(entry.clear);
      }
    }
  };
  for (const menu of menus) {
    walk(menu.items);
  }
  return found;
}

/** The platform of this web view, from its user agent. */
export function platformFromUserAgent(userAgent: string): MenuPlatform {
  if (/Mac OS X|Macintosh/.test(userAgent)) {
    return "macos";
  }
  return /Windows/.test(userAgent) ? "windows" : "linux";
}
