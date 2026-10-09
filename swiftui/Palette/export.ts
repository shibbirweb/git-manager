// The Command Palette's commands for the native app (gm-measure commands writes Generated/PaletteCommands*.swift
// from this). Runs the current app's own registry (src/lib/commands/registry.ts) with the menu state of the window
// the measurements use: the docs demo's acme/storefront open on the Changes screen, nothing in the editor, the app's
// default settings. Prints JSON: every command the palette lists, in its order without a query, with the state
// for the light and the dark theme setting (only the theme items differ).
//
//   bun --tsconfig-override swiftui/Palette/tsconfig.json swiftui/Palette/export.ts

import { buildCommandSpecs, commandLabel, commandViews } from "$lib/commands/registry";
import { formatAccelerator } from "$lib/commands/keybinding";
import { type MenuInputs, menuState } from "$lib/menu/menuState";
import { menuSpec } from "$lib/menu/menuSpec";
import { defaultPreferences } from "$lib/stores/settingsData";

function inputs(theme: "light" | "dark"): MenuInputs {
  const preferences = defaultPreferences as unknown as Record<string, unknown>;
  return {
    mode: "app",
    workspace: { folderCount: 1 },
    // acme/storefront: main, one commit ahead of its local origin, four changed files.
    repo: {
      busy: false,
      ahead: 1,
      behind: 0,
      branch: "main",
      unborn: false,
      op: "none",
      conflicts: 0,
      changes: 4,
      remotes: 1,
      github: false,
      bisecting: false,
      remoteLinks: 0,
    },
    gitFile: null,
    blameGutter: Boolean(preferences.blameGutter),
    shownView: "none",
    activeFile: null,
    dirtyCount: 0,
    tabCount: 0,
    closedTabCount: 0,
    activeTabPinned: false,
    logShown: false,
    editorGroups: { enabled: Boolean(preferences.splitEditor), count: 1, focusedIndex: 0, canSplit: false },
    leftPanel: "changes",
    explorerOpen: true,
    leftBarVisible: true,
    rightBarVisible: true,
    terminalOpen: false,
    gitConsoleOpen: false,
    gitConsoleEnabled: Boolean(preferences.gitConsole),
    theme,
    wordWrap: Boolean(preferences.wordWrap),
    stickyScroll: Boolean(preferences.editorStickyScroll),
    minimap: Boolean(preferences.editorMinimap),
    fileIcons: preferences.fileIcons as MenuInputs["fileIcons"],
    detectIndentation: Boolean(preferences.detectIndentation),
    doNotDisturb: Boolean(preferences.notificationsDoNotDisturb),
    diffLines: null,
    // The palette reads the editor as it was when it opened: none.
    editor: { focused: false, inText: false, writable: false },
    // Opening the folder put it in the recent list.
    hasRecent: true,
  } as MenuInputs;
}

const specs = buildCommandSpecs(menuSpec("macos", "app"));
const viewsFor = (theme: "light" | "dark") => {
  const state = inputs(theme);
  return commandViews(specs, menuState(state), state).filter((view) => view.spec.inPalette);
};
const light = viewsFor("light");
const dark = new Map(viewsFor("dark").map((view) => [view.spec.id, view]));
const label = (view: (typeof light)[number]) => commandLabel(view.spec.category, view.title);
const alphabetical = [...light].sort((a, b) => label(a).localeCompare(label(b)));
const order = new Map(alphabetical.map((view, index) => [view.spec.id, index]));
const listed = [...light].sort((a, b) => Number(b.enabled) - Number(a.enabled) || label(a).localeCompare(label(b)));

console.log(
  JSON.stringify(
    listed.map((view) => {
      const other = dark.get(view.spec.id);
      return {
        id: view.spec.id,
        title: view.title,
        category: view.spec.category,
        shortcut: view.shortcut ? formatAccelerator(view.shortcut, "macos") : null,
        enabled: view.enabled,
        reason: view.reason,
        checkedLight: view.checked,
        checkedDark: other?.checked ?? view.checked,
        sameInDark: other !== undefined && other.enabled === view.enabled && other.title === view.title,
        order: order.get(view.spec.id) ?? 0,
      };
    }),
  ),
);
