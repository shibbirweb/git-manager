import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  extendSelection,
  retargetSelection,
  rowAfterRemoval,
  selectAll,
  selectedInOrder,
  selectOnly,
  selectRange,
  toggleSelected,
  topLevel,
} from "./selection";
import { isInside } from "$lib/stores/workspacePaths";

/** A seeded generator, so the random cases are the same on every run. */
function random(seed: number): (below: number) => number {
  let state = seed;
  return (below) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % below;
  };
}

/** Paths with the awkward shapes: shared name starts, a trailing slash, "/", "" and repeats. */
function randomPaths(next: (below: number) => number, count: number): string[] {
  const parts = ["a", "b", "ab", "a b", "a.b"];
  const odd = ["", "/", "/w/", "/w/a/", "/w//a"];
  return Array.from({ length: count }, () => {
    if (next(12) === 0) {
      return odd[next(odd.length)];
    }
    const depth = 1 + next(4);
    return `/w/${Array.from({ length: depth }, () => parts[next(parts.length)]).join("/")}`;
  });
}

// The first, quadratic versions: the new ones must give the same answers.
function topLevelReference(paths: string[]): string[] {
  return paths.filter((path) => !paths.some((other) => other !== path && isInside(other, path)));
}

function rowAfterRemovalReference(rows: string[], removed: string[]): string | null {
  const gone = (path: string) => removed.some((entry) => isInside(entry, path));
  let last = -1;
  rows.forEach((path, index) => {
    if (gone(path)) {
      last = index;
    }
  });
  if (last < 0) {
    return null;
  }
  for (let index = last + 1; index < rows.length; index++) {
    if (!gone(rows[index])) {
      return rows[index];
    }
  }
  for (let index = last - 1; index >= 0; index--) {
    if (!gone(rows[index])) {
      return rows[index];
    }
  }
  return null;
}

const order = ["/w/src", "/w/src/a.ts", "/w/src/b.ts", "/w/src/c.ts", "/w/README.md"];

function selected(selection: { paths: ReadonlySet<string> }): string[] {
  return selectedInOrder({ paths: selection.paths, anchor: null, focus: null }, order);
}

describe("clicks", () => {
  it("selects one row on a plain click", () => {
    const selection = selectOnly("/w/src/a.ts");
    expect(selected(selection)).toEqual(["/w/src/a.ts"]);
    expect(selection.anchor).toBe("/w/src/a.ts");
    expect(selectOnly(null)).toBe(EMPTY_SELECTION);
  });

  it("toggles rows with Cmd-click and moves the anchor there", () => {
    let selection = selectOnly("/w/src/a.ts");
    selection = toggleSelected(selection, "/w/src/c.ts");
    expect(selected(selection)).toEqual(["/w/src/a.ts", "/w/src/c.ts"]);
    expect(selection.anchor).toBe("/w/src/c.ts");
    selection = toggleSelected(selection, "/w/src/a.ts");
    expect(selected(selection)).toEqual(["/w/src/c.ts"]);
  });

  it("selects the range from the anchor with Shift-click, in either direction", () => {
    let selection = selectRange(selectOnly("/w/src/a.ts"), order, "/w/src/c.ts");
    expect(selected(selection)).toEqual(["/w/src/a.ts", "/w/src/b.ts", "/w/src/c.ts"]);
    selection = selectRange(selection, order, "/w/src");
    expect(selected(selection)).toEqual(["/w/src", "/w/src/a.ts"]);
    expect(selection.anchor).toBe("/w/src/a.ts");
    expect(selection.focus).toBe("/w/src");
  });

  it("starts a range from a Cmd-clicked row", () => {
    const selection = selectRange(toggleSelected(selectOnly("/w/src"), "/w/src/c.ts"), order, "/w/README.md");
    expect(selected(selection)).toEqual(["/w/src/c.ts", "/w/README.md"]);
  });

  it("selects only the clicked row when the anchor is gone", () => {
    expect(selected(selectRange(selectOnly("/w/gone.ts"), order, "/w/src/b.ts"))).toEqual(["/w/src/b.ts"]);
    const unchanged = selectOnly("/w/src/a.ts");
    expect(selectRange(unchanged, order, "/w/hidden.ts")).toBe(unchanged);
  });

  it("selects several new rows at once", () => {
    const selection = selectAll(["/w/src/a.ts", "/w/src/b.ts"]);
    expect(selected(selection)).toEqual(["/w/src/a.ts", "/w/src/b.ts"]);
    expect(selection.focus).toBe("/w/src/b.ts");
    expect(selectAll([])).toBe(EMPTY_SELECTION);
  });
});

describe("extendSelection", () => {
  it("grows and shrinks the range with Shift+Down and Shift+Up", () => {
    let selection = selectOnly("/w/src/b.ts");
    selection = extendSelection(selection, order, 1);
    selection = extendSelection(selection, order, 1);
    expect(selected(selection)).toEqual(["/w/src/b.ts", "/w/src/c.ts", "/w/README.md"]);
    selection = extendSelection(selection, order, 1);
    expect(selection.focus).toBe("/w/README.md");
    selection = extendSelection(selection, order, -1);
    selection = extendSelection(selection, order, -1);
    selection = extendSelection(selection, order, -1);
    expect(selected(selection)).toEqual(["/w/src/a.ts", "/w/src/b.ts"]);
  });

  it("starts at the first or last row when nothing has the focus", () => {
    expect(extendSelection(EMPTY_SELECTION, order, 1).focus).toBe("/w/src");
    expect(extendSelection(EMPTY_SELECTION, order, -1).focus).toBe("/w/README.md");
    expect(extendSelection(EMPTY_SELECTION, [], 1)).toBe(EMPTY_SELECTION);
  });
});

describe("topLevel", () => {
  it("drops paths inside another selected folder", () => {
    expect(topLevel(["/w/src", "/w/src/a.ts", "/w/srcx.ts", "/w/README.md"])).toEqual(["/w/src", "/w/srcx.ts", "/w/README.md"]);
  });

  it("gives the same answers as the first version on random paths", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const paths = randomPaths(random(seed), 1 + (seed % 30));
      expect(topLevel(paths), `seed ${seed}`).toEqual(topLevelReference(paths));
    }
  });

  it("handles thousands of paths quickly", () => {
    const paths = Array.from({ length: 5000 }, (_, index) => `/w/src/d${index % 20}/e${index % 25}/file${index}.ts`);
    const folders = paths.slice(0, 50).map((path) => path.slice(0, path.lastIndexOf("/")));
    const folderSet = new Set(folders);
    const expected = [...paths.filter((path) => !folderSet.has(path.slice(0, path.lastIndexOf("/")))), ...folders];
    const started = performance.now();
    expect(topLevel([...paths, ...folders])).toEqual(expected);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe("retargetSelection", () => {
  it("follows renamed and moved rows", () => {
    const selection = retargetSelection(selectRange(selectOnly("/w/src"), order, "/w/src/a.ts"), [{ from: "/w/src", to: "/w/lib" }]);
    expect([...selection.paths]).toEqual(["/w/lib", "/w/lib/a.ts"]);
    expect(selection.anchor).toBe("/w/lib");
    expect(selection.focus).toBe("/w/lib/a.ts");
    expect(retargetSelection(EMPTY_SELECTION, []).focus).toBeNull();
  });
});

describe("rowAfterRemoval", () => {
  it("picks the next row below, else above", () => {
    expect(rowAfterRemoval(order, ["/w/src/b.ts"])).toBe("/w/src/c.ts");
    expect(rowAfterRemoval(order, ["/w/README.md"])).toBe("/w/src/c.ts");
    expect(rowAfterRemoval(order, ["/w/src"])).toBe("/w/README.md");
    expect(rowAfterRemoval(order, ["/w/src", "/w/README.md"])).toBeNull();
    expect(rowAfterRemoval(order, ["/w/other.ts"])).toBeNull();
  });

  it("gives the same answers as the first version on random paths", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const next = random(seed);
      const rows = randomPaths(next, 1 + (seed % 30));
      const removed = randomPaths(next, seed % 6);
      expect(rowAfterRemoval(rows, removed), `seed ${seed}`).toBe(rowAfterRemovalReference(rows, removed));
    }
  });
});
