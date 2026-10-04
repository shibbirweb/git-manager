import { describe, expect, it } from "vitest";
import { MENU_ACTIONS, type MenuMode, type MenuPlatform } from "./menuIds";
import { actionEntries, menuSpec, platformFromUserAgent } from "./menuSpec";

const PLATFORMS: MenuPlatform[] = ["macos", "windows", "linux"];
const MODES: MenuMode[] = ["app", "mergeTool"];

function titles(platform: MenuPlatform, mode: MenuMode): string[] {
  return menuSpec(platform, mode).map((menu) => menu.text);
}

/** Accelerators as the platform reads them, so CmdOrCtrl+S and Cmd+S on macOS count as one key. */
function resolved(accelerator: string, platform: MenuPlatform): string {
  const parts = accelerator.split("+");
  const key = parts.pop() ?? "";
  const modifiers = parts.map((part) => (part === "CmdOrCtrl" ? (platform === "macos" ? "Cmd" : "Ctrl") : part)).sort();
  return [...modifiers, key.toUpperCase()].join("+");
}

describe("menuSpec", () => {
  it("lays out the macOS menu bar", () => {
    expect(titles("macos", "app")).toEqual(["Git Manager", "File", "Edit", "View", "Code", "Git", "Window", "Help"]);
  });

  it("puts the app menu items in File and Help elsewhere", () => {
    expect(titles("windows", "app")).toEqual(["File", "Edit", "View", "Code", "Git", "Window", "Help"]);
    const actions = actionEntries(menuSpec("linux", "app")).map((entry) => entry.action);
    expect(actions).toContain("app.settings");
    expect(actions).toContain("app.about");
    expect(actions).toContain("app.checkForUpdates");
    const file = menuSpec("linux", "app").find((menu) => menu.text === "File");
    expect(file?.items.some((entry) => entry.kind === "native" && entry.item === "Quit")).toBe(true);
  });

  it("gives the mergetool window a reduced menu", () => {
    expect(titles("macos", "mergeTool")).toEqual(["Git Manager", "Edit", "Window", "Help"]);
    const actions = actionEntries(menuSpec("macos", "mergeTool")).map((entry) => entry.action);
    expect(actions).not.toContain("edit.findInFiles");
    expect(actions).not.toContain("app.checkForUpdates");
    expect(actions).toContain("edit.find");
    // Cmd+W closes the mergetool window, which asks before dropping the result.
    const windowMenu = menuSpec("macos", "mergeTool").find((menu) => menu.role === "window");
    expect(windowMenu?.items.some((entry) => entry.kind === "native" && entry.item === "CloseWindow")).toBe(true);
  });

  it("opens and closes windows from the File menu", () => {
    for (const platform of PLATFORMS) {
      const entries = actionEntries(menuSpec(platform, "app"));
      const key = (action: string) => entries.find((entry) => entry.action === action)?.accelerator ?? null;
      expect(key("file.newWindow")).toBe("CmdOrCtrl+Shift+N");
      expect(key("file.closeWindow")).toBe("CmdOrCtrl+Shift+W");
      expect(entries.some((entry) => entry.action === "file.openFolderNewWindow")).toBe(true);
    }
    // git mergetool runs one window.
    expect(actionEntries(menuSpec("macos", "mergeTool")).some((entry) => entry.action === "file.newWindow")).toBe(false);
  });

  it("never closes the main window with Cmd+W", () => {
    const entries = menuSpec("macos", "app").flatMap((menu) => menu.items);
    expect(entries.some((entry) => entry.kind === "native" && entry.item === "CloseWindow")).toBe(false);
    const closeTab = actionEntries(menuSpec("macos", "app")).find((entry) => entry.action === "file.closeTab");
    expect(closeTab?.accelerator).toBe("CmdOrCtrl+W");
    const reopen = actionEntries(menuSpec("macos", "app")).find((entry) => entry.action === "file.reopenClosedTab");
    expect(reopen?.accelerator).toBe("CmdOrCtrl+Shift+T");
  });

  it("starts the File menu with New File on Cmd+N, and keeps it out of the merge tool", () => {
    const file = menuSpec("macos", "app").find((menu) => menu.text === "File");
    const first = file?.items[0];
    expect(first?.kind === "action" ? [first.action, first.accelerator] : null).toEqual(["file.newFile", "CmdOrCtrl+N"]);
    expect(actionEntries(menuSpec("macos", "mergeTool")).some((entry) => entry.action === "file.newFile")).toBe(false);
  });

  it("uses known actions and each action once per menu bar", () => {
    for (const platform of PLATFORMS) {
      for (const mode of MODES) {
        const actions = actionEntries(menuSpec(platform, mode)).map((entry) => entry.action);
        expect(new Set(actions).size, `${platform} ${mode}`).toBe(actions.length);
        for (const action of actions) {
          expect(MENU_ACTIONS).toContain(action);
        }
      }
    }
  });

  it("offers every action somewhere in the main window's menu", () => {
    const actions = new Set(actionEntries(menuSpec("macos", "app")).map((entry) => entry.action));
    expect(MENU_ACTIONS.filter((action) => !actions.has(action))).toEqual([]);
  });

  it("gives each key to one item", () => {
    for (const platform of PLATFORMS) {
      for (const mode of MODES) {
        const keys = actionEntries(menuSpec(platform, mode))
          .map((entry) => entry.accelerator)
          .filter((accelerator) => accelerator !== null)
          .map((accelerator) => resolved(accelerator, platform));
        expect(keys.filter((key, index) => keys.indexOf(key) !== index), `${platform} ${mode}`).toEqual([]);
      }
    }
  });

  it("keeps the app's editing keys", () => {
    const accelerators = new Map(actionEntries(menuSpec("macos", "app")).map((entry) => [entry.action, entry.accelerator]));
    expect(accelerators.get("edit.undo")).toBe("CmdOrCtrl+Z");
    expect(accelerators.get("edit.findPrevious")).toBe("Shift+CmdOrCtrl+G");
    expect(accelerators.get("code.selectNextOccurrence")).toBe("CmdOrCtrl+D");
    expect(accelerators.get("code.duplicate")).toBe("CmdOrCtrl+Shift+D");
    expect(accelerators.get("edit.selectAllOccurrences")).toBe("Ctrl+Cmd+G");
    // Double Shift is not a menu shortcut.
    expect(accelerators.get("edit.searchEverywhere")).toBeNull();
    // Shift+Cmd+G is Find Previous; Changes keeps the key outside the editor only.
    expect(accelerators.get("view.changes")).toBeNull();
  });

  it("leaves Ctrl+Z and Ctrl+A to the page outside macOS", () => {
    const accelerators = new Map(actionEntries(menuSpec("linux", "app")).map((entry) => [entry.action, entry.accelerator]));
    expect(accelerators.get("edit.undo")).toBeNull();
    expect(accelerators.get("edit.selectAll")).toBeNull();
  });
});

describe("platformFromUserAgent", () => {
  it("tells the platforms apart", () => {
    expect(platformFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15")).toBe("macos");
    expect(platformFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/120")).toBe("windows");
    expect(platformFromUserAgent("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
  });
});
