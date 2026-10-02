import { defaultKeymap } from "@codemirror/commands";
import type { KeyBinding } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { EDITOR_ACTIONS, type EditorAction } from "$lib/menu/menuIds";
import { codeKeymap, EDITOR_COMMANDS } from "./editorCommands";
import { acceleratorFor, EDITOR_SHORTCUTS, type KeySource, shortcutKey } from "./editorShortcuts";
import { findKeymap } from "./findPanel.svelte";

/** A key name with its modifiers in a fixed order, so "Shift-Mod-k" equals "Mod-Shift-k". */
function normalize(key: string): string {
  const parts = key.split("-");
  const name = parts.pop() ?? "";
  return [...parts.map((part) => (part === "Cmd" ? "Meta" : part)).sort(), name.length === 1 ? name.toLowerCase() : name].join("-");
}

const KEYMAPS: Record<KeySource, readonly KeyBinding[]> = {
  default: defaultKeymap,
  find: findKeymap,
  code: codeKeymap,
};

/** The command a keymap runs for a key on macOS, counting `shift` variants. */
function boundCommand(keymap: readonly KeyBinding[], key: string): unknown {
  const wanted = normalize(key);
  for (const binding of keymap) {
    const name = binding.mac ?? binding.key;
    if (!name) {
      continue;
    }
    if (normalize(name) === wanted) {
      return binding.run;
    }
    if (binding.shift && normalize(`Shift-${name}`) === wanted) {
      return binding.shift;
    }
  }
  return undefined;
}

describe("acceleratorFor", () => {
  it("turns CodeMirror keys into menu accelerators", () => {
    expect(acceleratorFor("Mod-Shift-d")).toBe("CmdOrCtrl+Shift+D");
    expect(acceleratorFor("Mod-/")).toBe("CmdOrCtrl+/");
    expect(acceleratorFor("Ctrl-Meta-g")).toBe("Ctrl+Cmd+G");
    expect(acceleratorFor("Alt-ArrowUp")).toBe("Alt+Up");
    expect(acceleratorFor("Mod-Alt-[")).toBe("CmdOrCtrl+Alt+[");
  });

  it("gives nothing for a missing or unknown key", () => {
    expect(acceleratorFor(null)).toBeNull();
    expect(acceleratorFor("")).toBeNull();
    expect(acceleratorFor("Hyper-x")).toBeNull();
  });
});

describe("EDITOR_SHORTCUTS", () => {
  it("names a key the editor really binds to the menu item's command", () => {
    for (const [action, shortcut] of Object.entries(EDITOR_SHORTCUTS) as [EditorAction, NonNullable<(typeof EDITOR_SHORTCUTS)[EditorAction]>][]) {
      const key = shortcutKey(shortcut, "macos");
      expect(boundCommand(KEYMAPS[shortcut.source], key), `${action} on ${key}`).toBe(EDITOR_COMMANDS[action].run);
    }
  });

  it("uses each key once", () => {
    const keys = Object.values(EDITOR_SHORTCUTS).map((shortcut) => normalize(shortcutKey(shortcut, "macos")));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has a command for every editor action", () => {
    expect(Object.keys(EDITOR_COMMANDS).sort()).toEqual([...EDITOR_ACTIONS].sort());
  });
});
