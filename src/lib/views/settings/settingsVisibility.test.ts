import { describe, expect, it } from "vitest";
import type { SettingsSearchEntry } from "./settingsSearch";
import { sectionVisibility } from "./settingsVisibility";

function entry(label: string, parent: string | null = null): SettingsSearchEntry {
  return { section: "terminal", label, keywords: "", parent };
}

// Page order: a row before any group, then two groups ("Shell", "Font" are group titles of the terminal).
const INDEX = [
  entry("Default shell"),
  entry("Font"),
  entry("Font family"),
  entry("Font size"),
  entry("Shell"),
  entry("Login items"),
  entry("Arguments", "Login items"),
];

describe("sectionVisibility", () => {
  it("shows a matched row and its group title, and marks the matched word starts", () => {
    const view = sectionVisibility("terminal", INDEX, [entry("Font size")], ["siz"]);
    expect([...view.shown]).toEqual(["Font", "Font size"]);
    expect(view.marks.get("Font size")).toEqual([[5, 8]]);
    expect([...view.matchedGroups]).toEqual([]);
  });

  it("keeps a whole group when its title matches", () => {
    const view = sectionVisibility("terminal", INDEX, [entry("Font")], ["font"]);
    expect([...view.shown]).toEqual(["Font", "Font family", "Font size"]);
    expect([...view.matchedGroups]).toEqual(["Font"]);
  });

  it("shows and marks the parent of a found sub-row, whole when its own words did not match", () => {
    const view = sectionVisibility("terminal", INDEX, [entry("Arguments", "Login items")], ["arg"]);
    expect(view.shown.has("Login items")).toBe(true);
    expect(view.shown.has("Arguments")).toBe(true);
    expect(view.shown.has("Shell")).toBe(true);
    expect(view.marks.get("Login items")).toEqual([[0, 11]]);
  });

  it("marks a row found by its extra words whole", () => {
    const view = sectionVisibility("terminal", INDEX, [entry("Default shell")], ["zsh"]);
    expect([...view.shown]).toEqual(["Default shell"]);
    expect(view.marks.get("Default shell")).toEqual([[0, 13]]);
  });

  it("ignores entries of other sections", () => {
    const other: SettingsSearchEntry = { ...entry("Font size"), section: "editor" };
    expect(sectionVisibility("terminal", INDEX, [other], ["font"]).shown.size).toBe(0);
  });
});
