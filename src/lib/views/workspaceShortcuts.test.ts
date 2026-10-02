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

  it("maps Cmd+P and Shift+Cmd+O to Go to File", () => {
    expect(workspaceShortcut(press("p", "KeyP", { metaKey: true }), idle)).toBe("goToFile");
    expect(workspaceShortcut(press("O", "KeyO", { metaKey: true, shiftKey: true }), idle)).toBe("goToFile");
    expect(workspaceShortcut(press("P", "KeyP", { metaKey: true, shiftKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("p", "KeyP", { metaKey: true }), { dialogOpen: true, mergeOpen: false })).toBeNull();
    // Ctrl+P is cursor up in a macOS editor, which handles it first.
    expect(workspaceShortcut(press("p", "KeyP", { ctrlKey: true, defaultPrevented: true }), idle)).toBeNull();
  });

  it("maps the JetBrains Search Everywhere keys", () => {
    expect(workspaceShortcut(press("o", "KeyO", { metaKey: true }), idle)).toBe("goToClass");
    expect(workspaceShortcut(press("F", "KeyF", { metaKey: true, shiftKey: true }), idle)).toBe("findInFiles");
    // Option turns O into another character on macOS: matched by the physical key.
    expect(workspaceShortcut(press("ø", "KeyO", { metaKey: true, altKey: true }), idle)).toBe("goToSymbol");
    expect(workspaceShortcut(press("Ø", "KeyO", { metaKey: true, altKey: true, shiftKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("R", "KeyR", { metaKey: true, shiftKey: true }), idle)).toBe("replaceInFiles");
    // Cmd+F and Cmd+R are the editor's own find and replace.
    expect(workspaceShortcut(press("f", "KeyF", { metaKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("r", "KeyR", { metaKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("R", "KeyR", { metaKey: true, shiftKey: true }), { dialogOpen: true, mergeOpen: false })).toBeNull();
    expect(workspaceShortcut(press("o", "KeyO", { metaKey: true }), { dialogOpen: true, mergeOpen: false })).toBeNull();
    expect(workspaceShortcut(press("F", "KeyF", { metaKey: true, shiftKey: true, defaultPrevented: true }), idle)).toBeNull();
  });

  it("maps Shift+Cmd+] and Shift+Cmd+[ to the next and previous tab by the physical key", () => {
    expect(workspaceShortcut(press("}", "BracketRight", { metaKey: true, shiftKey: true }), idle)).toBe("nextTab");
    expect(workspaceShortcut(press("{", "BracketLeft", { metaKey: true, shiftKey: true }), idle)).toBe("previousTab");
    // Cmd+] / Cmd+[ without Shift indent in the editor.
    expect(workspaceShortcut(press("]", "BracketRight", { metaKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("}", "BracketRight", { metaKey: true, shiftKey: true }), { dialogOpen: true, mergeOpen: false })).toBeNull();
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

  it("toggles word wrap with Option+Z by the physical key", () => {
    // Option+Z types a character on macOS.
    expect(workspaceShortcut(press("Ω", "KeyZ", { altKey: true }), idle)).toBe("toggleWordWrap");
    expect(workspaceShortcut(press("z", "KeyZ", { ctrlKey: true, altKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("Ω", "KeyZ", { altKey: true, shiftKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("Ω", "KeyZ", { altKey: true }), { dialogOpen: true, mergeOpen: false })).toBeNull();
  });

  it("maps Ctrl+- and Ctrl+Shift+- to Back and Forward", () => {
    expect(workspaceShortcut(press("-", "Minus", { ctrlKey: true }), idle)).toBe("goBack");
    expect(workspaceShortcut(press("_", "Minus", { ctrlKey: true, shiftKey: true }), idle)).toBe("goForward");
    expect(workspaceShortcut(press("-", "Minus", { metaKey: true }), idle)).toBeNull();
  });

  it("maps Ctrl+` and Ctrl+Shift+` to the terminal by the physical key", () => {
    expect(workspaceShortcut(press("`", "Backquote", { ctrlKey: true }), idle)).toBe("toggleTerminal");
    expect(workspaceShortcut(press("~", "Backquote", { ctrlKey: true, shiftKey: true }), idle)).toBe("newTerminal");
    // Another layout types a different character on the same key.
    expect(workspaceShortcut(press("<", "Backquote", { ctrlKey: true }), idle)).toBe("toggleTerminal");
    // Cmd+` cycles windows on macOS and Option+Ctrl+` is not ours.
    expect(workspaceShortcut(press("`", "Backquote", { metaKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("`", "Backquote", { ctrlKey: true, altKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("`", "Backquote"), idle)).toBeNull();
  });

  it("toggles the terminal from inside one, but not while a dialog is open", () => {
    // The terminal lets Ctrl+` bubble without handling it, so it is not defaultPrevented.
    expect(workspaceShortcut(press("`", "Backquote", { ctrlKey: true }), idle)).toBe("toggleTerminal");
    expect(workspaceShortcut(press("`", "Backquote", { ctrlKey: true }), { dialogOpen: true, mergeOpen: false })).toBeNull();
    expect(workspaceShortcut(press("`", "Backquote", { ctrlKey: true, defaultPrevented: true }), idle)).toBeNull();
  });

  it("ignores keys without a shortcut", () => {
    expect(workspaceShortcut(press("g", "KeyG", { metaKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("B", "KeyB", { metaKey: true, shiftKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("L", "KeyL", { shiftKey: true }), idle)).toBeNull();
    expect(workspaceShortcut(press("g", "KeyG", { metaKey: true, altKey: true }), idle)).toBeNull();
  });

  it("skips keys an editor already handled", () => {
    // Shift+Cmd+G is find previous and Shift+Cmd+L selects every match in CodeMirror;
    // Ctrl+Cmd+G (Select All Occurrences) is never a window shortcut.
    expect(workspaceShortcut(press("g", "KeyG", { metaKey: true, ctrlKey: true }), idle)).toBeNull();
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
