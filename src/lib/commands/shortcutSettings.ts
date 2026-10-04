// Custom keyboard shortcuts as data: reading them from settings.json, checking a recorded
// key (reserved, needs a modifier, unknown key), changing one command's key, finding the
// commands that share keys, and the rows of Settings > Keyboard Shortcuts. Pure, so every
// rule is tested; the stores and the native menu only apply what comes out.

import { MENU_ACTIONS, type MenuPlatform } from "$lib/menu/menuIds";
import {
  acceleratorId,
  bindingId,
  formatAccelerator,
  type KeyPress,
  type Keybinding,
  keybindingFromEvent,
  parseAccelerator,
  toAccelerator,
} from "./keybinding";
import { APP_COMMAND_IDS, type CommandId, type CommandSpec, effectiveShortcut, type ShortcutOverrides } from "./registry";

const KNOWN_COMMANDS = new Set<string>([...MENU_ACTIONS, ...APP_COMMAND_IDS]);

/** Far more than the app has commands; a hand-edited file cannot grow the map without limit. */
const MAX_OVERRIDES = 500;

/**
 * settings.json's `keybindings`: command id to accelerator, or null for no key. Unknown
 * commands and accelerators that do not parse are dropped, so a hand edit never breaks a key.
 */
export function pickKeybindings(value: unknown): ShortcutOverrides {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const picked: ShortcutOverrides = {};
  let count = 0;
  for (const [commandId, accelerator] of Object.entries(value as Record<string, unknown>)) {
    if (count >= MAX_OVERRIDES || !KNOWN_COMMANDS.has(commandId)) {
      continue;
    }
    if (accelerator === null) {
      picked[commandId] = null;
      count++;
    } else if (typeof accelerator === "string" && parseAccelerator(accelerator, "macos") !== null) {
      picked[commandId] = accelerator.trim();
      count++;
    }
  }
  return picked;
}

/** Keys the system owns on each platform: they never reach the app, or quit, hide or copy. */
const RESERVED: Record<MenuPlatform, { accelerator: string; reason: string }[]> = {
  macos: [
    { accelerator: "Cmd+Q", reason: "macOS uses it to quit" },
    { accelerator: "Cmd+H", reason: "macOS uses it to hide the app" },
    { accelerator: "Cmd+Alt+H", reason: "macOS uses it to hide other apps" },
    { accelerator: "Cmd+M", reason: "macOS uses it to minimize" },
    { accelerator: "Cmd+Tab", reason: "macOS uses it to switch apps" },
    { accelerator: "Cmd+Shift+Tab", reason: "macOS uses it to switch apps" },
    { accelerator: "Cmd+`", reason: "macOS uses it to switch windows" },
    { accelerator: "Cmd+Space", reason: "macOS uses it for Spotlight" },
    { accelerator: "Ctrl+Cmd+F", reason: "macOS uses it for full screen" },
    { accelerator: "Ctrl+Cmd+Q", reason: "macOS uses it to lock the screen" },
    { accelerator: "Cmd+Shift+3", reason: "macOS uses it for screenshots" },
    { accelerator: "Cmd+Shift+4", reason: "macOS uses it for screenshots" },
    { accelerator: "Cmd+Shift+5", reason: "macOS uses it for screenshots" },
    { accelerator: "Cmd+X", reason: "Cut uses it" },
    { accelerator: "Cmd+C", reason: "Copy uses it" },
    { accelerator: "Cmd+V", reason: "Paste uses it" },
  ],
  windows: [
    { accelerator: "Alt+F4", reason: "Windows uses it to close the window" },
    { accelerator: "Alt+Tab", reason: "Windows uses it to switch apps" },
    { accelerator: "Ctrl+Alt+Delete", reason: "Windows uses it" },
    { accelerator: "Super+L", reason: "Windows uses it to lock the screen" },
    { accelerator: "Ctrl+X", reason: "Cut uses it" },
    { accelerator: "Ctrl+C", reason: "Copy uses it" },
    { accelerator: "Ctrl+V", reason: "Paste uses it" },
  ],
  linux: [
    { accelerator: "Alt+F4", reason: "The desktop uses it to close the window" },
    { accelerator: "Alt+Tab", reason: "The desktop uses it to switch apps" },
    { accelerator: "Ctrl+Alt+Delete", reason: "The desktop uses it" },
    { accelerator: "Ctrl+X", reason: "Cut uses it" },
    { accelerator: "Ctrl+C", reason: "Copy uses it" },
    { accelerator: "Ctrl+V", reason: "Paste uses it" },
  ],
};

/** Why the system keeps these keys, or null when the app may use them. */
export function reservedReason(binding: Keybinding, platform: MenuPlatform): string | null {
  const wanted = bindingId(binding);
  return RESERVED[platform].find((entry) => acceleratorId(entry.accelerator, platform) === wanted)?.reason ?? null;
}

/** Keys that type or move the caret: they need Cmd, Ctrl or Alt to be a shortcut. */
function needsModifier(binding: Keybinding): boolean {
  if (binding.ctrl || binding.alt || binding.meta) {
    return false;
  }
  return !/^F([1-9]|1[0-9]|2[0-4])$/.test(binding.code);
}

/** Why a recorded key cannot be a shortcut, or null when it can. */
export function shortcutProblem(binding: Keybinding, platform: MenuPlatform): string | null {
  const reserved = reservedReason(binding, platform);
  if (reserved) {
    return `Reserved: ${reserved}`;
  }
  if (needsModifier(binding)) {
    return platform === "macos" ? "Add Cmd, Ctrl or Option to this key" : "Add Ctrl or Alt to this key";
  }
  // Keys the accelerator notation cannot write (numpad, media keys) would not survive a save.
  if (parseAccelerator(toAccelerator(binding, platform), platform) === null) {
    return "This key cannot be used for a shortcut";
  }
  return null;
}

export interface RecordedKeys {
  binding: Keybinding;
  /** As saved in settings.json ("CmdOrCtrl+Shift+K"). */
  accelerator: string;
  /** Written for the platform ("⇧⌘K"). */
  text: string;
  /** Why it cannot be used; null when it can. */
  problem: string | null;
}

/** A key press while recording; null for a lone modifier (the user is still pressing keys). */
export function recordKeys(event: KeyPress, platform: MenuPlatform): RecordedKeys | null {
  const binding = keybindingFromEvent(event);
  if (!binding) {
    return null;
  }
  const accelerator = toAccelerator(binding, platform);
  return { binding, accelerator, text: formatAccelerator(accelerator, platform), problem: shortcutProblem(binding, platform) };
}

/**
 * The overrides that work on `platform`, written the way the native menu reads them
 * ("Mod-Shift-d" becomes "CmdOrCtrl+Shift+D"). A hand-edited reserved or bare key is left out.
 */
export function usableOverrides(overrides: ShortcutOverrides, platform: MenuPlatform): ShortcutOverrides {
  const usable: ShortcutOverrides = {};
  for (const [commandId, accelerator] of Object.entries(overrides)) {
    if (accelerator === null || accelerator === undefined) {
      usable[commandId] = null;
      continue;
    }
    const binding = parseAccelerator(accelerator, platform);
    if (binding && reservedReason(binding, platform) === null && !needsModifier(binding)) {
      usable[commandId] = toAccelerator(binding, platform);
    }
  }
  return usable;
}

function sameKeys(first: string | null, second: string | null, platform: MenuPlatform): boolean {
  if (first === null || second === null) {
    return first === second;
  }
  const firstId = acceleratorId(first, platform);
  return firstId !== null && firstId === acceleratorId(second, platform);
}

/**
 * Gives `spec` the keys `accelerator` (null: no key). Choosing the default again drops the
 * override, so the command follows the default if a later version changes it.
 */
export function withShortcut(
  overrides: ShortcutOverrides,
  spec: CommandSpec,
  accelerator: string | null,
  platform: MenuPlatform,
): ShortcutOverrides {
  const { [spec.id]: _previous, ...rest } = overrides;
  if (sameKeys(accelerator, spec.defaultShortcut, platform)) {
    return rest;
  }
  return { ...rest, [spec.id]: accelerator };
}

/** Back to the default key. */
export function withoutOverride(overrides: ShortcutOverrides, commandId: CommandId): ShortcutOverrides {
  const { [commandId]: _previous, ...rest } = overrides;
  return rest;
}

/** The user changed this command's key (or removed it). */
export function isChanged(spec: CommandSpec, overrides: ShortcutOverrides): boolean {
  return Object.hasOwn(overrides, spec.id);
}

/**
 * The other commands that answer to `accelerator`. Every command is reachable from the
 * window, and an editor key wins inside an editor, so any two commands with the same keys
 * get in each other's way.
 */
export function commandsWithKeys(
  specs: readonly CommandSpec[],
  overrides: ShortcutOverrides,
  platform: MenuPlatform,
  accelerator: string,
  exceptId: CommandId | null = null,
): CommandSpec[] {
  const wanted = acceleratorId(accelerator, platform);
  if (wanted === null) {
    return [];
  }
  return specs.filter((spec) => {
    if (spec.id === exceptId) {
      return false;
    }
    const shortcut = effectiveShortcut(spec, overrides);
    return shortcut !== null && acceleratorId(shortcut, platform) === wanted;
  });
}

/**
 * Commands sharing keys with another, by command id. Pairs where both keep their default
 * are left out: the app ships a few on purpose (Shift+Cmd+G finds the previous match in an
 * editor and shows Changes elsewhere).
 */
export function shortcutConflicts(
  specs: readonly CommandSpec[],
  overrides: ShortcutOverrides,
  platform: MenuPlatform,
): Map<CommandId, CommandSpec[]> {
  const byKeys = new Map<string, CommandSpec[]>();
  for (const spec of specs) {
    const shortcut = effectiveShortcut(spec, overrides);
    const keysId = shortcut === null ? null : acceleratorId(shortcut, platform);
    if (keysId !== null) {
      byKeys.set(keysId, [...(byKeys.get(keysId) ?? []), spec]);
    }
  }
  const conflicts = new Map<CommandId, CommandSpec[]>();
  for (const group of byKeys.values()) {
    for (const spec of group) {
      const others = group.filter((other) => other.id !== spec.id && (isChanged(spec, overrides) || isChanged(other, overrides)));
      if (others.length > 0) {
        conflicts.set(spec.id, others);
      }
    }
  }
  return conflicts;
}

/** Gives `spec` the keys and removes them from `replaced` (the Replace choice of a conflict). */
export function replaceShortcut(
  overrides: ShortcutOverrides,
  spec: CommandSpec,
  accelerator: string,
  replaced: readonly CommandSpec[],
  platform: MenuPlatform,
): ShortcutOverrides {
  let next = withShortcut(overrides, spec, accelerator, platform);
  for (const other of replaced) {
    next = withShortcut(next, other, null, platform);
  }
  return next;
}

export interface ShortcutRow {
  spec: CommandSpec;
  /** "Git > Current File: Show History", as the Command Palette writes it. */
  label: string;
  /** The keys now, as an accelerator; null without one. */
  shortcut: string | null;
  /** Written for the platform ("⇧⌘P"). */
  keysText: string | null;
  /** The default keys written for the platform, for the "changed" hint. */
  defaultText: string | null;
  changed: boolean;
  /** Titles of the other commands with the same keys. */
  conflicts: string[];
}

export interface ShortcutFilter {
  /** Words matched against the label, the command id and the keys as written. */
  query: string;
  /** Recorded keys to look for (Record Keys); null to filter by `query`. */
  keys: Keybinding | null;
  /** Only commands the user changed. */
  changedOnly: boolean;
}

/** The rows of Settings > Keyboard Shortcuts, in menu order, filtered. */
export function shortcutRows(
  specs: readonly CommandSpec[],
  overrides: ShortcutOverrides,
  platform: MenuPlatform,
  filter: ShortcutFilter,
): ShortcutRow[] {
  const conflicts = shortcutConflicts(specs, overrides, platform);
  const keysId = filter.keys ? bindingId(filter.keys) : null;
  const query = filter.query.trim();
  const rows: ShortcutRow[] = [];
  for (const spec of specs) {
    const shortcut = effectiveShortcut(spec, overrides);
    const changed = isChanged(spec, overrides);
    if (filter.changedOnly && !changed) {
      continue;
    }
    if (keysId !== null && (shortcut === null || acceleratorId(shortcut, platform) !== keysId)) {
      continue;
    }
    const label = `${spec.category}: ${spec.title}`;
    const keysText = shortcut ? formatAccelerator(shortcut, platform) : null;
    if (keysId === null && query !== "" && !matchesQuery(query, label, spec.id, keysText)) {
      continue;
    }
    rows.push({
      spec,
      label,
      shortcut,
      keysText,
      defaultText: spec.defaultShortcut ? formatAccelerator(spec.defaultShortcut, platform) : null,
      changed,
      conflicts: (conflicts.get(spec.id) ?? []).map((other) => `${other.category}: ${other.title}`),
    });
  }
  return rows;
}

/** Every word of the query is in the label, the command id or the keys as written ("git push", "⇧⌘P"). */
function matchesQuery(query: string, label: string, commandId: string, keysText: string | null): boolean {
  const text = `${label} ${commandId} ${keysText ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}
