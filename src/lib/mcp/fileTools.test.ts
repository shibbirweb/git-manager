import { describe, expect, it } from "vitest";
import type { PathMove } from "$lib/stores/workspacePaths";
import { ToolArgError } from "./args";
import { copyPaths, createFile, createFolder, type FileToolDeps, movePaths, renamePath, requiredPaths, trashPaths, unsavedProblem } from "./fileTools";
import { FILE_TOOL_MAX_PATHS } from "./toolDefs";

const ROOT = "/work/shop";
const OTHER = "/work/docs";

/** Fake app: records every call, and the backend answers like file_ops.rs would. */
function fakeDeps(options: { dirty?: string[]; folders?: string[] } = {}) {
  const calls: string[] = [];
  const written: string[][] = [];
  const retargeted: PathMove[][] = [];
  const closedUnder: string[][] = [];
  const followed: PathMove[][] = [];
  const forgotten: string[][] = [];
  const opened: string[] = [];
  const deps: FileToolDeps = {
    folders: () => (options.folders ?? [ROOT, OTHER]).map((root) => ({ root, name: root.slice(root.lastIndexOf("/") + 1) })),
    dirtyPaths: () => options.dirty ?? [],
    fileCreate: async (workspaceRoots, parentDir, name, isDir) => {
      calls.push(`create ${workspaceRoots.join(",")} ${parentDir} ${name} ${isDir}`);
      return `${parentDir}/${name}`;
    },
    fileRename: async (_workspaceRoots, entryPath, newName) => {
      calls.push(`rename ${entryPath} ${newName}`);
      return `${entryPath.slice(0, entryPath.lastIndexOf("/"))}/${newName}`;
    },
    fileCopy: async (_workspaceRoots, sourcePaths, targetDir) => {
      calls.push(`copy ${sourcePaths.join(",")} ${targetDir}`);
      return sourcePaths.map((sourcePath) => `${targetDir}/${sourcePath.slice(sourcePath.lastIndexOf("/") + 1)}`);
    },
    fileMove: async (_workspaceRoots, sourcePaths, targetDir) => {
      calls.push(`move ${sourcePaths.join(",")} ${targetDir}`);
      return sourcePaths.map((sourcePath) => ({ from: sourcePath, to: `${targetDir}/${sourcePath.slice(sourcePath.lastIndexOf("/") + 1)}` }));
    },
    fileTrash: async (_workspaceRoots, entryPaths) => {
      calls.push(`trash ${entryPaths.join(",")}`);
    },
    openFile: async (filePath) => {
      opened.push(filePath);
      return true;
    },
    retargetTabs: (moves) => retargeted.push(moves),
    closeTabsUnder: (entryPaths) => closedUnder.push(entryPaths),
    clipboardFollow: (moves) => followed.push(moves),
    clipboardForget: (removed) => forgotten.push(removed),
    filesWritten: async (changedPaths) => {
      written.push(changedPaths);
    },
  };
  return { deps, calls, written, retargeted, closedUnder, followed, forgotten, opened };
}

describe("path lists", () => {
  it("takes absolute paths without duplicates", () => {
    expect(requiredPaths({ paths: ["/a/b", "/a/b/", "/a/c"] }, "paths")).toEqual(["/a/b", "/a/c"]);
  });

  it("refuses anything else", () => {
    expect(() => requiredPaths({}, "paths")).toThrow('"paths" is required');
    expect(() => requiredPaths({ paths: "/a" }, "paths")).toThrow("must be a list of absolute paths");
    expect(() => requiredPaths({ paths: [] }, "paths")).toThrow("at least one path");
    expect(() => requiredPaths({ paths: [1] }, "paths")).toThrow("must be a list of absolute paths");
    expect(() => requiredPaths({ paths: ["a/b"] }, "paths")).toThrow("must be an absolute path");
    expect(() => requiredPaths({ paths: ["/a/../b"] }, "paths")).toThrow('"." or ".."');
    const tooMany = Array.from({ length: FILE_TOOL_MAX_PATHS + 1 }, (_, index) => `/a/${index}`);
    expect(() => requiredPaths({ paths: tooMany }, "paths")).toThrow(`at most ${FILE_TOOL_MAX_PATHS}`);
  });
});

describe("unsaved edits", () => {
  it("names the files with unsaved edits in or under the entries", () => {
    expect(unsavedProblem([], [`${ROOT}/src`])).toBeNull();
    expect(unsavedProblem([`${ROOT}/lib/a.ts`], [`${ROOT}/src`])).toBeNull();
    expect(unsavedProblem([`${ROOT}/src/cart.ts`], [`${ROOT}/src`])).toBe(
      "Save or revert cart.ts first; it has unsaved changes (save_file saves it)",
    );
    expect(unsavedProblem([`${ROOT}/src/a.ts`, `${ROOT}/src/b.ts`], [`${ROOT}/src`])).toBe(
      "Save or revert 2 files first; they have unsaved changes: a.ts, b.ts",
    );
  });
});

describe("create_file and create_folder", () => {
  it("creates relative to the workspace folder, refreshes and opens the file", async () => {
    const fake = fakeDeps();
    const result = await createFile(fake.deps, { filePath: `${ROOT}/src/lib/money.ts` });
    expect(result).toEqual({ filePath: `${ROOT}/src/lib/money.ts`, opened: true });
    expect(fake.calls).toEqual([`create ${ROOT},${OTHER} ${ROOT} src/lib/money.ts false`]);
    expect(fake.written).toEqual([[`${ROOT}/src/lib/money.ts`]]);
    expect(fake.opened).toEqual([`${ROOT}/src/lib/money.ts`]);
  });

  it("leaves the file closed with open false", async () => {
    const fake = fakeDeps();
    expect(await createFile(fake.deps, { filePath: `${OTHER}/a.md`, open: false })).toEqual({ filePath: `${OTHER}/a.md`, opened: false });
    expect(fake.opened).toEqual([]);
  });

  it("creates folders", async () => {
    const fake = fakeDeps();
    expect(await createFolder(fake.deps, { folderPath: `${ROOT}/a/b` })).toEqual({ folderPath: `${ROOT}/a/b` });
    expect(fake.calls).toEqual([`create ${ROOT},${OTHER} ${ROOT} a/b true`]);
  });

  it("refuses paths outside the workspace, the folders themselves and no workspace", async () => {
    const fake = fakeDeps();
    await expect(createFile(fake.deps, { filePath: "/etc/x" })).rejects.toThrow("Not inside an open workspace folder: /etc/x");
    await expect(createFolder(fake.deps, { folderPath: ROOT })).rejects.toThrow("is a workspace folder");
    await expect(createFile(fakeDeps({ folders: [] }).deps, { filePath: `${ROOT}/x` })).rejects.toThrow("No folder is open");
    await expect(createFile(fake.deps, { filePath: "relative.ts" })).rejects.toThrow(ToolArgError);
    expect(fake.calls).toEqual([]);
  });
});

describe("rename_path", () => {
  it("renames, re-points tabs and the clipboard, and refreshes", async () => {
    const fake = fakeDeps();
    const result = await renamePath(fake.deps, { entryPath: `${ROOT}/src/cart.ts`, newName: "basket.ts" });
    const move = { from: `${ROOT}/src/cart.ts`, to: `${ROOT}/src/basket.ts` };
    expect(result).toEqual(move);
    expect(fake.retargeted).toEqual([[move]]);
    expect(fake.followed).toEqual([[move]]);
    expect(fake.written).toEqual([[move.from, move.to]]);
  });

  it("does nothing for the same name", async () => {
    const fake = fakeDeps();
    expect(await renamePath(fake.deps, { entryPath: `${ROOT}/a.ts`, newName: "a.ts" })).toEqual({ from: `${ROOT}/a.ts`, to: `${ROOT}/a.ts` });
    expect(fake.calls).toEqual([]);
  });

  it("refuses unsaved edits, workspace folders and outside paths", async () => {
    const dirty = fakeDeps({ dirty: [`${ROOT}/src/cart.ts`] });
    await expect(renamePath(dirty.deps, { entryPath: `${ROOT}/src`, newName: "source" })).rejects.toThrow("Save or revert cart.ts first");
    expect(dirty.calls).toEqual([]);
    const fake = fakeDeps();
    await expect(renamePath(fake.deps, { entryPath: ROOT, newName: "x" })).rejects.toThrow("shop is a workspace folder and cannot be renamed");
    await expect(renamePath(fake.deps, { entryPath: "/tmp/a", newName: "b" })).rejects.toThrow("Not inside an open workspace folder");
    await expect(renamePath(fake.deps, { entryPath: `${ROOT}/a` })).rejects.toThrow('"newName" is required');
  });

  it("counts the bytes of a name, as the file system does", async () => {
    const fake = fakeDeps();
    // 128 characters, 256 bytes: short enough by characters, too long on disk.
    await expect(renamePath(fake.deps, { entryPath: `${ROOT}/a.ts`, newName: "é".repeat(128) })).rejects.toThrow("at most 255 bytes");
    expect(fake.calls).toEqual([]);
    await renamePath(fake.deps, { entryPath: `${ROOT}/a.ts`, newName: "é".repeat(127) });
    expect(fake.calls).toHaveLength(1);
  });
});

describe("copy_paths", () => {
  it("copies the top-level sources and refreshes", async () => {
    const fake = fakeDeps();
    const result = await copyPaths(fake.deps, { paths: [`${ROOT}/src`, `${ROOT}/src/a.ts`, `${OTHER}/b.md`], targetFolder: `${ROOT}/lib` });
    expect(result).toEqual({ created: [`${ROOT}/lib/src`, `${ROOT}/lib/b.md`] });
    expect(fake.calls).toEqual([`copy ${ROOT}/src,${OTHER}/b.md ${ROOT}/lib`]);
    expect(fake.written).toEqual([[`${ROOT}/lib/src`, `${ROOT}/lib/b.md`]]);
    expect(fake.retargeted).toEqual([]);
  });

  it("copies even with unsaved edits, since the original stays", async () => {
    const fake = fakeDeps({ dirty: [`${ROOT}/a.ts`] });
    expect(await copyPaths(fake.deps, { paths: [`${ROOT}/a.ts`], targetFolder: ROOT })).toEqual({ created: [`${ROOT}/a.ts`] });
  });

  it("refuses a folder into itself and outside paths", async () => {
    const fake = fakeDeps();
    await expect(copyPaths(fake.deps, { paths: [`${ROOT}/src`], targetFolder: `${ROOT}/src/lib` })).rejects.toThrow("cannot be copied into itself");
    await expect(copyPaths(fake.deps, { paths: ["/tmp/a"], targetFolder: ROOT })).rejects.toThrow("Not inside an open workspace folder: /tmp/a");
    await expect(copyPaths(fake.deps, { paths: [`${ROOT}/a`], targetFolder: "/tmp" })).rejects.toThrow("Not inside an open workspace folder: /tmp");
    expect(fake.calls).toEqual([]);
  });
});

describe("move_paths", () => {
  it("moves, re-points tabs and the clipboard, and refreshes", async () => {
    const fake = fakeDeps();
    const result = await movePaths(fake.deps, { paths: [`${ROOT}/a.ts`, `${ROOT}/b.ts`], targetFolder: `${ROOT}/lib` });
    const moved = [
      { from: `${ROOT}/a.ts`, to: `${ROOT}/lib/a.ts` },
      { from: `${ROOT}/b.ts`, to: `${ROOT}/lib/b.ts` },
    ];
    expect(result).toEqual({ moved });
    expect(fake.retargeted).toEqual([moved]);
    expect(fake.followed).toEqual([moved]);
    expect(fake.written).toEqual([[`${ROOT}/a.ts`, `${ROOT}/lib/a.ts`, `${ROOT}/b.ts`, `${ROOT}/lib/b.ts`]]);
  });

  it("skips a move into the folder the entries are in", async () => {
    const fake = fakeDeps();
    expect(await movePaths(fake.deps, { paths: [`${ROOT}/a.ts`], targetFolder: ROOT })).toEqual({
      moved: [],
      note: "Everything is in that folder already",
    });
    expect(fake.calls).toEqual([]);
  });

  it("refuses unsaved edits, workspace folders and a folder into itself", async () => {
    const dirty = fakeDeps({ dirty: [`${ROOT}/src/a.ts`, `${ROOT}/src/b.ts`] });
    await expect(movePaths(dirty.deps, { paths: [`${ROOT}/src`], targetFolder: `${ROOT}/lib` })).rejects.toThrow("Save or revert 2 files first");
    const fake = fakeDeps();
    await expect(movePaths(fake.deps, { paths: [OTHER], targetFolder: ROOT })).rejects.toThrow("docs is a workspace folder and cannot be moved");
    await expect(movePaths(fake.deps, { paths: [`${ROOT}/src`], targetFolder: `${ROOT}/src/x` })).rejects.toThrow("cannot move into itself");
    expect([...dirty.calls, ...fake.calls]).toEqual([]);
  });
});

describe("trash_paths", () => {
  it("trashes the top-level entries, closes their tabs and forgets them in the clipboard", async () => {
    const fake = fakeDeps();
    const result = await trashPaths(fake.deps, { paths: [`${ROOT}/src`, `${ROOT}/src/a.ts`, `${OTHER}/b.md`] });
    const trashed = [`${ROOT}/src`, `${OTHER}/b.md`];
    expect(result).toEqual({ trashed });
    expect(fake.calls).toEqual([`trash ${trashed.join(",")}`]);
    expect(fake.closedUnder).toEqual([trashed]);
    expect(fake.forgotten).toEqual([trashed]);
    expect(fake.written).toEqual([trashed]);
  });

  it("refuses unsaved edits, workspace folders and outside paths", async () => {
    const dirty = fakeDeps({ dirty: [`${ROOT}/src/cart.ts`] });
    await expect(trashPaths(dirty.deps, { paths: [`${ROOT}/src`] })).rejects.toThrow("Save or revert cart.ts first");
    const fake = fakeDeps();
    await expect(trashPaths(fake.deps, { paths: [ROOT] })).rejects.toThrow("shop is a workspace folder and cannot be moved to the Trash");
    await expect(trashPaths(fake.deps, { paths: ["/Users/me/.ssh"] })).rejects.toThrow("Not inside an open workspace folder");
    expect([...dirty.calls, ...fake.calls]).toEqual([]);
    expect(fake.closedUnder).toEqual([]);
  });
});
