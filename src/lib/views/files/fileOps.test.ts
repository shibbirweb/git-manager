import { describe, expect, it } from "vitest";
import { fileKeyOp, fileOpAccelerator, fileOpGroups, type FileKey, type FileOpTarget, movableTargets, targetFolder } from "./fileOps";

const file: FileOpTarget = { path: "/w/src/cart.ts", isDir: false, isFolderRoot: false, deleted: false };
const folder: FileOpTarget = { path: "/w/src", isDir: true, isFolderRoot: false, deleted: false };
const root: FileOpTarget = { path: "/w", isDir: true, isFolderRoot: true, deleted: false };
const gone: FileOpTarget = { path: "/w/old.ts", isDir: false, isFolderRoot: false, deleted: true };

function ops(groups: ReturnType<typeof fileOpGroups>): string[][] {
  return groups.map((group) => group.map((item) => `${item.op}${item.disabled ? " (off)" : ""}`));
}

describe("fileOpGroups", () => {
  it("offers everything for one file or folder", () => {
    const expected = [["newFile", "newFolder"], ["cut", "copy", "paste", "duplicate"], ["rename", "trash"]];
    expect(ops(fileOpGroups([file], true))).toEqual(expected);
    expect(ops(fileOpGroups([folder], true))).toEqual(expected);
  });

  it("greys out Paste while nothing was cut or copied", () => {
    expect(ops(fileOpGroups([file], false))[1]).toEqual(["cut", "copy", "paste (off)", "duplicate"]);
  });

  it("offers only New File, New Folder and Paste on a workspace folder", () => {
    expect(ops(fileOpGroups([root], true))).toEqual([["newFile", "newFolder"], ["paste"]]);
  });

  it("offers Cut, Copy, Paste, Move to Trash and Copy Paths for several rows", () => {
    expect(ops(fileOpGroups([file, folder], true))).toEqual([["cut", "copy", "paste"], ["trash"], ["copyPaths"]]);
    expect(ops(fileOpGroups([root, file], false))).toEqual([["cut", "copy", "paste (off)"], ["trash"], ["copyPaths"]]);
    expect(ops(fileOpGroups([root, { ...root, path: "/v" }], true))).toEqual([["paste"]]);
  });

  it("offers nothing for deleted rows or no rows", () => {
    expect(fileOpGroups([gone], true)).toEqual([]);
    expect(fileOpGroups([file, gone], true)).toEqual([]);
    expect(fileOpGroups([], true)).toEqual([]);
  });
});

describe("targets", () => {
  it("keeps workspace folders and deleted rows out of moves", () => {
    expect(movableTargets([root, file, gone, folder])).toEqual([file, folder]);
  });

  it("puts new files and pastes into a folder, or next to a file", () => {
    expect(targetFolder(folder, null)).toBe("/w/src");
    expect(targetFolder(root, null)).toBe("/w");
    expect(targetFolder(file, null)).toBe("/w/src");
    expect(targetFolder(null, "/w")).toBe("/w");
    expect(targetFolder(null, null)).toBeNull();
  });
});

describe("fileKeyOp", () => {
  const key = (value: string, modifiers: Partial<FileKey> = {}): FileKey => ({
    key: value,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  });

  it("maps the macOS keys", () => {
    expect(fileKeyOp(key("c", { metaKey: true }), "macos")).toBe("copy");
    expect(fileKeyOp(key("x", { metaKey: true }), "macos")).toBe("cut");
    expect(fileKeyOp(key("V", { metaKey: true }), "macos")).toBe("paste");
    expect(fileKeyOp(key("d", { metaKey: true }), "macos")).toBe("duplicate");
    expect(fileKeyOp(key("Backspace", { metaKey: true }), "macos")).toBe("trash");
    expect(fileKeyOp(key("Delete"), "macos")).toBe("trash");
    expect(fileKeyOp(key("F2"), "macos")).toBe("rename");
    expect(fileKeyOp(key("F6", { shiftKey: true }), "macos")).toBe("rename");
    expect(fileKeyOp(key("Escape"), "macos")).toBe("clearCut");
  });

  it("uses Ctrl in place of Cmd on Windows and Linux", () => {
    expect(fileKeyOp(key("c", { ctrlKey: true }), "windows")).toBe("copy");
    expect(fileKeyOp(key("c", { metaKey: true }), "windows")).toBeNull();
    expect(fileKeyOp(key("c", { ctrlKey: true }), "macos")).toBeNull();
    expect(fileKeyOp(key("Delete"), "linux")).toBe("trash");
  });

  it("leaves other keys and extra modifiers alone", () => {
    expect(fileKeyOp(key("c"), "macos")).toBeNull();
    expect(fileKeyOp(key("c", { metaKey: true, shiftKey: true }), "macos")).toBeNull();
    expect(fileKeyOp(key("d", { metaKey: true, altKey: true }), "macos")).toBeNull();
    expect(fileKeyOp(key("Backspace"), "macos")).toBeNull();
    expect(fileKeyOp(key("F2", { metaKey: true }), "macos")).toBeNull();
    expect(fileKeyOp(key("F6"), "macos")).toBeNull();
    expect(fileKeyOp(key("Enter"), "macos")).toBeNull();
  });

  it("shows the trash key per platform in the menu", () => {
    expect(fileOpAccelerator("trash", "macos")).toBe("Cmd+Backspace");
    expect(fileOpAccelerator("trash", "windows")).toBe("Delete");
    expect(fileOpAccelerator("newFile", "macos")).toBeNull();
  });
});
