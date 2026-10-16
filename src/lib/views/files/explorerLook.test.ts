import { describe, expect, it } from "vitest";
import { rowDecoration, type RowLook } from "./explorerLook";
import type { TreeEntry } from "./folderListings";
import type { FileMark, FileTone } from "./tones";

function entry(path: string, extra: Partial<TreeEntry> = {}): TreeEntry {
  return {
    name: path.slice(path.lastIndexOf("/") + 1),
    path,
    isDir: false,
    ignored: false,
    isRepo: false,
    deleted: false,
    isFolderRoot: false,
    ...extra,
  };
}

function look(tones: Record<string, FileTone>, marks: Record<string, FileMark> = {}): RowLook {
  return {
    changes: { tone: (path) => tones[path], mark: (path) => marks[path] },
    cutPaths: new Set(["/w/cut.ts"]),
    lfsPaths: new Set(["/w/big.bin"]),
    openPath: "/w/open.ts",
  };
}

describe("rowDecoration", () => {
  it("leaves an unchanged file plain, with its path as the tooltip", () => {
    const decoration = rowDecoration(entry("/w/a.ts"), look({}));
    expect(decoration).toMatchObject({ tone: undefined, badge: undefined, dot: false, title: "/w/a.ts" });
  });

  it("colors a changed file and shows its status letter", () => {
    const mark: FileMark = { tone: "modified", letter: "M", title: "Modified" };
    const decoration = rowDecoration(entry("/w/a.ts"), look({ "/w/a.ts": "modified" }, { "/w/a.ts": mark }));
    expect(decoration).toMatchObject({ tone: "accent", badge: "M", badgeTitle: "Modified", dot: false });
  });

  it("puts a dot on a folder holding changes, and none on a clean one", () => {
    const changed = rowDecoration(entry("/w/src", { isDir: true }), look({ "/w/src": "conflict" }));
    expect(changed).toMatchObject({ tone: "danger", dot: true, badgeTitle: "Contains changes" });
    expect(rowDecoration(entry("/w/docs", { isDir: true }), look({})).dot).toBe(false);
  });

  it("strikes a deleted file through and does not tone an ignored one", () => {
    expect(rowDecoration(entry("/w/gone.ts", { deleted: true }), look({}))).toMatchObject({
      tone: "danger",
      strike: true,
    });
    const ignored = rowDecoration(entry("/w/log.txt", { ignored: true }), look({ "/w/log.txt": "added" }));
    expect(ignored).toMatchObject({ tone: undefined, ignored: true });
  });

  it("marks cut, LFS and the file open in the editor", () => {
    expect(rowDecoration(entry("/w/cut.ts"), look({})).cut).toBe(true);
    expect(rowDecoration(entry("/w/big.bin"), look({})).tag).toBe("LFS");
    expect(rowDecoration(entry("/w/open.ts"), look({})).open).toBe(true);
  });
});
