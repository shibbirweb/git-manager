import { describe, expect, it } from "vitest";
import { menuSpec } from "$lib/menu/menuSpec";
import { type KeyPress, parseAccelerator } from "./keybinding";
import { buildCommandSpecs, type CommandSpec } from "./registry";
import {
  commandsWithKeys,
  isChanged,
  pickKeybindings,
  recordKeys,
  replaceShortcut,
  reservedReason,
  shortcutConflicts,
  shortcutProblem,
  shortcutRows,
  usableOverrides,
  withoutOverride,
  withShortcut,
} from "./shortcutSettings";

const specs = buildCommandSpecs(menuSpec("macos", "app"));
const windowsSpecs = buildCommandSpecs(menuSpec("windows", "app"));

function spec(commandId: string, list: readonly CommandSpec[] = specs): CommandSpec {
  const found = list.find((candidate) => candidate.id === commandId);
  if (!found) {
    throw new Error(`no command ${commandId}`);
  }
  return found;
}

function binding(accelerator: string, platform: "macos" | "windows" | "linux" = "macos") {
  const parsed = parseAccelerator(accelerator, platform);
  if (!parsed) {
    throw new Error(`bad accelerator ${accelerator}`);
  }
  return parsed;
}

function press(key: string, code: string, modifiers: Partial<KeyPress> = {}): KeyPress {
  return { key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers };
}

const noFilter = { query: "", keys: null, changedOnly: false };

describe("pickKeybindings", () => {
  it("keeps known commands with keys that parse, and removed keys", () => {
    expect(pickKeybindings({ "git.push": "CmdOrCtrl+Shift+U", "view.sidebar": null, "nav.goBack": " Ctrl+[ " })).toEqual({
      "git.push": "CmdOrCtrl+Shift+U",
      "view.sidebar": null,
      "nav.goBack": "Ctrl+[",
    });
  });

  it("drops unknown commands, bad accelerators and other values", () => {
    expect(
      pickKeybindings({
        "git.nope": "CmdOrCtrl+K",
        "git.push": "Hyper+K",
        "git.pull": "CmdOrCtrl+Shift",
        "git.fetch": 5,
        "git.merge": "",
        "git.rebase": ["CmdOrCtrl+K"],
      }),
    ).toEqual({});
  });

  it("reads anything that is not an object as no custom keys", () => {
    expect(pickKeybindings(null)).toEqual({});
    expect(pickKeybindings("CmdOrCtrl+K")).toEqual({});
    expect(pickKeybindings([["git.push", "F5"]])).toEqual({});
  });
});

describe("reserved and unusable keys", () => {
  it("keeps the keys macOS owns", () => {
    expect(reservedReason(binding("Cmd+Q"), "macos")).toMatch(/quit/);
    expect(reservedReason(binding("CmdOrCtrl+H"), "macos")).toMatch(/hide/);
    expect(reservedReason(binding("Cmd+M"), "macos")).toMatch(/minimize/);
    expect(reservedReason(binding("Cmd+Tab"), "macos")).toMatch(/switch apps/);
    expect(reservedReason(binding("Cmd+C"), "macos")).toMatch(/Copy/);
    expect(reservedReason(binding("Cmd+K"), "macos")).toBeNull();
    // Ctrl+Q is not Cmd+Q.
    expect(reservedReason(binding("Ctrl+Q"), "macos")).toBeNull();
  });

  it("keeps the keys Windows and Linux own", () => {
    expect(reservedReason(binding("Alt+F4", "windows"), "windows")).not.toBeNull();
    expect(reservedReason(binding("CmdOrCtrl+V", "linux"), "linux")).toMatch(/Paste/);
    expect(reservedReason(binding("Cmd+Q", "windows"), "windows")).toBeNull();
  });

  it("asks for a modifier on keys that type, but takes function keys alone", () => {
    expect(shortcutProblem(binding("K"), "macos")).toMatch(/Add Cmd, Ctrl or Option/);
    expect(shortcutProblem(binding("Shift+K"), "macos")).not.toBeNull();
    expect(shortcutProblem(binding("Enter"), "linux")).toMatch(/Add Ctrl or Alt/);
    expect(shortcutProblem(binding("F5"), "macos")).toBeNull();
    expect(shortcutProblem(binding("Shift+F6"), "macos")).toBeNull();
    expect(shortcutProblem(binding("Alt+Z"), "macos")).toBeNull();
    expect(shortcutProblem(binding("Cmd+Q"), "macos")).toMatch(/^Reserved/);
  });

  it("refuses keys a menu accelerator cannot write", () => {
    expect(shortcutProblem({ ctrl: true, alt: false, shift: false, meta: false, code: "Numpad1" }, "windows")).toMatch(/cannot be used/);
  });

  it("writes the keys in use the way the native menu reads them", () => {
    expect(usableOverrides({ "code.duplicate": "Mod-Shift-d", "git.push": "Cmd+Shift+U", "git.pull": "Option+P" }, "macos")).toEqual({
      "code.duplicate": "CmdOrCtrl+Shift+D",
      "git.push": "CmdOrCtrl+Shift+U",
      "git.pull": "Alt+P",
    });
    expect(usableOverrides({ "git.push": "Super+U" }, "linux")).toEqual({ "git.push": "Super+U" });
  });

  it("leaves hand-edited reserved and bare keys out of the keys in use", () => {
    expect(usableOverrides({ "git.push": "Cmd+Q", "git.pull": "K", "git.fetch": "F5", "git.merge": null }, "macos")).toEqual({
      "git.fetch": "F5",
      "git.merge": null,
    });
  });
});

describe("recordKeys", () => {
  it("turns a key press into an accelerator with its problem", () => {
    const recorded = recordKeys(press("K", "KeyK", { metaKey: true, shiftKey: true }), "macos");
    expect(recorded?.accelerator).toBe("CmdOrCtrl+Shift+K");
    expect(recorded?.text).toBe("⇧⌘K");
    expect(recorded?.problem).toBeNull();
    expect(recordKeys(press("q", "KeyQ", { metaKey: true }), "macos")?.problem).toMatch(/quit/);
    expect(recordKeys(press("p", "KeyP", { ctrlKey: true, shiftKey: true }), "windows")?.accelerator).toBe("CmdOrCtrl+Shift+P");
  });

  it("waits while only modifiers are down", () => {
    expect(recordKeys(press("Shift", "ShiftLeft", { shiftKey: true }), "macos")).toBeNull();
    expect(recordKeys(press("Meta", "MetaLeft", { metaKey: true }), "macos")).toBeNull();
  });
});

describe("changing a shortcut", () => {
  it("records a new key and drops the override when the default comes back", () => {
    const push = spec("git.push");
    const changed = withShortcut({}, push, "F5", "macos");
    expect(changed).toEqual({ "git.push": "F5" });
    expect(isChanged(push, changed)).toBe(true);
    expect(withShortcut(changed, push, null, "macos")).toEqual({});
    const palette = spec("view.commandPalette");
    expect(withShortcut({ "view.commandPalette": "F1" }, palette, "Cmd+Shift+P", "macos")).toEqual({});
    expect(withShortcut({}, palette, null, "macos")).toEqual({ "view.commandPalette": null });
  });

  it("resets one command", () => {
    expect(withoutOverride({ "git.push": "F5", "git.pull": null }, "git.push")).toEqual({ "git.pull": null });
  });

  it("replaces: the keys move and the other commands lose them", () => {
    const duplicate = spec("code.duplicate");
    const next = replaceShortcut({}, duplicate, "CmdOrCtrl+D", [spec("code.selectNextOccurrence")], "macos");
    expect(next).toEqual({ "code.duplicate": "CmdOrCtrl+D", "code.selectNextOccurrence": null });
  });
});

describe("conflicts", () => {
  it("finds the other commands with the same keys", () => {
    expect(commandsWithKeys(specs, {}, "macos", "Cmd+Shift+P").map((other) => other.id)).toEqual(["view.commandPalette"]);
    expect(commandsWithKeys(specs, {}, "macos", "CmdOrCtrl+Shift+P", "view.commandPalette")).toEqual([]);
    expect(commandsWithKeys(specs, { "view.filesPanel": null }, "macos", "CmdOrCtrl+B")).toEqual([]);
    // An editor key and a window key get in each other's way too.
    expect(commandsWithKeys(specs, {}, "macos", "CmdOrCtrl+D").map((other) => other.id)).toEqual(["code.selectNextOccurrence"]);
  });

  it("reports a changed key that matches another command, on both sides", () => {
    const conflicts = shortcutConflicts(specs, { "git.push": "CmdOrCtrl+B" }, "macos");
    expect(conflicts.get("git.push")?.map((other) => other.id)).toEqual(["view.filesPanel"]);
    expect(conflicts.get("view.filesPanel")?.map((other) => other.id)).toEqual(["git.push"]);
  });

  it("leaves out the pairs the app ships on purpose", () => {
    // Shift+Cmd+G: Find Previous in an editor, Changes elsewhere.
    expect(shortcutConflicts(specs, {}, "macos").size).toBe(0);
    expect(shortcutConflicts(windowsSpecs, {}, "windows").size).toBe(0);
  });
});

describe("shortcutRows", () => {
  it("lists every command in menu order with its keys", () => {
    const rows = shortcutRows(specs, {}, "macos", noFilter);
    expect(rows).toHaveLength(specs.length);
    const palette = rows.find((row) => row.spec.id === "view.commandPalette");
    expect(palette?.keysText).toBe("⇧⌘P");
    expect(palette?.label).toBe("View: Command Palette");
    expect(palette?.changed).toBe(false);
    expect(rows.find((row) => row.spec.id === "git.push")?.keysText).toBeNull();
  });

  it("searches by words in the name, the category, the id or the keys as written", () => {
    const ids = (query: string) => shortcutRows(specs, {}, "macos", { ...noFilter, query }).map((row) => row.spec.id);
    expect(ids("command palette")).toEqual(["view.commandPalette", "commands.clearRecent"]);
    expect(ids("current file history")).toContain("git.file.history");
    expect(ids("git.file.add")).toEqual(["git.file.add"]);
    expect(ids("⇧⌘P")).toEqual(["view.commandPalette"]);
    expect(ids("keyboard")).toEqual(["help.shortcuts", "settings.keyboardShortcuts"]);
  });

  it("searches by recorded keys, custom ones included", () => {
    const rows = shortcutRows(specs, { "git.push": "CmdOrCtrl+B" }, "macos", { ...noFilter, keys: binding("Cmd+B") });
    expect(rows.map((row) => row.spec.id)).toEqual(["view.filesPanel", "git.push"]);
    expect(rows.every((row) => row.conflicts.length === 1)).toBe(true);
  });

  it("shows only changed commands, with the default they replace", () => {
    const rows = shortcutRows(specs, { "view.filesPanel": "F2", "git.push": null }, "macos", { ...noFilter, changedOnly: true });
    expect(rows.map((row) => row.spec.id)).toEqual(["view.filesPanel", "git.push"]);
    expect(rows[0].keysText).toBe("F2");
    expect(rows[0].defaultText).toBe("⌘B");
    expect(rows[1].keysText).toBeNull();
  });
});
