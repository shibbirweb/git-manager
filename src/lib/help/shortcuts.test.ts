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

  it("lists the tab keys only where they work, as the Window menu has them", () => {
    const row = (platform: "macos" | "windows", label: string) =>
      shortcutSections(platform)
        .find((section) => section.title === "Search and navigation")
        ?.rows.find((entry) => entry.label === label);
    expect(row("macos", "Next Tab")?.keys).toEqual(["⇧⌘]"]);
    expect(row("macos", "Previous Tab")?.keys).toEqual(["⇧⌘["]);
    expect(row("windows", "Next Tab")?.keys).toEqual(["Ctrl+PageDown"]);
    expect(row("windows", "Previous Tab")?.keys).toEqual(["Ctrl+PageUp"]);
    const all = shortcutSections("macos").flatMap((section) => section.rows);
    expect(all.some((entry) => entry.keys.some((keys) => keys.includes("PgDn") || keys.includes("PgUp")))).toBe(false);
    for (const platform of ["macos", "windows"] as const) {
      const windowMenu = menuShortcuts(platform).find((section) => section.title === "Window menu");
      expect(windowMenu?.rows.find((entry) => entry.label === "Next Tab")?.keys).toEqual(row(platform, "Next Tab")?.keys);
      expect(windowMenu?.rows.find((entry) => entry.label === "Previous Tab")?.keys).toEqual(row(platform, "Previous Tab")?.keys);
    }
  });

  it("lists Cmd+B as Bold in both Markdown editors", () => {
    const markdown = shortcutSections("macos").find((section) => section.title === "Markdown");
    expect(markdown?.rows.find((entry) => entry.label === "Bold")).toEqual({
      label: "Bold",
      keys: ["⌘B"],
      context: "In the Markdown editor and Preview",
    });
  });

  it("lists the Files panel keys per platform", () => {
    const files = (platform: "macos" | "windows") => shortcutSections(platform).find((section) => section.title === "Files panel");
    expect(files("macos")?.rows.find((entry) => entry.label === "Move to Trash")?.keys).toEqual(["⌘⌫", "⌦"]);
    expect(files("windows")?.rows.find((entry) => entry.label === "Move to Trash")?.keys).toEqual(["Delete"]);
    expect(files("windows")?.rows.find((entry) => entry.label === "Duplicate")?.keys).toEqual(["Ctrl+D"]);
    expect(files("macos")?.rows.find((entry) => entry.label === "Rename")?.keys).toEqual(["F2", "⇧F6"]);
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
