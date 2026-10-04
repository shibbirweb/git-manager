// Decides who handles a key pressed inside a terminal: the shell (through
// xterm), the terminal view itself (copy, clear, select all) or the app's
// window shortcuts. Kept pure so it can be tested without a DOM.

import { bindingId, type Keybinding, keybindingFromEvent, parseAccelerator } from "$lib/commands/keybinding";
import { type CommandSpec, effectiveShortcut, type ShortcutOverrides } from "$lib/commands/registry";
import type { MenuPlatform } from "$lib/menu/menuIds";

export type TerminalKeyAction =
  /** xterm turns it into input for the shell. */
  | "shell"
  /** Not for the shell: xterm leaves it alone and it bubbles to the window shortcuts. */
  | "app"
  | "copy"
  | "paste"
  | "clear"
  | "selectAll"
  /** Opens the terminal's find bar. */
  | "find"
  /** Splits the terminal, like VS Code (Cmd+Backslash). */
  | "split";

/** The parts of a KeyboardEvent the decision needs. */
export interface TerminalKey {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export interface TerminalKeyContext {
  isMac: boolean;
  hasSelection: boolean;
  /** Find in terminal is on in Settings; off, its key is left to the app. */
  findEnabled?: boolean;
  /** The terminal is in the panel, where it can be split. */
  canSplit?: boolean;
  /** Ids (`bindingId`) of the app's keys that pass the shell by, from `terminalAppKeys`. */
  appKeys?: ReadonlySet<string>;
}

/**
 * Keys the shell needs, never taken for an app shortcut in a terminal: plain keys, Shift,
 * Ctrl or Alt with one key (control characters, readline's Alt+B), and Ctrl+Alt elsewhere
 * than macOS, which is AltGr typing a character. Ctrl+` (the terminal panel) is the one
 * Ctrl key that sends nothing useful, so it may pass.
 */
export function shellOwns(binding: Keybinding, platform: MenuPlatform): boolean {
  if (binding.meta) {
    return false;
  }
  if (binding.ctrl && binding.shift) {
    return binding.alt && platform !== "macos";
  }
  if (binding.ctrl && !binding.alt && binding.code === "Backquote") {
    return false;
  }
  if (binding.ctrl && binding.alt) {
    return platform !== "macos";
  }
  return true;
}

/**
 * The app's global keys, custom ones included, that a terminal hands to the window instead
 * of the shell (Ctrl+Shift+P on Windows and Linux, Ctrl+`). Editor commands are left out:
 * they do nothing in a terminal.
 */
export function terminalAppKeys(specs: readonly CommandSpec[], overrides: ShortcutOverrides, platform: MenuPlatform): Set<string> {
  const keys = new Set<string>();
  for (const spec of specs) {
    const shortcut = spec.scope === "global" ? effectiveShortcut(spec, overrides) : null;
    const binding = shortcut ? parseAccelerator(shortcut, platform) : null;
    if (binding && !shellOwns(binding, platform)) {
      keys.add(bindingId(binding));
    }
  }
  return keys;
}

/** Letters count by the typed key, like the window shortcuts (matchesKeybinding), so other layouts agree. */
function isAppKey(event: TerminalKey, context: TerminalKeyContext): boolean {
  const binding = context.appKeys ? keybindingFromEvent(event) : null;
  if (!binding) {
    return false;
  }
  if (/^[a-z]$/i.test(event.key) && !event.altKey) {
    binding.code = `Key${event.key.toUpperCase()}`;
  }
  return context.appKeys?.has(bindingId(binding)) ?? false;
}

export function terminalKeyAction(event: TerminalKey, context: TerminalKeyContext): TerminalKeyAction {
  // Ctrl+` and Ctrl+Shift+` toggle the panel and add a terminal, even from inside one.
  // Without the app's key list (tests, older callers) the default keys still pass.
  if (!context.appKeys && event.ctrlKey && !event.metaKey && !event.altKey && event.code === "Backquote") {
    return "app";
  }
  const key = event.key.toLowerCase();
  if (context.isMac) {
    // Option+Cmd keys (Option+Cmd+O, Go to Symbol) are app shortcuts too; the shell never sees Cmd.
    if (!event.metaKey || event.ctrlKey) {
      return isAppKey(event, context) ? "app" : "shell";
    }
    if (event.altKey) {
      return "app";
    }
    if (!event.shiftKey && key === "c") {
      // Without a selection Cmd+C does nothing, as in VS Code.
      return context.hasSelection ? "copy" : "app";
    }
    if (!event.shiftKey && key === "k") {
      return "clear";
    }
    if (!event.shiftKey && key === "a") {
      return "selectAll";
    }
    if (!event.shiftKey && key === "f" && context.findEnabled) {
      return "find";
    }
    // By the physical key: layouts type other characters on the backslash key.
    if (!event.shiftKey && event.code === "Backslash" && context.canSplit) {
      return "split";
    }
    // Cmd+V pastes through the native Edit menu, which xterm's paste listener receives.
    // Every other Cmd key (Cmd+B, Cmd+, ...) is an app shortcut.
    return "app";
  }
  // Windows and Linux: Ctrl+Shift+C / V like VS Code; plain Ctrl keys go to the shell.
  if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey) {
    if (key === "c") {
      return context.hasSelection ? "copy" : "app";
    }
    if (key === "v") {
      return "paste";
    }
    if (key === "f" && context.findEnabled) {
      return "find";
    }
    // VS Code's Ctrl+Shift+5, by the physical key (Shift turns 5 into another character).
    if (event.code === "Digit5" && context.canSplit) {
      return "split";
    }
  }
  return isAppKey(event, context) ? "app" : "shell";
}
