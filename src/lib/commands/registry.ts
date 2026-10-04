// The command registry: every native menu item (menuSpec.ts) plus the app actions no menu
// shows, as commands with an id, title, category and default shortcut. menuState.ts gives
// their enabled, checked and renamed state, so the Command Palette and the menu bar always
// agree. Pure; commandRuntime.ts gathers the inputs and runs the commands.
//
// Shortcuts are menu accelerators ("CmdOrCtrl+Shift+P"). `effectiveShortcut` applies a map
// of overrides by command id, so custom keyboard shortcuts can replace or remove a default
// without changing the specs.

import { fuzzyMatch } from "./fuzzy";
import { formatAccelerator, type KeyPress, matchesAccelerator } from "./keybinding";
import { recentRanks } from "./recentCommands";
import { highlight, type TextPart } from "$lib/search/fileSearchModel";
import { isEditorAction, type MenuAction, type MenuPlatform } from "$lib/menu/menuIds";
import type { MenuInputs, MenuState } from "$lib/menu/menuState";
import { actionEntries, APP_NAME, type MenuEntry, type TopMenu } from "$lib/menu/menuSpec";

/** App actions that are not menu items (their keys are handled in workspaceShortcuts.ts). */
export const APP_COMMAND_IDS = [
  "nav.goBack",
  "nav.goForward",
  "terminal.new",
  "search.files",
  "commands.clearRecent",
  "settings.keyboardShortcuts",
] as const;

export type AppCommandId = (typeof APP_COMMAND_IDS)[number];

export type CommandId = MenuAction | AppCommandId;

export interface CommandSpec {
  id: CommandId;
  /** As the menu shows it, without the trailing "...". */
  title: string;
  /** The menu it lives in, with its submenus: "Git > Current File". */
  category: string;
  /** Default key as a menu accelerator; null when it has none. */
  defaultShortcut: string | null;
  /** The menu item this command is, or null for an app command. */
  menuAction: MenuAction | null;
  /** "editor": runs in the focused text editor (Find, the Code menu); "global" otherwise. */
  scope: "editor" | "global";
  /** A check item in the menu (Sidebar, Word Wrap...). */
  checkable: boolean;
  /** Needs an open folder (app commands; menu items say so through menuState.ts). */
  needsWorkspace: boolean;
  /** Listed in the Command Palette. */
  inPalette: boolean;
}

/** Custom shortcuts by command id: an accelerator, or null to remove the default. */
export type ShortcutOverrides = Partial<Record<string, string | null>>;

/** The palette's own commands: listing them there would only reopen it. */
const NOT_IN_PALETTE = new Set<CommandId>(["view.commandPalette"]);

export const APP_COMMANDS: readonly CommandSpec[] = [
  appCommand("nav.goBack", "Go Back", "Go", "Ctrl+-"),
  appCommand("nav.goForward", "Go Forward", "Go", "Ctrl+Shift+-"),
  appCommand("terminal.new", "New Terminal", "Terminal", "Ctrl+Shift+`"),
  appCommand("search.files", "Search Everywhere: Files", "Edit", "CmdOrCtrl+Shift+O"),
  { ...appCommand("commands.clearRecent", "Clear Recently Used", "Command Palette", null), needsWorkspace: false },
  { ...appCommand("settings.keyboardShortcuts", "Open Keyboard Shortcuts", "Preferences", null), needsWorkspace: false },
];

/**
 * Keys a menu item answers to from the window although the menu does not show them:
 * Shift+Cmd+G is Find Previous in the Edit menu, and outside an editor it shows Changes.
 */
const WINDOW_DEFAULTS: Partial<Record<MenuAction, string>> = {
  "view.changes": "CmdOrCtrl+Shift+G",
};

function appCommand(id: AppCommandId, title: string, category: string, defaultShortcut: string | null): CommandSpec {
  return {
    id,
    title,
    category,
    defaultShortcut,
    menuAction: null,
    scope: "global",
    checkable: false,
    needsWorkspace: true,
    inPalette: true,
  };
}

/** "Commit..." becomes "Commit". */
export function commandTitle(menuText: string): string {
  return menuText.replace(/\.\.\.$|…$/, "").trim();
}

/** The app menu (macOS) is named after the app; its commands read better as "App". */
function categoryOf(menuText: string): string {
  return menuText === APP_NAME ? "App" : menuText;
}

/**
 * Every action item of `menus` as a command, in menu order, then `extras`. An item listed
 * twice (Settings in the app and File menus) keeps its first place.
 */
export function buildCommandSpecs(menus: readonly TopMenu[], extras: readonly CommandSpec[] = APP_COMMANDS): CommandSpec[] {
  const specs: CommandSpec[] = [];
  const seen = new Set<CommandId>();
  const add = (action: MenuAction, text: string, accelerator: string | null, check: boolean, category: string) => {
    if (seen.has(action)) {
      return;
    }
    seen.add(action);
    specs.push({
      id: action,
      title: commandTitle(text),
      category,
      defaultShortcut: accelerator ?? WINDOW_DEFAULTS[action] ?? null,
      menuAction: action,
      scope: isEditorAction(action) ? "editor" : "global",
      checkable: check,
      needsWorkspace: false,
      inPalette: !NOT_IN_PALETTE.has(action),
    });
  };
  const walk = (entries: readonly MenuEntry[], category: string) => {
    for (const entry of entries) {
      if (entry.kind === "action") {
        add(entry.action, entry.text, entry.accelerator, entry.check, category);
      } else if (entry.kind === "submenu") {
        walk(entry.items, `${category} > ${entry.text}`);
      } else if (entry.kind === "recent") {
        add(entry.clear.action, entry.clear.text, entry.clear.accelerator, entry.clear.check, `${category} > ${entry.text}`);
      }
    }
  };
  for (const menu of menus) {
    walk(menu.items, categoryOf(menu.text));
  }
  for (const extra of extras) {
    if (!seen.has(extra.id)) {
      seen.add(extra.id);
      specs.push(extra);
    }
  }
  return specs;
}

/** The key a command answers to: the override when there is one, else its default. */
export function effectiveShortcut(spec: CommandSpec, overrides: ShortcutOverrides = {}): string | null {
  if (Object.hasOwn(overrides, spec.id)) {
    return overrides[spec.id] ?? null;
  }
  return spec.defaultShortcut;
}

/**
 * The accelerator each native menu item shows: its custom key when it has one (null: none),
 * else the menu's own. A key the menu leaves off on purpose (view.changes) stays off.
 */
export function menuAccelerators(menus: readonly TopMenu[], overrides: ShortcutOverrides = {}): Map<MenuAction, string | null> {
  const accelerators = new Map<MenuAction, string | null>();
  for (const entry of actionEntries([...menus])) {
    if (!accelerators.has(entry.action)) {
      accelerators.set(entry.action, Object.hasOwn(overrides, entry.action) ? (overrides[entry.action] ?? null) : entry.accelerator);
    }
  }
  return accelerators;
}

/** The command whose shortcut a key press is, if any (first in menu order). */
export function commandForKey(
  specs: readonly CommandSpec[],
  event: KeyPress,
  platform: MenuPlatform,
  overrides: ShortcutOverrides = {},
): CommandSpec | null {
  for (const spec of specs) {
    const shortcut = effectiveShortcut(spec, overrides);
    if (shortcut && matchesAccelerator(event, shortcut, platform)) {
      return spec;
    }
  }
  return null;
}

export interface CommandView {
  spec: CommandSpec;
  /** The title now: menuState.ts renames some items ("Push (2 ahead)", "Close Workspace"). */
  title: string;
  shortcut: string | null;
  enabled: boolean;
  /** Check items only. */
  checked: boolean | null;
  /** Why it cannot run now; null when enabled. */
  reason: string | null;
}

/** Each command with its state; items the menu hides now (an operation's Continue, GitHub) are left out. */
export function commandViews(
  specs: readonly CommandSpec[],
  state: MenuState,
  inputs: MenuInputs,
  overrides: ShortcutOverrides = {},
): CommandView[] {
  const views: CommandView[] = [];
  for (const spec of specs) {
    const itemState = spec.menuAction ? state[spec.menuAction] : undefined;
    if (itemState?.visible === false) {
      continue;
    }
    const enabled = spec.needsWorkspace ? inputs.workspace !== null : (itemState?.enabled ?? true);
    views.push({
      spec,
      title: itemState?.text ? commandTitle(itemState.text) : spec.title,
      shortcut: effectiveShortcut(spec, overrides),
      enabled,
      checked: spec.checkable ? (itemState?.checked ?? false) : null,
      reason: enabled ? null : disabledReason(spec, inputs),
    });
  }
  return views;
}

/** A short reason a command is disabled, from the same inputs the menu state uses. */
export function disabledReason(spec: CommandSpec, inputs: MenuInputs): string {
  const commandId = spec.id;
  if (spec.scope === "editor") {
    if (!inputs.editor.focused) {
      return "Needs a text editor";
    }
    if (!inputs.editor.inText) {
      return "Needs the cursor in the editor";
    }
    return "The editor is read-only";
  }
  if (inputs.workspace === null && commandId !== "file.clearRecent") {
    return "Open a folder first";
  }
  if (commandId === "file.clearRecent") {
    return "Nothing recent";
  }
  if (commandId === "file.save" || commandId === "file.revert") {
    if (inputs.activeFile === null) {
      return "Needs a file in the editor";
    }
    return inputs.activeFile.editable ? "No unsaved changes" : "The file is read-only";
  }
  if (commandId === "file.compareWithClipboard" || commandId === "file.compareWith") {
    return "Needs a file in the editor";
  }
  if (commandId === "file.saveAll") {
    return "No unsaved changes";
  }
  if (commandId === "file.closeTab" || commandId === "window.pinTab") {
    return "No tab is shown";
  }
  if (commandId === "file.reopenClosedTab") {
    return "No closed tabs";
  }
  if (commandId.startsWith("view.markdown")) {
    return "Needs a Markdown file";
  }
  if (commandId === "window.nextTab" || commandId === "window.previousTab") {
    return "No open tabs";
  }
  if (GROUP_COMMANDS.has(commandId)) {
    return groupReason(commandId, inputs);
  }
  if (commandId === "git.github.createGist" || commandId === "file.localHistory") {
    return "Needs a file in the editor";
  }
  if (commandId.startsWith("git.")) {
    if (inputs.repo === null) {
      return "Needs a Git repository";
    }
    if (inputs.repo.busy) {
      return "Git is busy";
    }
    if (commandId.startsWith("git.file.") && inputs.gitFile === null) {
      return "Needs a file from the repository";
    }
    if (commandId.startsWith("git.lines.")) {
      const lines = inputs.shownView === "diff" ? (inputs.diffLines ?? null) : null;
      if (lines === null) {
        return "Needs a diff from Changes";
      }
      return lines === "staged" ? "Needs an unstaged diff" : "Needs a staged diff";
    }
    if (commandId.startsWith("git.github.") && !inputs.repo.github) {
      return "Needs a GitHub remote";
    }
    if (commandId.startsWith("git.bisect.") && commandId !== "git.bisect.start" && !inputs.repo.bisecting) {
      return "No bisect is running";
    }
    if ((commandId === "git.bisect.start" || commandId === "git.undoLast") && inputs.repo.bisecting) {
      return "End the bisect first";
    }
    if (inputs.repo.op !== "none" && commandId !== "git.continueOp" && commandId !== "git.abortOp") {
      return "Finish the current operation first";
    }
    return "Not available in this repository now";
  }
  return "Not available now";
}

/** The editor group commands of the Window menu. */
const GROUP_COMMANDS = new Set<CommandId>([
  "window.splitRight",
  "window.moveTabToOtherGroup",
  "window.focusLeftGroup",
  "window.focusRightGroup",
  "window.closeGroup",
]);

function groupReason(commandId: CommandId, inputs: MenuInputs): string {
  const groups = inputs.editorGroups;
  if (!groups?.enabled) {
    return "Split editor is off in Settings";
  }
  if (commandId === "window.closeGroup" || commandId === "window.focusLeftGroup") {
    return groups.count > 1 ? "Already in the left group" : "The editor is not split";
  }
  if (commandId !== "window.moveTabToOtherGroup" && groups.count > 1 && groups.focusedIndex === 1) {
    return "Already in the right group";
  }
  return "No tab is shown";
}

export interface PaletteItem {
  key: string;
  commandId: CommandId;
  categoryParts: TextPart[];
  titleParts: TextPart[];
  /** Written for the platform ("⇧⌘P"); null without a shortcut. */
  shortcut: string | null;
  enabled: boolean;
  checked: boolean | null;
  reason: string | null;
}

export interface PaletteList {
  /** Recently used, most recent first (only without a query). */
  recent: PaletteItem[];
  /** The rest; with a query, every match by score. */
  other: PaletteItem[];
}

/** The text a query matches: "Git > Current File: Show History". */
export function commandLabel(category: string, title: string): string {
  return `${category}: ${title}`;
}

function toItem(view: CommandView, indices: number[], platform: MenuPlatform): PaletteItem {
  const category = view.spec.category;
  return {
    key: view.spec.id,
    commandId: view.spec.id,
    categoryParts: highlight(category, indices, 0),
    titleParts: highlight(view.title, indices, Array.from(category).length + 2),
    shortcut: view.shortcut ? formatAccelerator(view.shortcut, platform) : null,
    enabled: view.enabled,
    checked: view.checked,
    reason: view.reason,
  };
}

/** A small lift for recently used commands, most for the latest, so they win close calls. */
const RECENT_BONUS = 8;

/**
 * The palette's rows for `query`. Without one: recently used commands first, then the
 * others alphabetically, disabled ones last. With one: every match, enabled first, best
 * score first, recently used ones lifted a little.
 */
export function paletteList(views: readonly CommandView[], query: string, recent: readonly string[], platform: MenuPlatform): PaletteList {
  const listed = views.filter((view) => view.spec.inPalette);
  const ranks = recentRanks(recent);
  const label = (view: CommandView) => commandLabel(view.spec.category, view.title);
  if (query.trim() === "") {
    const recentViews = listed
      .filter((view) => ranks.has(view.spec.id))
      .sort((a, b) => (ranks.get(a.spec.id) ?? 0) - (ranks.get(b.spec.id) ?? 0));
    const other = listed
      .filter((view) => !ranks.has(view.spec.id))
      .sort((a, b) => Number(b.enabled) - Number(a.enabled) || label(a).localeCompare(label(b)));
    return {
      recent: recentViews.map((view) => toItem(view, [], platform)),
      other: other.map((view) => toItem(view, [], platform)),
    };
  }
  const matches: { view: CommandView; score: number; indices: number[] }[] = [];
  for (const view of listed) {
    const match = fuzzyMatch(query, label(view));
    if (!match) {
      continue;
    }
    const rank = ranks.get(view.spec.id);
    const bonus = rank === undefined ? 0 : RECENT_BONUS * (1 - rank / Math.max(1, recent.length));
    matches.push({ view, score: match.score + bonus, indices: match.indices });
  }
  matches.sort(
    (a, b) => Number(b.view.enabled) - Number(a.view.enabled) || b.score - a.score || label(a.view).localeCompare(label(b.view)),
  );
  return { recent: [], other: matches.map((match) => toItem(match.view, match.indices, platform)) };
}
