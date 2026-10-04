import { describe, expect, it } from "vitest";
import {
  crumbsFor,
  enterItem,
  folderItems,
  itemsOf,
  listedIndex,
  navRows,
  previousPopup,
  rowIndexOf,
  selectedPathFor,
  startIndex,
} from "./navBarModel";

const one = [{ root: "/w/shop", name: "shop" }];
const two = [
  { root: "/w/shop", name: "shop" },
  { root: "/w/docs", name: "docs" },
];
const repos = new Set(["/w/shop", "/w/shop/vendor/lib"]);

const paths = (crumbs: ReturnType<typeof crumbsFor>) => crumbs.map((crumb) => `${crumb.kind}:${crumb.path}`);

describe("crumbsFor", () => {
  it("lists the folder, each folder down the path and the file", () => {
    const crumbs = crumbsFor(one, "shop", "/w/shop/src/cart/cart.ts", repos);
    expect(paths(crumbs)).toEqual(["folder:/w/shop", "dir:/w/shop/src", "dir:/w/shop/src/cart", "file:/w/shop/src/cart/cart.ts"]);
    expect(crumbs[0]).toMatchObject({ name: "shop", isRepo: true });
    expect(crumbs[3]).toMatchObject({ name: "cart.ts", isRepo: false });
  });

  it("marks nested repositories and ends on a folder when asked", () => {
    const crumbs = crumbsFor(one, "shop", "/w/shop/vendor/lib", repos, true);
    expect(paths(crumbs)).toEqual(["folder:/w/shop", "dir:/w/shop/vendor", "dir:/w/shop/vendor/lib"]);
    expect(crumbs[2].isRepo).toBe(true);
  });

  it("starts with the workspace when it has several folders", () => {
    const crumbs = crumbsFor(two, "shop, docs", "/w/docs/guide.md", repos);
    expect(paths(crumbs)).toEqual(["workspace:", "folder:/w/docs", "file:/w/docs/guide.md"]);
    expect(crumbs[0].name).toBe("shop, docs");
  });

  it("shows the first folder without a path or for a path outside the workspace", () => {
    expect(paths(crumbsFor(one, "shop", null, repos))).toEqual(["folder:/w/shop"]);
    expect(paths(crumbsFor(one, "shop", "/elsewhere/a.ts", repos))).toEqual(["folder:/w/shop"]);
    expect(crumbsFor([], "", "/w/a.ts", repos)).toEqual([]);
  });
});

describe("popups", () => {
  const crumbs = crumbsFor(one, "shop", "/w/shop/src/cart.ts", repos);

  it("lists a folder's contents, and the file's folder for the file", () => {
    expect(listedIndex(crumbs, 1)).toBe(1);
    expect(listedIndex(crumbs, 2)).toBe(1);
  });

  it("selects the next crumb, or the file itself", () => {
    expect(selectedPathFor(crumbs, 0)).toBe("/w/shop/src");
    expect(selectedPathFor(crumbs, 1)).toBe("/w/shop/src/cart.ts");
    expect(selectedPathFor(crumbs, 2)).toBe("/w/shop/src/cart.ts");
    expect(selectedPathFor(crumbsFor(one, "shop", "/w/shop/src", repos, true), 1)).toBeNull();
  });

  it("opens on the file's folder", () => {
    expect(startIndex(crumbs)).toBe(1);
    expect(startIndex(crumbsFor(one, "shop", null, repos))).toBe(0);
  });

  it("goes left past the file's own folder, and stays on the first crumb", () => {
    expect(previousPopup(crumbs, 2)).toBe(0);
    expect(previousPopup(crumbs, 1)).toBe(0);
    expect(previousPopup(crumbs, 0)).toBe(0);
  });

  it("replaces the crumbs past the listed folder when going into an item", () => {
    const [nested] = itemsOf("/w/shop/src", [{ name: "lib", isDir: true, ignored: false, isRepo: false }]);
    expect(paths(enterItem(crumbs, 2, nested))).toEqual(["folder:/w/shop", "dir:/w/shop/src", "dir:/w/shop/src/lib"]);
    const [lib] = itemsOf("/w/shop", [{ name: "lib", isDir: true, ignored: false, isRepo: false }]);
    expect(paths(enterItem(crumbs, 0, lib))).toEqual(["folder:/w/shop", "dir:/w/shop/lib"]);
    const [readme] = itemsOf("/w/shop/lib", [{ name: "README.md", isDir: false, ignored: false, isRepo: false }]);
    expect(paths(enterItem(enterItem(crumbs, 0, lib), 1, readme))).toEqual([
      "folder:/w/shop",
      "dir:/w/shop/lib",
      "file:/w/shop/lib/README.md",
    ]);
  });

  it("goes into a workspace folder from the workspace crumb", () => {
    const multi = crumbsFor(two, "both", "/w/shop/a.ts", repos);
    const docs = folderItems(two, repos)[1];
    expect(docs).toMatchObject({ name: "docs", path: "/w/docs", isDir: true, isFolderRoot: true });
    expect(paths(enterItem(multi, 0, docs))).toEqual(["workspace:", "folder:/w/docs"]);
  });
});

describe("navRows", () => {
  const items = itemsOf("/w", [
    { name: "src", isDir: true, ignored: false, isRepo: false },
    { name: "scripts", isDir: true, ignored: false, isRepo: false },
    { name: "README.md", isDir: false, ignored: false, isRepo: false },
    { name: "server.ts", isDir: false, ignored: false, isRepo: false },
  ]);

  it("keeps every item in order without a query", () => {
    const rows = navRows(items, " ");
    expect(rows.map((row) => row.item.name)).toEqual(["src", "scripts", "README.md", "server.ts"]);
    expect(rows[0].nameParts).toEqual([{ text: "src", match: false }]);
  });

  it("keeps the names matching the letters in order, best first, and highlights them", () => {
    const rows = navRows(items, "sr");
    expect(rows.map((row) => row.item.name)).toEqual(["src", "scripts", "server.ts"]);
    expect(rows[0].nameParts).toEqual([
      { text: "sr", match: true },
      { text: "c", match: false },
    ]);
    expect(navRows(items, "zz")).toEqual([]);
  });

  it("finds the row of a path, or the first", () => {
    const rows = navRows(items, "");
    expect(rowIndexOf(rows, "/w/README.md")).toBe(2);
    expect(rowIndexOf(rows, "/w/gone")).toBe(0);
    expect(rowIndexOf(rows, null)).toBe(0);
  });
});
