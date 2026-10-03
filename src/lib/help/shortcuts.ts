// Help > Keyboard Shortcuts: every shortcut of the app. Menu items come straight from the
// menu bar's own definition (menuSpec.ts), so the list can never drift from the real keys;
// the ones no menu shows (double Shift, the merge tool's F7, Option+Shift+click...) are added.
// Custom keys from Settings > Keyboard Shortcuts replace the defaults they change.

import type { MenuPlatform } from "$lib/menu/menuIds";
import { menuSpec, type MenuEntry } from "$lib/menu/menuSpec";

export interface ShortcutRow {
  /** What it does. */
  label: string;
  /** Each way to press it, already written for the platform ("⇧⌘E", "Ctrl+Shift+E"). */
  keys: string[];
  /** Where it works, when not everywhere: "In the editor", "In the merge tool"... */
  context?: string;
}

export interface ShortcutSection {
  title: string;
  rows: ShortcutRow[];
}

const MAC_SYMBOLS: Record<string, string> = { ctrl: "⌃", alt: "⌥", shift: "⇧", cmd: "⌘" };
/** macOS writes modifiers in this order. */
const MAC_ORDER = ["ctrl", "alt", "shift", "cmd"];
const OTHER_ORDER = ["ctrl", "alt", "shift", "cmd"];
const OTHER_NAMES: Record<string, string> = { ctrl: "Ctrl", alt: "Alt", shift: "Shift", cmd: "Super" };

const KEY_NAMES: Record<string, { mac: string; other: string }> = {
  up: { mac: "↑", other: "Up" },
  down: { mac: "↓", other: "Down" },
  left: { mac: "←", other: "Left" },
  right: { mac: "→", other: "Right" },
  arrowup: { mac: "↑", other: "Up" },
  arrowdown: { mac: "↓", other: "Down" },
  enter: { mac: "↩", other: "Enter" },
  return: { mac: "↩", other: "Enter" },
  escape: { mac: "esc", other: "Esc" },
  esc: { mac: "esc", other: "Esc" },
  backspace: { mac: "⌫", other: "Backspace" },
  delete: { mac: "⌦", other: "Delete" },
  tab: { mac: "⇥", other: "Tab" },
  space: { mac: "Space", other: "Space" },
  pageup: { mac: "PgUp", other: "PageUp" },
  pagedown: { mac: "PgDn", other: "PageDown" },
};

/** Normalized modifier name, or null when the part is the key itself. */
function modifierOf(part: string, platform: MenuPlatform): string | null {
  switch (part.toLowerCase()) {
    case "cmdorctrl":
    case "commandorcontrol":
    case "mod":
      return platform === "macos" ? "cmd" : "ctrl";
    case "cmd":
    case "command":
    case "meta":
    case "super":
      return "cmd";
    case "ctrl":
    case "control":
      return "ctrl";
    case "alt":
    case "option":
      return "alt";
    case "shift":
      return "shift";
    default:
      return null;
  }
}

/**
 * Writes an accelerator ("CmdOrCtrl+Shift+E", "Ctrl+`", also CodeMirror's "Mod-Shift-d") the
 * way the platform shows keys: "⇧⌘E" on macOS, "Ctrl+Shift+E" elsewhere.
 */
export function formatKeys(accelerator: string, platform: MenuPlatform): string {
  const separator = accelerator.includes("+") ? "+" : "-";
  // A trailing separator is the key itself ("CmdOrCtrl+-", "Ctrl-+").
  const raw = accelerator.endsWith(`${separator}${separator}`)
    ? [...accelerator.slice(0, -2).split(separator), separator]
    : accelerator.split(separator);
  const modifiers = new Set<string>();
  let key = "";
  for (const part of raw) {
    const modifier = modifierOf(part, platform);
    if (modifier) {
      modifiers.add(modifier);
    } else {
      key = part;
    }
  }
  const named = KEY_NAMES[key.toLowerCase()];
  const keyText = named ? (platform === "macos" ? named.mac : named.other) : key.length === 1 ? key.toUpperCase() : key;
  if (platform === "macos") {
    return MAC_ORDER.filter((modifier) => modifiers.has(modifier)).map((modifier) => MAC_SYMBOLS[modifier]).join("") + keyText;
  }
  return [...OTHER_ORDER.filter((modifier) => modifiers.has(modifier)).map((modifier) => OTHER_NAMES[modifier]), keyText].join("+");
}

/** Custom keys by command id (registry.ts's ShortcutOverrides): an accelerator, or null for none. */
export type CustomKeys = Partial<Record<string, string | null>>;

/** Every menu item that has a shortcut, one section per menu, submenus as "Submenu > Item". */
export function menuShortcuts(platform: MenuPlatform, customKeys: CustomKeys = {}): ShortcutSection[] {
  const sections: ShortcutSection[] = [];
  for (const menu of menuSpec(platform, "app")) {
    const rows: ShortcutRow[] = [];
    const walk = (entries: MenuEntry[], path: string[]) => {
      for (const entry of entries) {
        const accelerator =
          entry.kind === "action" ? (Object.hasOwn(customKeys, entry.action) ? (customKeys[entry.action] ?? null) : entry.accelerator) : null;
        if (entry.kind === "action" && accelerator) {
          rows.push({ label: [...path, entry.text.replace(/\.\.\.$/, "")].join(" > "), keys: [formatKeys(accelerator, platform)] });
        } else if (entry.kind === "submenu") {
          walk(entry.items, [...path, entry.text]);
        }
      }
    };
    walk(menu.items, []);
    if (rows.length > 0) {
      sections.push({ title: `${menu.text} menu`, rows });
    }
  }
  return sections;
}

/** Shortcuts no menu item shows. Keep in sync with workspaceShortcuts.ts, the merge tool and the editors. */
function extraShortcuts(platform: MenuPlatform, customKeys: CustomKeys): ShortcutSection[] {
  const keys = (...accelerators: string[]) => accelerators.map((accelerator) => formatKeys(accelerator, platform));
  // A command's keys: its custom one when changed, else the defaults given.
  const commandKeys = (commandId: string, ...defaults: string[]) => {
    if (!Object.hasOwn(customKeys, commandId)) {
      return keys(...defaults);
    }
    const custom = customKeys[commandId] ?? null;
    return custom ? keys(custom) : [];
  };
  const mac = platform === "macos";
  return [
    {
      title: "Search and navigation",
      rows: [
        { label: "Search Everywhere", keys: [mac ? "⇧ ⇧" : "Shift Shift"], context: "Press Shift twice" },
        { label: "Search Everywhere: Files", keys: commandKeys("search.files", "CmdOrCtrl+Shift+O") },
        { label: "Go Back", keys: commandKeys("nav.goBack", "Ctrl+-") },
        { label: "Go Forward", keys: commandKeys("nav.goForward", "Ctrl+Shift+-") },
        // As Window > Next Tab / Previous Tab has them: Ctrl+PageDown / PageUp do nothing on macOS.
        { label: "Next Tab", keys: commandKeys("window.nextTab", mac ? "Cmd+Shift+]" : "Ctrl+PageDown") },
        { label: "Previous Tab", keys: commandKeys("window.previousTab", mac ? "Cmd+Shift+[" : "Ctrl+PageUp") },
        { label: "Show Changes", keys: commandKeys("view.changes", "CmdOrCtrl+Shift+G"), context: "Outside a text editor" },
      ],
    },
    {
      // QuickOpen.svelte: Edit > Go to File (Cmd+P) and View > Command Palette open it.
      title: "Quick Open",
      rows: [
        { label: "Run a command", keys: [">"], context: "Typed first in Quick Open" },
        { label: "Go to a line (and column)", keys: [":"], context: "Typed first in Quick Open" },
        { label: "Go to a symbol in the file", keys: ["@"], context: "Typed first in Quick Open" },
        { label: "Go to a symbol in the workspace", keys: ["#"], context: "Typed first in Quick Open" },
        { label: "List the prefixes", keys: ["?"], context: "Typed first in Quick Open" },
        { label: "Open to the side", keys: keys("CmdOrCtrl+Enter"), context: "On a file in Quick Open, with the split editor on" },
      ],
    },
    {
      title: "Editor",
      rows: [
        { label: "Add a cursor", keys: [mac ? "⌥⇧ click" : "Alt+Shift+click"], context: "In a text editor" },
        { label: "Column selection", keys: [mac ? "⌥ drag" : "Alt+drag"], context: "In a text editor" },
        { label: "Code completion", keys: keys("Ctrl+Space"), context: "In the file editor" },
        { label: "Undo / Redo", keys: keys("CmdOrCtrl+Z", "Shift+CmdOrCtrl+Z") },
        { label: "Save", keys: keys("CmdOrCtrl+S") },
        { label: "Change the font size", keys: [mac ? "⌘ + scroll" : "Ctrl + scroll"], context: "When turned on in Settings > Editor" },
      ],
    },
    {
      title: "Markdown",
      rows: [
        { label: "Bold", keys: keys("CmdOrCtrl+B"), context: "In the Markdown editor and Preview" },
        { label: "Italic", keys: keys("CmdOrCtrl+I"), context: "In the Markdown editor and Preview" },
        { label: "Link", keys: keys("CmdOrCtrl+K"), context: "In the Markdown editor and Preview" },
        { label: "Open a link", keys: [mac ? "⌘ click" : "Ctrl+click"], context: "In the Markdown Preview" },
      ],
    },
    {
      // FileExplorer.svelte, with the keys from fileOps.ts (fileKeyOp).
      title: "Files panel",
      rows: [
        { label: "Cut / Copy / Paste files", keys: keys("CmdOrCtrl+X", "CmdOrCtrl+C", "CmdOrCtrl+V"), context: "In the Files panel" },
        { label: "Duplicate", keys: keys("CmdOrCtrl+D"), context: "In the Files panel" },
        { label: "Rename", keys: keys("F2", "Shift+F6"), context: "In the Files panel" },
        { label: "Move to Trash", keys: mac ? keys("Cmd+Backspace", "Delete") : keys("Delete"), context: "In the Files panel" },
        { label: "Select more rows", keys: [mac ? "⌘ click" : "Ctrl+click", mac ? "⇧ click" : "Shift+click", ...keys("Shift+Up", "Shift+Down")], context: "In the Files panel" },
        { label: "Copy instead of move", keys: [mac ? "⌥ drag" : "Alt+drag"], context: "Dragging in the Files panel" },
      ],
    },
    {
      // CommitBox.svelte.
      title: "Commit box",
      rows: [
        { label: "Commit", keys: keys("CmdOrCtrl+Enter"), context: "In the commit message" },
        { label: "Message history", keys: [...(mac ? keys("Cmd+E") : keys("Ctrl+E")), ...keys("Up")], context: "In the commit message; Up when it is empty" },
      ],
    },
    {
      title: "Merge tool and diffs",
      rows: [
        { label: "Next change or conflict", keys: keys("F7") },
        { label: "Previous change or conflict", keys: keys("Shift+F7") },
      ],
    },
    {
      title: "Terminal",
      rows: [
        { label: "Show or hide the terminal", keys: commandKeys("view.terminal", "Ctrl+`") },
        { label: "New terminal", keys: commandKeys("terminal.new", "Ctrl+Shift+`") },
        { label: "Copy / Paste", keys: mac ? keys("Cmd+C", "Cmd+V") : keys("Ctrl+Shift+C", "Ctrl+Shift+V"), context: "In a terminal" },
        { label: "Stop the running command", keys: keys("Ctrl+C"), context: "In a terminal or the Run tab" },
        { label: "Find in the terminal", keys: mac ? keys("Cmd+F") : keys("Ctrl+Shift+F"), context: "In a terminal" },
        { label: "Split the terminal", keys: mac ? keys("Cmd+\\") : keys("Ctrl+Shift+5"), context: "In a panel terminal" },
        { label: "Open a file path or link", keys: [mac ? "⌘ click" : "Ctrl+click"], context: "In a terminal" },
      ],
    },
    {
      title: "Dialogs and lists",
      rows: [
        { label: "Close a dialog, popup or menu", keys: keys("Escape") },
        { label: "Confirm", keys: keys("Enter") },
        { label: "Move in a list", keys: keys("Up", "Down") },
        { label: "Open a context menu", keys: keys("Shift+F10") },
      ],
    },
  ];
}

/** All sections: the menus first, then the shortcuts no menu shows. */
export function shortcutSections(platform: MenuPlatform, customKeys: CustomKeys = {}): ShortcutSection[] {
  // A command whose key was removed has no row.
  const extras = extraShortcuts(platform, customKeys).map((section) => ({
    title: section.title,
    rows: section.rows.filter((row) => row.keys.length > 0),
  }));
  return [...menuShortcuts(platform, customKeys), ...extras];
}

/** Rows whose label, keys or context contain every word of `filter`; empty sections drop out. */
export function filterShortcuts(sections: ShortcutSection[], filter: string): ShortcutSection[] {
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return sections;
  }
  return sections
    .map((section) => ({
      title: section.title,
      rows: section.rows.filter((row) => {
        const text = `${section.title} ${row.label} ${row.keys.join(" ")} ${row.context ?? ""}`.toLowerCase();
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((section) => section.rows.length > 0);
}
