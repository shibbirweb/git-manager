import { describe, expect, it } from "vitest";
import type { RecentEntry } from "./recentEntries";
import { BADGE_COLORS, badgeColor, entryKey, entryPaths, entrySubtitle, filterEntries, moveSelection, projectInitials } from "./welcomeModel";

const folder: RecentEntry = { kind: "folder", label: "design-system", hint: "", folderPath: "/Users/me/code/design-system" };
const workspace: RecentEntry = {
  kind: "workspace",
  label: "acme, storefront",
  hint: "2 folders",
  folderPaths: ["/Users/me/code/acme", "/Users/me/code/storefront"],
};
const file: RecentEntry = { kind: "workspaceFile", label: "shop", hint: "workspace file", filePath: "/Users/me/shop.gitmanager-workspace" };

describe("projectInitials", () => {
  it("takes the first letters of the first two words", () => {
    expect(projectInitials("design-system")).toBe("DS");
    expect(projectInitials("payments_api v2")).toBe("PA");
    expect(projectInitials("gitManager")).toBe("GM");
    expect(projectInitials("acme, storefront")).toBe("AS");
  });

  it("takes two letters of a single word", () => {
    expect(projectInitials("acme")).toBe("AC");
    expect(projectInitials("x")).toBe("X");
    expect(projectInitials(".dotfiles")).toBe("DO");
    expect(projectInitials("---")).toBe("?");
  });
});

describe("badgeColor", () => {
  it("keeps one color per project", () => {
    expect(badgeColor("/Users/me/code/acme")).toBe(badgeColor("/Users/me/code/acme"));
    expect(BADGE_COLORS).toContain(badgeColor(""));
    const colors = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(badgeColor));
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe("entries", () => {
  it("names each entry by its paths", () => {
    expect(entryKey(folder)).toBe("/Users/me/code/design-system");
    expect(entryKey(workspace)).toBe("/Users/me/code/acme\n/Users/me/code/storefront");
    expect(entryPaths(file)).toEqual(["/Users/me/shop.gitmanager-workspace"]);
    expect(entrySubtitle(workspace)).toBe("~/code/acme, ~/code/storefront");
    expect(entrySubtitle(file)).toBe("~/shop.gitmanager-workspace");
  });

  it("filters by every word of the search, in names and paths", () => {
    const entries = [folder, workspace, file];
    expect(filterEntries(entries, "")).toEqual(entries);
    expect(filterEntries(entries, "DESIGN")).toEqual([folder]);
    expect(filterEntries(entries, "code store")).toEqual([workspace]);
    expect(filterEntries(entries, "shop")).toEqual([file]);
    expect(filterEntries(entries, "nothing")).toEqual([]);
  });
});

describe("moveSelection", () => {
  it("moves with the arrows and stops at the ends", () => {
    expect(moveSelection(0, "ArrowDown", 3)).toBe(1);
    expect(moveSelection(2, "ArrowDown", 3)).toBe(2);
    expect(moveSelection(0, "ArrowUp", 3)).toBe(0);
    expect(moveSelection(1, "End", 3)).toBe(2);
    expect(moveSelection(2, "Home", 3)).toBe(0);
    expect(moveSelection(0, "Enter", 3)).toBeNull();
    expect(moveSelection(0, "ArrowDown", 0)).toBeNull();
  });
});
