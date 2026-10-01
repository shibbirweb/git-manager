import { describe, expect, it } from "vitest";
import { type ShortcutContext, type ShortcutKey, workspaceShortcut } from "./workspaceShortcuts";

const idle: ShortcutContext = { dialogOpen: false, mergeOpen: false };

function press(key: string, code: string, modifiers: Partial<ShortcutKey> = {}): ShortcutKey {
  return {
    key,
    code,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    defaultPrevented: false,
    ...modifiers,
  };
}

describe("workspaceShortcut", () => {
  it("maps the Cmd shortcuts", () => {
    expect(workspaceShortcut(press("b", "KeyB", { metaKey: true }), idle)).toBe("toggleSidebar");
    expect(workspaceShortcut(press("G", "KeyG", { metaKey: true, shiftKey: true }), idle)).toBe("showChanges");
    expect(workspaceShortcut(press("E", "KeyE", { metaKey: true, shiftKey: true }), idle)).toBe("showBranches");
    expect(workspaceShortcut(press("L", "KeyL", { metaKey: true, shiftKey: true }), idle)).toBe("toggleLog");
  });

  it("accepts Ctrl in place of Cmd", () => {
    expect(workspaceShortcut(press("b", "KeyB", { ctrlKey: true }), idle)).toBe("toggleSidebar");
    expect(workspaceShortcut(press("G", "KeyG", { ctrlKey: true, shiftKey: true }), idle)).toBe("showChanges");
  });

  it("matches Option+Cmd+B by the physical key", () => {
    // Option turns B into another character on macOS.
    expect(workspaceShortcut(press("∫", "KeyB", { metaKey: true, altKey: true }), idle)).toBe("toggleExplorer");
    expect(workspaceShortcut(press("∫", "KeyB", { metaKey: true, altKey: true, shiftKey: true }), idle)).toBeNull();
  });

  it("maps Ctrl+- and Ctrl+Shift+- to Back and Forward", () => {
    expect(workspaceShortcut(press("-", "Minus", { ctrlKey: true }), idle)).toBe("goBack");
    expect(workspaceShortcut(press("_", "Minus", { ctrlKey: true, shiftKey: true }), idle)).toBe("goForward");
    expect(workspaceShortcut(press("-", "Minus", { metaKey: true }), idle)).toBeNull();
  });

  it("ignores keys without a shortcut", () => {
    expect(workspaceShortcut(press("g", "KeyG", { metaKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("B", "KeyB", { metaKey: true, shiftKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("L", "KeyL", { shiftKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("g", "KeyG", { metaKey: true, altKey: true }), idle)).toBeNull();
  });

  it("skips keys an editor already handled", () => {
    // Shift+Cmd+G is find previous and Shift+Cmd+L selects every match in CodeMirror.
    const handled = { metaKey: true, shiftKey: true, defaultPrevented: true };
    expect(workspaceShortcut(press("G", "KeyG", handled), idle)).toBeNull();
    expect(workspaceShortcut(press("L", "KeyL", handled), idle)).toBeNull();
    expect(workspaceShortcut(press("-", "Minus", { ctrlKey: true, defaultPrevented: true }), idle)).toBeNull();
  });

  it("waits while a dialog or the merge tool is open", () => {
    const key = press("b", "KeyB", { metaKey: true });
    expect(workspaceShortcut(key, { dialogOpen: true, mergeOpen: false })).toBeNull();
    expect(workspaceShortcut(key, { dialogOpen: false, mergeOpen: true })).toBeNull();
  });
});
