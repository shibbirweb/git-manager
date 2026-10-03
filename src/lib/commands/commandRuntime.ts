// The registry (registry.ts) put to work: the command list for this platform, its state
// from the same inputs as the menu bar, the custom shortcuts from Settings, and running a
// command the way its menu item or window shortcut does.

import type { EditorView } from "@codemirror/view";
import { currentMenuInputs } from "$lib/menu/appMenu.svelte";
import { runMenuAction } from "$lib/menu/menuActions";
import type { MenuPlatform } from "$lib/menu/menuIds";
import { type MenuInputs, menuState } from "$lib/menu/menuState";
import { menuSpec, platformFromUserAgent } from "$lib/menu/menuSpec";
import { settings } from "$lib/stores/settings.svelte";
import { openFileSearch, runWorkspaceShortcut, shortcutsBlocked } from "$lib/views/workspaceActions";
import { repoStore } from "$lib/stores/repo.svelte";
import { terminalAppKeys } from "$lib/terminal/keys";
import type { ShortcutKeys } from "$lib/views/workspaceShortcuts";
import {
  buildCommandSpecs,
  type CommandId,
  type CommandSpec,
  type CommandView,
  commandViews,
  effectiveShortcut,
  type ShortcutOverrides,
} from "./registry";
import { usableOverrides } from "./shortcutSettings";

let cached: { platform: MenuPlatform; specs: CommandSpec[] } | null = null;

export function currentPlatform(): MenuPlatform {
  return typeof navigator === "undefined" ? "macos" : platformFromUserAgent(navigator.userAgent);
}

/** Every command of the main window; the menu is fixed per platform, so it is built once. */
export function commandSpecs(platform: MenuPlatform = currentPlatform()): CommandSpec[] {
  if (cached?.platform !== platform) {
    cached = { platform, specs: buildCommandSpecs(menuSpec(platform, "app")) };
  }
  return cached.specs;
}

let usable: { source: ShortcutOverrides; platform: MenuPlatform; overrides: ShortcutOverrides } | null = null;

/**
 * Custom shortcuts by command id, from Settings > Keyboard Shortcuts (a reactive read).
 * Keys this platform keeps for itself are left out; worked out again only when they change.
 */
export function shortcutOverrides(platform: MenuPlatform = currentPlatform()): ShortcutOverrides {
  const source = settings.keybindings;
  if (usable?.source !== source || usable.platform !== platform) {
    usable = { source, platform, overrides: usableOverrides(source, platform) };
  }
  return usable.overrides;
}

/** What the window shortcuts match against now. */
export function windowKeys(): ShortcutKeys {
  const platform = currentPlatform();
  return { specs: commandSpecs(platform), platform, overrides: shortcutOverrides(platform) };
}

/** The command keeps its default keys: places that bind them locally (Cmd+S in an editor) still may. */
export function usesDefaultKeys(commandId: CommandId): boolean {
  return !Object.hasOwn(shortcutOverrides(), commandId);
}

/** The keys a command answers to now, custom ones included; null without a key. */
export function shortcutFor(commandId: CommandId): string | null {
  const keys = windowKeys();
  const spec = keys.specs.find((candidate) => candidate.id === commandId) ?? null;
  return spec ? effectiveShortcut(spec, keys.overrides) : null;
}

let terminalKeys: { overrides: ShortcutOverrides; keys: Set<string> } | null = null;

/** The app keys a terminal leaves to the window (terminal/keys.ts), kept until the shortcuts change. */
export function terminalAppKeySet(): Set<string> {
  const keys = windowKeys();
  if (terminalKeys?.overrides !== keys.overrides) {
    terminalKeys = { overrides: keys.overrides, keys: terminalAppKeys(keys.specs, keys.overrides, keys.platform) };
  }
  return terminalKeys.keys;
}

/** The commands with their state now; `inputs` may replace the editor part read at open. */
export function currentCommandViews(inputs: MenuInputs = currentMenuInputs("app")): CommandView[] {
  return commandViews(commandSpecs(), menuState(inputs), inputs, shortcutOverrides());
}

/**
 * Runs a command. Editor commands act on `editorView` (focused first) or the focused
 * editor; menu items keep their own guards (menuActions.ts), app commands the window's.
 */
export function runCommand(commandId: CommandId, editorView: EditorView | null = null): void {
  const spec = commandSpecs().find((candidate) => candidate.id === commandId) ?? null;
  if (!spec) {
    return;
  }
  // Its find bar counts as inside: Find Next from there keeps the focus where it is.
  if (spec.scope === "editor" && editorView?.dom.isConnected && !editorView.dom.contains(document.activeElement)) {
    editorView.focus();
  }
  if (spec.menuAction) {
    runMenuAction(spec.menuAction);
    return;
  }
  if (spec.id === "commands.clearRecent") {
    settings.clearRecentCommands();
    return;
  }
  if (spec.id === "settings.keyboardShortcuts") {
    settings.openDialog("keyboard");
    return;
  }
  if (repoStore.workspace === null || shortcutsBlocked()) {
    return;
  }
  switch (spec.id) {
    case "nav.goBack":
      runWorkspaceShortcut("goBack");
      break;
    case "nav.goForward":
      runWorkspaceShortcut("goForward");
      break;
    case "terminal.new":
      runWorkspaceShortcut("newTerminal");
      break;
    case "search.files":
      openFileSearch("files");
      break;
  }
}
