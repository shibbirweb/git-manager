import { describe, expect, it } from "vitest";
import { parseAccelerator } from "$lib/commands/keybinding";
import { buildCommandSpecs } from "$lib/commands/registry";
import { menuSpec } from "$lib/menu/menuSpec";
import { shellOwns, type TerminalKey, terminalAppKeys, terminalKeyAction } from "./keys";

const mac = { isMac: true, hasSelection: false };
const macSelected = { isMac: true, hasSelection: true };
const linux = { isMac: false, hasSelection: false };

function press(key: string, code: string, modifiers: Partial<TerminalKey> = {}): TerminalKey {
  return { key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers };
}

describe("terminalKeyAction on macOS", () => {
  it("sends plain and Ctrl keys to the shell", () => {
    expect(terminalKeyAction(press("a", "KeyA"), mac)).toBe("shell");
    expect(terminalKeyAction(press("Enter", "Enter"), mac)).toBe("shell");
    expect(terminalKeyAction(press("c", "KeyC", { ctrlKey: true }), mac)).toBe("shell");
    expect(terminalKeyAction(press("b", "KeyB", { ctrlKey: true }), mac)).toBe("shell");
    expect(terminalKeyAction(press("Escape", "Escape"), mac)).toBe("shell");
    // Option types special characters, as in Terminal.app.
    expect(terminalKeyAction(press("∫", "KeyB", { altKey: true }), mac)).toBe("shell");
  });

  it("leaves Ctrl+` and Ctrl+Shift+` to the app", () => {
    expect(terminalKeyAction(press("`", "Backquote", { ctrlKey: true }), mac)).toBe("app");
    expect(terminalKeyAction(press("~", "Backquote", { ctrlKey: true, shiftKey: true }), mac)).toBe("app");
  });

  it("copies with Cmd+C only when there is a selection", () => {
    expect(terminalKeyAction(press("c", "KeyC", { metaKey: true }), macSelected)).toBe("copy");
    expect(terminalKeyAction(press("c", "KeyC", { metaKey: true }), mac)).toBe("app");
  });

  it("clears with Cmd+K and selects all with Cmd+A", () => {
    expect(terminalKeyAction(press("k", "KeyK", { metaKey: true }), mac)).toBe("clear");
    expect(terminalKeyAction(press("a", "KeyA", { metaKey: true }), mac)).toBe("selectAll");
  });

  it("lets every other Cmd shortcut reach the window", () => {
    expect(terminalKeyAction(press("v", "KeyV", { metaKey: true }), mac)).toBe("app");
    expect(terminalKeyAction(press("b", "KeyB", { metaKey: true }), mac)).toBe("app");
    expect(terminalKeyAction(press(",", "Comma", { metaKey: true }), mac)).toBe("app");
    expect(terminalKeyAction(press("G", "KeyG", { metaKey: true, shiftKey: true }), mac)).toBe("app");
    expect(terminalKeyAction(press("ø", "KeyO", { metaKey: true, altKey: true }), mac)).toBe("app");
    expect(terminalKeyAction(press("F", "KeyF", { metaKey: true, shiftKey: true }), mac)).toBe("app");
  });
});

describe("terminalKeyAction on Windows and Linux", () => {
  it("copies and pastes with Ctrl+Shift+C / V", () => {
    expect(terminalKeyAction(press("C", "KeyC", { ctrlKey: true, shiftKey: true }), { isMac: false, hasSelection: true })).toBe(
      "copy",
    );
    expect(terminalKeyAction(press("V", "KeyV", { ctrlKey: true, shiftKey: true }), linux)).toBe("paste");
  });

  it("sends Ctrl+C to the shell", () => {
    expect(terminalKeyAction(press("c", "KeyC", { ctrlKey: true }), { isMac: false, hasSelection: true })).toBe("shell");
  });

  it("still leaves Ctrl+` to the app", () => {
    expect(terminalKeyAction(press("`", "Backquote", { ctrlKey: true }), linux)).toBe("app");
  });
});

describe("terminalKeyAction for find and split", () => {
  const macFeatures = { isMac: true, hasSelection: false, findEnabled: true, canSplit: true };
  const linuxFeatures = { isMac: false, hasSelection: false, findEnabled: true, canSplit: true };

  it("finds with Cmd+F only while Find in terminal is on", () => {
    expect(terminalKeyAction(press("f", "KeyF", { metaKey: true }), macFeatures)).toBe("find");
    expect(terminalKeyAction(press("f", "KeyF", { metaKey: true }), mac)).toBe("app");
    // Shift+Cmd+F stays Find in Files.
    expect(terminalKeyAction(press("F", "KeyF", { metaKey: true, shiftKey: true }), macFeatures)).toBe("app");
  });

  it("finds with Ctrl+Shift+F on Windows and Linux, and Ctrl+F still reaches the shell", () => {
    expect(terminalKeyAction(press("F", "KeyF", { ctrlKey: true, shiftKey: true }), linuxFeatures)).toBe("find");
    expect(terminalKeyAction(press("F", "KeyF", { ctrlKey: true, shiftKey: true }), linux)).toBe("shell");
    expect(terminalKeyAction(press("f", "KeyF", { ctrlKey: true }), linuxFeatures)).toBe("shell");
  });

  it("splits with Cmd+\\ or Ctrl+Shift+5 in the panel only", () => {
    expect(terminalKeyAction(press("\\", "Backslash", { metaKey: true }), macFeatures)).toBe("split");
    expect(terminalKeyAction(press("\\", "Backslash", { metaKey: true }), { ...macFeatures, canSplit: false })).toBe("app");
    expect(terminalKeyAction(press("%", "Digit5", { ctrlKey: true, shiftKey: true }), linuxFeatures)).toBe("split");
    expect(terminalKeyAction(press("%", "Digit5", { ctrlKey: true, shiftKey: true }), { ...linuxFeatures, canSplit: false })).toBe(
      "shell",
    );
  });
});

describe("the app's keys in a terminal", () => {
  const macSpecs = buildCommandSpecs(menuSpec("macos", "app"));
  const linuxSpecs = buildCommandSpecs(menuSpec("linux", "app"));

  it("leaves control characters, Alt keys and AltGr to the shell", () => {
    const parse = (accelerator: string, platform: "macos" | "linux") => {
      const parsed = parseAccelerator(accelerator, platform);
      if (!parsed) {
        throw new Error(accelerator);
      }
      return parsed;
    };
    expect(shellOwns(parse("Ctrl+P", "linux"), "linux")).toBe(true);
    expect(shellOwns(parse("Alt+B", "linux"), "linux")).toBe(true);
    expect(shellOwns(parse("Ctrl+Alt+Q", "linux"), "linux")).toBe(true);
    expect(shellOwns(parse("F5", "linux"), "linux")).toBe(true);
    expect(shellOwns(parse("Ctrl+Shift+P", "linux"), "linux")).toBe(false);
    expect(shellOwns(parse("Ctrl+`", "linux"), "linux")).toBe(false);
    expect(shellOwns(parse("Super+K", "linux"), "linux")).toBe(false);
    expect(shellOwns(parse("Ctrl+Alt+Q", "macos"), "macos")).toBe(false);
  });

  it("lists the global keys that pass the shell by", () => {
    const keys = terminalAppKeys(linuxSpecs, {}, "linux");
    expect(keys.has("ctrl+shift:KeyP")).toBe(true);
    expect(keys.has("ctrl:Backquote")).toBe(true);
    expect(keys.has("ctrl+shift:Backquote")).toBe(true);
    // Ctrl+B and Ctrl+P stay readline's.
    expect(keys.has("ctrl:KeyB")).toBe(false);
    expect(keys.has("ctrl:KeyP")).toBe(false);
    // Editor commands do nothing in a terminal.
    expect(keys.has("ctrl+shift:KeyD")).toBe(false);
  });

  it("sends Ctrl+Shift+P to the app on Windows and Linux, and custom keys too", () => {
    const appKeys = terminalAppKeys(linuxSpecs, { "git.push": "Ctrl+Shift+U", "view.terminal": "Ctrl+Shift+T" }, "linux");
    const context = { ...linux, appKeys };
    expect(terminalKeyAction(press("P", "KeyP", { ctrlKey: true, shiftKey: true }), context)).toBe("app");
    expect(terminalKeyAction(press("U", "KeyU", { ctrlKey: true, shiftKey: true }), context)).toBe("app");
    expect(terminalKeyAction(press("T", "KeyT", { ctrlKey: true, shiftKey: true }), context)).toBe("app");
    // Ctrl+` moved away: it goes back to the shell.
    expect(terminalKeyAction(press("`", "Backquote", { ctrlKey: true }), context)).toBe("shell");
    expect(terminalKeyAction(press("p", "KeyP", { ctrlKey: true }), context)).toBe("shell");
    // The terminal's own keys come first.
    expect(terminalKeyAction(press("V", "KeyV", { ctrlKey: true, shiftKey: true }), context)).toBe("paste");
  });

  it("matches letters by the typed key, as the window does, so other layouts agree", () => {
    const appKeys = terminalAppKeys(linuxSpecs, { "git.push": "CmdOrCtrl+Shift+A" }, "linux");
    // AZERTY: the key that types A sits where QWERTY has Q.
    expect(terminalKeyAction(press("A", "KeyQ", { ctrlKey: true, shiftKey: true }), { ...linux, appKeys })).toBe("app");
    expect(terminalKeyAction(press("Q", "KeyA", { ctrlKey: true, shiftKey: true }), { ...linux, appKeys })).toBe("shell");
  });

  it("lets a custom Ctrl+Shift key reach the app on macOS", () => {
    const appKeys = terminalAppKeys(macSpecs, { "git.push": "Ctrl+Shift+U" }, "macos");
    const context = { ...mac, appKeys };
    expect(terminalKeyAction(press("U", "KeyU", { ctrlKey: true, shiftKey: true }), context)).toBe("app");
    expect(terminalKeyAction(press("`", "Backquote", { ctrlKey: true }), context)).toBe("app");
    expect(terminalKeyAction(press("u", "KeyU", { ctrlKey: true }), context)).toBe("shell");
    expect(terminalKeyAction(press("b", "KeyB", { metaKey: true }), context)).toBe("app");
  });
});
