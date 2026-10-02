// The keys of the editor commands in the Edit and Code menus, in CodeMirror notation. The
// editor binds them itself (so they work in every editor, the merge tool included) and the
// menu shows the same keys as accelerators, converted by `acceleratorFor`.

import type { EditorAction, MenuPlatform } from "$lib/menu/menuIds";

/**
 * Which keymap binds the key: CodeMirror's default keymap (setup.ts), the find bar's
 * keymap (findPanel.svelte.ts) or `codeKeymap` (editorCommands.ts).
 */
export type KeySource = "default" | "find" | "code";

export interface EditorShortcut {
  /** CodeMirror key name; `mac` replaces it on macOS. */
  key: string;
  mac?: string;
  source: KeySource;
}

export const EDITOR_SHORTCUTS: Partial<Record<EditorAction, EditorShortcut>> = {
  "edit.find": { key: "Mod-f", source: "find" },
  "edit.replace": { key: "Mod-r", source: "find" },
  "edit.findNext": { key: "Mod-g", source: "find" },
  "edit.findPrevious": { key: "Shift-Mod-g", source: "find" },
  // JetBrains: Ctrl+Cmd+G on macOS, Ctrl+Alt+Shift+J elsewhere.
  "edit.selectAllOccurrences": { key: "Ctrl-Alt-Shift-j", mac: "Ctrl-Meta-g", source: "find" },
  "code.lineComment": { key: "Mod-/", source: "default" },
  "code.blockComment": { key: "Mod-Alt-/", source: "code" },
  // JetBrains' Cmd+D adds the next occurrence here, so Duplicate takes Shift+Cmd+D.
  "code.duplicate": { key: "Mod-Shift-d", source: "code" },
  // Cmd+Backspace already deletes to the line start, as everywhere on macOS.
  "code.deleteLine": { key: "Shift-Mod-k", source: "default" },
  "code.joinLines": { key: "Ctrl-Shift-j", source: "code" },
  // Option+Shift+Up / Down copy the line in this editor (VS Code), so moving keeps Option+Up / Down.
  "code.moveLineUp": { key: "Alt-ArrowUp", source: "default" },
  "code.moveLineDown": { key: "Alt-ArrowDown", source: "default" },
  "code.indent": { key: "Mod-]", source: "default" },
  "code.unindent": { key: "Mod-[", source: "default" },
  "code.toggleCase": { key: "Mod-Shift-u", source: "code" },
  // CodeMirror's fold keys: Cmd+= / Cmd+- stay with the editor font zoom.
  "code.expand": { key: "Ctrl-Shift-]", mac: "Mod-Alt-]", source: "code" },
  "code.collapse": { key: "Ctrl-Shift-[", mac: "Mod-Alt-[", source: "code" },
  "code.expandAll": { key: "Ctrl-Alt-]", source: "code" },
  "code.collapseAll": { key: "Ctrl-Alt-[", source: "code" },
  "code.goToLine": { key: "Mod-l", source: "code" },
  "code.selectNextOccurrence": { key: "Mod-d", source: "find" },
};

/** The key for `platform`, in CodeMirror notation. */
export function shortcutKey(shortcut: EditorShortcut, platform: MenuPlatform): string {
  return platform === "macos" ? (shortcut.mac ?? shortcut.key) : shortcut.key;
}

const MODIFIERS: Record<string, string> = {
  mod: "CmdOrCtrl",
  meta: "Cmd",
  cmd: "Cmd",
  ctrl: "Ctrl",
  control: "Ctrl",
  alt: "Alt",
  shift: "Shift",
};

const KEYS: Record<string, string> = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

/** Turns a CodeMirror key ("Mod-Shift-d") into a menu accelerator ("CmdOrCtrl+Shift+D"); null when it has none. */
export function acceleratorFor(key: string | null | undefined): string | null {
  const parts = (key ?? "").split("-");
  const name = parts.pop() ?? "";
  if (!name) {
    return null;
  }
  const modifiers = parts.map((part) => MODIFIERS[part.toLowerCase()] ?? null);
  if (modifiers.some((modifier) => modifier === null)) {
    return null;
  }
  const keyName = KEYS[name] ?? (name.length === 1 ? name.toUpperCase() : name);
  return [...modifiers, keyName].join("+");
}
