// Help > Keyboard Shortcuts: every shortcut of the app. Menu items come straight from the
// menu bar's own definition (menuSpec.ts), so the list can never drift from the real keys;
// the ones no menu shows (double Shift, the merge tool's F7, Option+Shift+click...) are added.

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

/** Every menu item that has a shortcut, one section per menu, submenus as "Submenu > Item". */
export function menuShortcuts(platform: MenuPlatform): ShortcutSection[] {
  const sections: ShortcutSection[] = [];
  for (const menu of menuSpec(platform, "app")) {
    const rows: ShortcutRow[] = [];
    const walk = (entries: MenuEntry[], path: string[]) => {
      for (const entry of entries) {
        if (entry.kind === "action" && entry.accelerator) {
          rows.push({ label: [...path, entry.text.replace(/\.\.\.$/, "")].join(" > "), keys: [formatKeys(entry.accelerator, platform)] });
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
function extraShortcuts(platform: MenuPlatform): ShortcutSection[] {
  const keys = (...accelerators: string[]) => accelerators.map((accelerator) => formatKeys(accelerator, platform));
  const mac = platform === "macos";
  return [
    {
      title: "Search and navigation",
      rows: [
        { label: "Search Everywhere", keys: [mac ? "⇧ ⇧" : "Shift Shift"], context: "Press Shift twice" },
        { label: "Go to File", keys: keys("CmdOrCtrl+P", "CmdOrCtrl+Shift+O") },
        { label: "Go Back", keys: keys("Ctrl+-") },
        { label: "Go Forward", keys: keys("Ctrl+Shift+-") },
        // As Window > Next Tab / Previous Tab has them: Ctrl+PageDown / PageUp do nothing on macOS.
        { label: "Next Tab", keys: mac ? keys("Cmd+Shift+]") : keys("Ctrl+PageDown") },
        { label: "Previous Tab", keys: mac ? keys("Cmd+Shift+[") : keys("Ctrl+PageUp") },
        { label: "Show Changes", keys: keys("CmdOrCtrl+Shift+G"), context: "Outside a text editor" },
      ],
    },
    {
      title: "Editor",
      rows: [
        { label: "Add a cursor", keys: [mac ? "⌥⇧ click" : "Alt+Shift+click"], context: "In a text editor" },
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
      title: "Merge tool and diffs",
      rows: [
        { label: "Next change or conflict", keys: keys("F7") },
        { label: "Previous change or conflict", keys: keys("Shift+F7") },
      ],
    },
    {
      title: "Terminal",
      rows: [
        { label: "Show or hide the terminal", keys: keys("Ctrl+`") },
        { label: "New terminal", keys: keys("Ctrl+Shift+`") },
        { label: "Copy / Paste", keys: mac ? keys("Cmd+C", "Cmd+V") : keys("Ctrl+Shift+C", "Ctrl+Shift+V"), context: "In a terminal" },
        { label: "Stop the running command", keys: keys("Ctrl+C"), context: "In a terminal or the Run tab" },
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
export function shortcutSections(platform: MenuPlatform): ShortcutSection[] {
  return [...menuShortcuts(platform), ...extraShortcuts(platform)];
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
