import { describe, expect, it } from "vitest";
import { actionEntries, menuSpec } from "$lib/menu/menuSpec";
import { filterShortcuts, formatKeys, menuShortcuts, shortcutSections } from "./shortcuts";

describe("formatKeys", () => {
  it("writes keys the macOS way", () => {
    expect(formatKeys("CmdOrCtrl+Shift+E", "macos")).toBe("⇧⌘E");
    expect(formatKeys("Ctrl+`", "macos")).toBe("⌃`");
    expect(formatKeys("CmdOrCtrl+-", "macos")).toBe("⌘-");
    expect(formatKeys("Shift+CmdOrCtrl+Z", "macos")).toBe("⇧⌘Z");
    expect(formatKeys("Mod-Alt-/", "macos")).toBe("⌥⌘/");
    expect(formatKeys("Alt+Up", "macos")).toBe("⌥↑");
    expect(formatKeys("F7", "macos")).toBe("F7");
  });

  it("writes keys the Windows and Linux way", () => {
    expect(formatKeys("CmdOrCtrl+Shift+E", "windows")).toBe("Ctrl+Shift+E");
    expect(formatKeys("CmdOrCtrl+,", "linux")).toBe("Ctrl+,");
    expect(formatKeys("Ctrl+Shift+-", "windows")).toBe("Ctrl+Shift+-");
    expect(formatKeys("Escape", "windows")).toBe("Esc");
  });
});

describe("shortcutSections", () => {
  it("lists every menu item that has a shortcut", () => {
    for (const platform of ["macos", "windows"] as const) {
      const withKeys = actionEntries(menuSpec(platform, "app")).filter((entry) => entry.accelerator);
      const listed = menuShortcuts(platform).flatMap((section) => section.rows);
      expect(listed.length).toBe(withKeys.length);
    }
    const view = menuShortcuts("macos").find((section) => section.title === "View menu");
    expect(view?.rows.some((row) => row.label === "Branches and Stashes" && row.keys[0] === "⇧⌘E")).toBe(true);
  });

  it("adds the shortcuts no menu shows", () => {
    const titles = shortcutSections("macos").map((section) => section.title);
    expect(titles).toContain("Search and navigation");
    expect(titles).toContain("Merge tool and diffs");
    const search = shortcutSections("macos").flatMap((section) => section.rows).find((row) => row.label === "Search Everywhere");
    expect(search?.keys).toEqual(["⇧ ⇧"]);
  });

  it("filters by label, keys or place, by every word", () => {
    const all = shortcutSections("macos");
    const terminal = filterShortcuts(all, "terminal new");
    expect(terminal.flatMap((section) => section.rows).map((row) => row.label)).toContain("New terminal");
    expect(filterShortcuts(all, "F7").flatMap((section) => section.rows)).toHaveLength(2);
    expect(filterShortcuts(all, "no such shortcut here")).toEqual([]);
    expect(filterShortcuts(all, "  ")).toBe(all);
  });
});
