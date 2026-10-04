import { describe, expect, it } from "vitest";
import {
  acceleratorId,
  bindingId,
  codeForKey,
  codeMirrorKey,
  formatAccelerator,
  type KeyPress,
  keybindingFromEvent,
  matchesAccelerator,
  parseAccelerator,
  sameShortcut,
  toAccelerator,
} from "./keybinding";

function press(key: string, code: string, modifiers: Partial<KeyPress> = {}): KeyPress {
  return { key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers };
}

describe("parseAccelerator", () => {
  it("reads menu accelerators per platform", () => {
    expect(parseAccelerator("CmdOrCtrl+Shift+P", "macos")).toEqual({ ctrl: false, alt: false, shift: true, meta: true, code: "KeyP" });
    expect(parseAccelerator("CmdOrCtrl+Shift+P", "windows")).toEqual({ ctrl: true, alt: false, shift: true, meta: false, code: "KeyP" });
    expect(parseAccelerator("Ctrl+`", "macos")).toEqual({ ctrl: true, alt: false, shift: false, meta: false, code: "Backquote" });
    expect(parseAccelerator("Cmd+Shift+]", "macos")?.code).toBe("BracketRight");
    expect(parseAccelerator("Alt+Z", "linux")).toEqual({ ctrl: false, alt: true, shift: false, meta: false, code: "KeyZ" });
  });

  it("reads a minus or plus key after its separator", () => {
    expect(parseAccelerator("CmdOrCtrl+-", "macos")?.code).toBe("Minus");
    expect(parseAccelerator("Ctrl+Shift+-", "linux")).toEqual({ ctrl: true, alt: false, shift: true, meta: false, code: "Minus" });
    expect(parseAccelerator("CmdOrCtrl+=", "macos")?.code).toBe("Equal");
  });

  it("reads CodeMirror keys", () => {
    expect(parseAccelerator("Mod-Shift-d", "macos")).toEqual({ ctrl: false, alt: false, shift: true, meta: true, code: "KeyD" });
    expect(parseAccelerator("Ctrl-Meta-g", "macos")).toEqual({ ctrl: true, alt: false, shift: false, meta: true, code: "KeyG" });
    expect(parseAccelerator("Alt-ArrowUp", "linux")?.code).toBe("ArrowUp");
  });

  it("rejects empty, unknown and doubled keys", () => {
    expect(parseAccelerator("", "macos")).toBeNull();
    expect(parseAccelerator("CmdOrCtrl+Shift", "macos")).toBeNull();
    expect(parseAccelerator("CmdOrCtrl+Hyper", "macos")).toBeNull();
    expect(parseAccelerator("A+B", "macos")).toBeNull();
  });

  it("knows function, digit and named keys", () => {
    expect(codeForKey("F7")).toBe("F7");
    expect(codeForKey("9")).toBe("Digit9");
    expect(codeForKey("PageDown")).toBe("PageDown");
    expect(codeForKey("Up")).toBe("ArrowUp");
    expect(codeForKey("F99")).toBeNull();
  });
});

describe("matchesAccelerator", () => {
  it("matches the platform's main modifier", () => {
    expect(matchesAccelerator(press("p", "KeyP", { metaKey: true }), "CmdOrCtrl+P", "macos")).toBe(true);
    expect(matchesAccelerator(press("p", "KeyP", { ctrlKey: true }), "CmdOrCtrl+P", "macos")).toBe(false);
    expect(matchesAccelerator(press("p", "KeyP", { ctrlKey: true }), "CmdOrCtrl+P", "windows")).toBe(true);
    expect(matchesAccelerator(press("P", "KeyP", { metaKey: true, shiftKey: true }), "CmdOrCtrl+P", "macos")).toBe(false);
    expect(matchesAccelerator(press("P", "KeyP", { metaKey: true, shiftKey: true }), "CmdOrCtrl+Shift+P", "macos")).toBe(true);
  });

  it("matches letters by the typed key, and by the physical key with Option", () => {
    // Dvorak: the key typing "p" is where QWERTY has "R".
    expect(matchesAccelerator(press("p", "KeyR", { metaKey: true }), "CmdOrCtrl+P", "macos")).toBe(true);
    // Option+Z types "Ω" on macOS.
    expect(matchesAccelerator(press("Ω", "KeyZ", { altKey: true }), "Alt+Z", "macos")).toBe(true);
    // Shift changes the character of symbol keys, so they match physically.
    expect(matchesAccelerator(press("~", "Backquote", { ctrlKey: true, shiftKey: true }), "Ctrl+Shift+`", "macos")).toBe(true);
  });
});

describe("writing keys", () => {
  it("turns key presses into bindings, skipping lone modifiers", () => {
    expect(keybindingFromEvent(press("Shift", "ShiftLeft", { shiftKey: true }))).toBeNull();
    expect(keybindingFromEvent(press("k", "KeyK", { metaKey: true }))).toEqual({ ctrl: false, alt: false, shift: false, meta: true, code: "KeyK" });
  });

  it("writes bindings back as accelerators that parse to the same keys", () => {
    for (const accelerator of ["CmdOrCtrl+Shift+P", "Ctrl+`", "CmdOrCtrl+-", "Alt+Up", "CmdOrCtrl+Alt+B", "F7"]) {
      for (const platform of ["macos", "windows"] as const) {
        const binding = parseAccelerator(accelerator, platform);
        expect(binding).not.toBeNull();
        if (binding) {
          expect(sameShortcut(toAccelerator(binding, platform), accelerator, platform), `${accelerator} ${platform}`).toBe(true);
        }
      }
    }
    expect(toAccelerator({ ctrl: true, alt: false, shift: true, meta: true, code: "KeyP" }, "macos")).toBe("CmdOrCtrl+Ctrl+Shift+P");
  });

  it("formats for display like the menus", () => {
    expect(formatAccelerator("CmdOrCtrl+Shift+P", "macos")).toBe("⇧⌘P");
    expect(formatAccelerator("CmdOrCtrl+Shift+P", "linux")).toBe("Ctrl+Shift+P");
  });

  it("compares shortcuts as the platform reads them", () => {
    expect(sameShortcut("CmdOrCtrl+P", "Cmd+P", "macos")).toBe(true);
    expect(sameShortcut("CmdOrCtrl+P", "Cmd+P", "windows")).toBe(false);
    expect(sameShortcut("Shift+CmdOrCtrl+G", "CmdOrCtrl+Shift+G", "linux")).toBe(true);
  });
});

describe("binding ids and CodeMirror keys", () => {
  it("gives the same id to the same keys written two ways", () => {
    expect(acceleratorId("CmdOrCtrl+Shift+P", "macos")).toBe(acceleratorId("Shift+Cmd+P", "macos"));
    expect(acceleratorId("CmdOrCtrl+P", "windows")).toBe(acceleratorId("Ctrl+P", "windows"));
    expect(acceleratorId("CmdOrCtrl+P", "macos")).not.toBe(acceleratorId("Ctrl+P", "macos"));
    expect(acceleratorId("Hyper+P", "macos")).toBeNull();
    expect(bindingId({ ctrl: true, alt: false, shift: true, meta: false, code: "KeyP" })).toBe("ctrl+shift:KeyP");
  });

  it("writes accelerators in CodeMirror notation for the platform", () => {
    expect(codeMirrorKey("CmdOrCtrl+Shift+D", "macos")).toBe("Shift-Meta-d");
    expect(codeMirrorKey("CmdOrCtrl+Shift+D", "linux")).toBe("Ctrl-Shift-d");
    expect(codeMirrorKey("Alt+Up", "macos")).toBe("Alt-ArrowUp");
    expect(codeMirrorKey("CmdOrCtrl+/", "macos")).toBe("Meta-/");
    expect(codeMirrorKey("CmdOrCtrl+-", "windows")).toBe("Ctrl--");
    expect(codeMirrorKey("Ctrl+Space", "macos")).toBe("Ctrl-Space");
    expect(codeMirrorKey("F5", "macos")).toBe("F5");
    expect(codeMirrorKey("Cmd+Alt+]", "macos")).toBe("Alt-Meta-]");
    expect(codeMirrorKey("Nope+X", "macos")).toBeNull();
  });
});
