import { describe, expect, it } from "vitest";
import { type TerminalKey, terminalKeyAction } from "./keys";

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
