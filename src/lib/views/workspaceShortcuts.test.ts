import { describe, expect, it } from "vitest";
import { buildCommandSpecs } from "$lib/commands/registry";
import { menuSpec } from "$lib/menu/menuSpec";
import { type ShortcutContext, type ShortcutKey, type ShortcutKeys, windowCommand, workspaceShortcut } from "./workspaceShortcuts";

const idle: ShortcutContext = { dialogOpen: false, mergeOpen: false };
const mac: ShortcutKeys = { specs: buildCommandSpecs(menuSpec("macos", "app")), platform: "macos", overrides: {} };
const windows: ShortcutKeys = { specs: buildCommandSpecs(menuSpec("windows", "app")), platform: "windows", overrides: {} };

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
    expect(workspaceShortcut(press("b", "KeyB", { metaKey: true }), idle, mac)).toBe("toggleSidebar");
    // The Markdown editors make text bold with Cmd+B and handle it first.
    expect(workspaceShortcut(press("b", "KeyB", { metaKey: true, defaultPrevented: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("G", "KeyG", { metaKey: true, shiftKey: true }), idle, mac)).toBe("showChanges");
    expect(workspaceShortcut(press("E", "KeyE", { metaKey: true, shiftKey: true }), idle, mac)).toBe("showBranches");
    expect(workspaceShortcut(press("L", "KeyL", { metaKey: true, shiftKey: true }), idle, mac)).toBe("toggleLog");
  });

  it("maps Cmd+P to Quick Open, Shift+Cmd+P to the Command Palette and Shift+Cmd+O to Go to File", () => {
    expect(workspaceShortcut(press("p", "KeyP", { metaKey: true }), idle, mac)).toBe("quickOpen");
    expect(workspaceShortcut(press("P", "KeyP", { metaKey: true, shiftKey: true }), idle, mac)).toBe("commandPalette");
    expect(workspaceShortcut(press("O", "KeyO", { metaKey: true, shiftKey: true }), idle, mac)).toBe("goToFile");
    expect(workspaceShortcut(press("p", "KeyP", { metaKey: true }), { dialogOpen: true, mergeOpen: false }, mac)).toBeNull();
    expect(workspaceShortcut(press("P", "KeyP", { metaKey: true, shiftKey: true }), { dialogOpen: false, mergeOpen: true }, mac)).toBeNull();
    // Ctrl+P is cursor up in a macOS editor, which handles it first.
    expect(workspaceShortcut(press("p", "KeyP", { ctrlKey: true, defaultPrevented: true }), idle, mac)).toBeNull();
  });

  it("maps Cmd+E to Recent Files, but not from the commit box that handled it first", () => {
    expect(workspaceShortcut(press("e", "KeyE", { metaKey: true }), idle, mac)).toBe("recentFiles");
    expect(workspaceShortcut(press("e", "KeyE", { metaKey: true, defaultPrevented: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("e", "KeyE", { metaKey: true }), { dialogOpen: true, mergeOpen: false }, mac)).toBeNull();
  });

  it("maps the JetBrains Search Everywhere keys", () => {
    expect(workspaceShortcut(press("o", "KeyO", { metaKey: true }), idle, mac)).toBe("goToClass");
    expect(workspaceShortcut(press("F", "KeyF", { metaKey: true, shiftKey: true }), idle, mac)).toBe("findInFiles");
    // Option turns O into another character on macOS: matched by the physical key.
    expect(workspaceShortcut(press("ø", "KeyO", { metaKey: true, altKey: true }), idle, mac)).toBe("goToSymbol");
    expect(workspaceShortcut(press("Ø", "KeyO", { metaKey: true, altKey: true, shiftKey: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("R", "KeyR", { metaKey: true, shiftKey: true }), idle, mac)).toBe("replaceInFiles");
    // Cmd+F and Cmd+R are the editor's own find and replace.
    expect(workspaceShortcut(press("f", "KeyF", { metaKey: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("r", "KeyR", { metaKey: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("R", "KeyR", { metaKey: true, shiftKey: true }), { dialogOpen: true, mergeOpen: false }, mac)).toBeNull();
    expect(workspaceShortcut(press("o", "KeyO", { metaKey: true }), { dialogOpen: true, mergeOpen: false }, mac)).toBeNull();
    expect(workspaceShortcut(press("F", "KeyF", { metaKey: true, shiftKey: true, defaultPrevented: true }), idle, mac)).toBeNull();
  });

  it("maps Shift+Cmd+] and Shift+Cmd+[ to the next and previous tab by the physical key", () => {
    expect(workspaceShortcut(press("}", "BracketRight", { metaKey: true, shiftKey: true }), idle, mac)).toBe("nextTab");
    expect(workspaceShortcut(press("{", "BracketLeft", { metaKey: true, shiftKey: true }), idle, mac)).toBe("previousTab");
    // Cmd+] / Cmd+[ without Shift indent in the editor.
    expect(workspaceShortcut(press("]", "BracketRight", { metaKey: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("}", "BracketRight", { metaKey: true, shiftKey: true }), { dialogOpen: true, mergeOpen: false }, mac)).toBeNull();
  });

  it("uses Ctrl for Cmd on Windows and Linux, and only there", () => {
    expect(workspaceShortcut(press("b", "KeyB", { ctrlKey: true }), idle, windows)).toBe("toggleSidebar");
    expect(workspaceShortcut(press("G", "KeyG", { ctrlKey: true, shiftKey: true }), idle, windows)).toBe("showChanges");
    expect(workspaceShortcut(press("P", "KeyP", { ctrlKey: true, shiftKey: true }), idle, windows)).toBe("commandPalette");
    // Ctrl+B is the cursor's back key in a macOS text field.
    expect(workspaceShortcut(press("b", "KeyB", { ctrlKey: true }), idle, mac)).toBeNull();
    // Tabs switch with Ctrl+PageDown / PageUp there, as the Window menu shows.
    expect(workspaceShortcut(press("PageDown", "PageDown", { ctrlKey: true }), idle, windows)).toBe("nextTab");
  });

  it("matches Option+Cmd+B by the physical key", () => {
    // Option turns B into another character on macOS.
    expect(workspaceShortcut(press("∫", "KeyB", { metaKey: true, altKey: true }), idle, mac)).toBe("toggleExplorer");
    expect(workspaceShortcut(press("∫", "KeyB", { metaKey: true, altKey: true, shiftKey: true }), idle, mac)).toBeNull();
  });

  it("toggles word wrap with Option+Z by the physical key", () => {
    // Option+Z types a character on macOS.
    expect(workspaceShortcut(press("Ω", "KeyZ", { altKey: true }), idle, mac)).toBe("toggleWordWrap");
    expect(workspaceShortcut(press("z", "KeyZ", { ctrlKey: true, altKey: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("Ω", "KeyZ", { altKey: true, shiftKey: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("Ω", "KeyZ", { altKey: true }), { dialogOpen: true, mergeOpen: false }, mac)).toBeNull();
  });

  it("maps Ctrl+- and Ctrl+Shift+- to Back and Forward", () => {
    expect(workspaceShortcut(press("-", "Minus", { ctrlKey: true }), idle, mac)).toBe("goBack");
    expect(workspaceShortcut(press("_", "Minus", { ctrlKey: true, shiftKey: true }), idle, mac)).toBe("goForward");
    expect(workspaceShortcut(press("-", "Minus", { metaKey: true }), idle, mac)).toBeNull();
  });

  it("maps Ctrl+` and Ctrl+Shift+` to the terminal by the physical key", () => {
    expect(workspaceShortcut(press("`", "Backquote", { ctrlKey: true }), idle, mac)).toBe("toggleTerminal");
    expect(workspaceShortcut(press("~", "Backquote", { ctrlKey: true, shiftKey: true }), idle, mac)).toBe("newTerminal");
    // Another layout types a different character on the same key.
    expect(workspaceShortcut(press("<", "Backquote", { ctrlKey: true }), idle, mac)).toBe("toggleTerminal");
    // Cmd+` cycles windows on macOS and Option+Ctrl+` is not ours.
    expect(workspaceShortcut(press("`", "Backquote", { metaKey: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("`", "Backquote", { ctrlKey: true, altKey: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("`", "Backquote"), idle, mac)).toBeNull();
  });

  it("toggles the terminal from inside one, but not while a dialog is open", () => {
    // The terminal lets Ctrl+` bubble without handling it, so it is not defaultPrevented.
    expect(workspaceShortcut(press("`", "Backquote", { ctrlKey: true }), idle, mac)).toBe("toggleTerminal");
    expect(workspaceShortcut(press("`", "Backquote", { ctrlKey: true }), { dialogOpen: true, mergeOpen: false }, mac)).toBeNull();
    expect(workspaceShortcut(press("`", "Backquote", { ctrlKey: true, defaultPrevented: true }), idle, mac)).toBeNull();
  });

  it("ignores keys without a shortcut", () => {
    expect(workspaceShortcut(press("g", "KeyG", { metaKey: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("B", "KeyB", { metaKey: true, shiftKey: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("L", "KeyL", { shiftKey: true }), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("g", "KeyG", { metaKey: true, altKey: true }), idle, mac)).toBeNull();
  });

  it("skips keys an editor already handled", () => {
    // Shift+Cmd+G is find previous and Shift+Cmd+L selects every match in CodeMirror;
    // Ctrl+Cmd+G (Select All Occurrences) is never a window shortcut.
    expect(workspaceShortcut(press("g", "KeyG", { metaKey: true, ctrlKey: true }), idle, mac)).toBeNull();
    const handled = { metaKey: true, shiftKey: true, defaultPrevented: true };
    expect(workspaceShortcut(press("G", "KeyG", handled), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("L", "KeyL", handled), idle, mac)).toBeNull();
    expect(workspaceShortcut(press("-", "Minus", { ctrlKey: true, defaultPrevented: true }), idle, mac)).toBeNull();
  });

  it("waits while a dialog or the merge tool is open", () => {
    const key = press("b", "KeyB", { metaKey: true });
    expect(workspaceShortcut(key, { dialogOpen: true, mergeOpen: false }, mac)).toBeNull();
    expect(workspaceShortcut(key, { dialogOpen: false, mergeOpen: true }, mac)).toBeNull();
  });
});

describe("windowCommand with custom shortcuts", () => {
  it("follows a changed or removed key", () => {
    const keys = { ...mac, overrides: { "view.sidebar": "CmdOrCtrl+Shift+B", "view.log": null } };
    expect(windowCommand(press("B", "KeyB", { metaKey: true, shiftKey: true }), idle, keys)?.id).toBe("view.sidebar");
    expect(windowCommand(press("b", "KeyB", { metaKey: true }), idle, keys)).toBeNull();
    expect(windowCommand(press("L", "KeyL", { metaKey: true, shiftKey: true }), idle, keys)).toBeNull();
  });

  it("runs any global command that was given a key, but leaves the other menu keys to the menu", () => {
    const keys = { ...mac, overrides: { "git.push": "F5", "settings.keyboardShortcuts": "CmdOrCtrl+Alt+K" } };
    expect(windowCommand(press("F5", "F5"), idle, keys)?.id).toBe("git.push");
    expect(windowCommand(press("˚", "KeyK", { metaKey: true, altKey: true }), idle, keys)?.id).toBe("settings.keyboardShortcuts");
    // Cmd+S stays the File menu's, so it also works where the window handler is not.
    expect(windowCommand(press("s", "KeyS", { metaKey: true }), idle, mac)).toBeNull();
    expect(windowCommand(press("F5", "F5"), { dialogOpen: true, mergeOpen: false }, keys)).toBeNull();
  });

  it("never runs editor commands, even with a custom key", () => {
    const keys = { ...mac, overrides: { "code.duplicate": "F6" } };
    expect(windowCommand(press("F6", "F6"), idle, keys)).toBeNull();
  });
});
