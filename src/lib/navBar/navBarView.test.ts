import { describe, expect, it } from "vitest";
import type { NavCrumb, NavRow } from "./navBarModel";
import { navEntries, navMessage, SEARCH_ENTRY_ID, shownCrumbs } from "./navBarView";

const iconOf = () => null;

function crumb(name: string, kind: NavCrumb["kind"], isRepo = false): NavCrumb {
  return { path: `/w/${name}`, name, kind, isRepo };
}

function row(name: string, isDir: boolean, ignored = false): NavRow {
  return {
    item: { name, path: `/w/${name}`, isDir, isRepo: false, ignored, isFolderRoot: false },
    nameParts: [
      { text: name.slice(0, 2), match: true },
      { text: name.slice(2), match: false },
    ],
  };
}

describe("navBarView", () => {
  it("draws the file crumb with its type icon and a repository in the accent color", () => {
    const crumbs = shownCrumbs([crumb("storefront", "folder", true), crumb("cart.ts", "file")], iconOf);
    expect(crumbs).toEqual([
      { label: "storefront", kind: "repo", icon: "folder-git" },
      { label: "cart.ts", kind: "file", fileIcon: null },
    ]);
  });

  it("lists folders with a chevron, files in their git color and ignored entries faint", () => {
    const entries = navEntries(
      [row("src", true), row("cart.ts", false), row("dist", true, true)],
      "",
      true,
      () => "modified",
      iconOf,
    );
    expect(entries.map((entry) => [entry.name, entry.folder, entry.tone])).toEqual([
      ["src", true, undefined],
      ["cart.ts", false, "modified"],
      ["dist", true, "ignored"],
    ]);
    expect(entries[1].ranges).toEqual([[0, 2]]);
  });

  it("offers Search Everywhere when nothing matches", () => {
    const entries = navEntries([], "zz", true, () => undefined, iconOf);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(SEARCH_ENTRY_ID);
    expect(navEntries([], "zz", false, () => undefined, iconOf)).toEqual([]);
  });

  it("says why the list is empty", () => {
    expect(navMessage(true, null, "", 0)).toBe("Loading...");
    expect(navMessage(false, "Denied", "", 0)).toBe("Denied");
    expect(navMessage(false, null, "", 0)).toBe("Empty folder");
    expect(navMessage(false, null, "zz", 0)).toBe("");
  });
});
