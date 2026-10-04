// Decides which window-wide shortcut a key press means, kept pure so it can be tested
// without a DOM. The keys come from the command registry with the user's custom shortcuts
// applied, so Settings > Keyboard Shortcuts changes them here too.

import { matchesAccelerator } from "$lib/commands/keybinding";
import { type CommandId, type CommandSpec, effectiveShortcut, type ShortcutOverrides } from "$lib/commands/registry";
import type { MenuPlatform } from "$lib/menu/menuIds";

export type WorkspaceShortcut =
  | "goBack"
  | "goForward"
  | "toggleExplorer"
  | "toggleSidebar"
  | "showChanges"
  | "showBranches"
  | "toggleLog"
  | "toggleTerminal"
  | "newTerminal"
  | "quickOpen"
  | "commandPalette"
  | "goToFile"
  | "recentFiles"
  | "goToClass"
  | "goToSymbol"
  | "findInFiles"
  | "replaceInFiles"
  | "nextTab"
  | "previousTab"
  | "toggleWordWrap";

/**
 * The commands the window handles itself, even from a text field or the terminal: Cmd+B
 * toggles the sidebar, Shift+Cmd+G / Shift+Cmd+E pick a panel, Ctrl+` the terminal, Cmd+P
 * opens Quick Open and Shift+Cmd+P the Command Palette (VS Code keys); Cmd+E opens Recent
 * Files, Shift+Cmd+O, Cmd+O, Option+Cmd+O and Shift+Cmd+F open Search Everywhere on Files,
 * Classes, Symbols and Text, and Shift+Cmd+R on Text with Replace (JetBrains keys). Double
 * Shift is handled apart.
 */
export const WINDOW_COMMANDS: Partial<Record<CommandId, WorkspaceShortcut>> = {
  "nav.goBack": "goBack",
  "nav.goForward": "goForward",
  "view.filesPanel": "toggleExplorer",
  "view.sidebar": "toggleSidebar",
  "view.changes": "showChanges",
  "view.branches": "showBranches",
  "view.log": "toggleLog",
  "view.terminal": "toggleTerminal",
  "terminal.new": "newTerminal",
  "edit.goToFile": "quickOpen",
  "view.commandPalette": "commandPalette",
  "search.files": "goToFile",
  "edit.recentFiles": "recentFiles",
  "edit.goToClass": "goToClass",
  "edit.goToSymbol": "goToSymbol",
  "edit.findInFiles": "findInFiles",
  "edit.replaceInFiles": "replaceInFiles",
  "window.nextTab": "nextTab",
  "window.previousTab": "previousTab",
  "view.wordWrap": "toggleWordWrap",
};

/** The parts of a KeyboardEvent the decision needs. */
export interface ShortcutKey {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
}

export interface ShortcutContext {
  dialogOpen: boolean;
  mergeOpen: boolean;
}

/** The commands and keys to match against: the registry, the platform and the custom shortcuts. */
export interface ShortcutKeys {
  specs: readonly CommandSpec[];
  platform: MenuPlatform;
  overrides: ShortcutOverrides;
}

/**
 * Whether the window runs `spec` from a key press. The window commands always do; so does
 * an app command (no menu item would) and any command with a custom key, so the key works
 * the same on every platform and from the terminal. The other menu items keep their keys
 * in the native menu, and the editor runs its own commands.
 */
function handledByWindow(spec: CommandSpec, overrides: ShortcutOverrides): boolean {
  if (spec.scope !== "global") {
    return false;
  }
  return WINDOW_COMMANDS[spec.id] !== undefined || spec.menuAction === null || Object.hasOwn(overrides, spec.id);
}

/**
 * The command a key press runs from the window, or null when the window should leave it
 * alone. A key something else already handled (for example Shift+Cmd+G, find previous, in
 * an editor) is skipped, so one press never runs two actions.
 */
export function windowCommand(event: ShortcutKey, context: ShortcutContext, keys: ShortcutKeys): CommandSpec | null {
  if (context.dialogOpen || context.mergeOpen || event.defaultPrevented) {
    return null;
  }
  for (const spec of keys.specs) {
    if (!handledByWindow(spec, keys.overrides)) {
      continue;
    }
    const shortcut = effectiveShortcut(spec, keys.overrides);
    if (shortcut && matchesAccelerator(event, shortcut, keys.platform)) {
      return spec;
    }
  }
  return null;
}

/** The window shortcut a key press means, for the built-in window commands only. */
export function workspaceShortcut(event: ShortcutKey, context: ShortcutContext, keys: ShortcutKeys): WorkspaceShortcut | null {
  const spec = windowCommand(event, context, keys);
  return spec ? (WINDOW_COMMANDS[spec.id] ?? null) : null;
}
