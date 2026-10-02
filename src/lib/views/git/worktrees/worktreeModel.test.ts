import { describe, expect, it } from "vitest";
import type { WorktreeInfo } from "$lib/types";
import {
  availableBranches,
  defaultWorktreePath,
  folderSafe,
  mainWorktreeRoot,
  sortedWorktrees,
  validateWorktreePath,
  worktreeLabel,
  worktreeTooltip,
} from "./worktreeModel";

function worktree(overrides: Partial<WorktreeInfo>): WorktreeInfo {
  return {
    path: "/code/app",
    head: "0123456789abcdef0123456789abcdef01234567",
    branch: "main",
    detached: false,
    bare: false,
    locked: false,
    lockReason: null,
    prunable: false,
    prunableReason: null,
    isMain: false,
    isCurrent: false,
    ...overrides,
  };
}

describe("worktreeModel", () => {
  it("labels branches, detached heads and bare entries", () => {
    expect(worktreeLabel(worktree({}))).toBe("main");
    expect(worktreeLabel(worktree({ branch: null, detached: true }))).toBe("detached at 01234567");
    expect(worktreeLabel(worktree({ branch: null, bare: true, head: null }))).toBe("bare");
    expect(worktreeTooltip(worktree({ isMain: true, isCurrent: true, locked: true, lockReason: "usb" }))).toBe(
      "/code/app, main, main worktree, open here, locked: usb",
    );
  });

  it("puts a new worktree next to the main one", () => {
    expect(defaultWorktreePath("/code/app", "feature/login")).toBe("/code/app-feature-login");
    expect(defaultWorktreePath("/code/app", "  ")).toBe("/code/app-worktree");
    expect(folderSafe("-a b:c-")).toBe("a-b-c");
    expect(folderSafe("..hidden")).toBe("hidden");
  });

  it("finds the main worktree", () => {
    const list = [worktree({ path: "/code/app-x", branch: "x" }), worktree({ isMain: true })];
    expect(mainWorktreeRoot(list, "/code/app-x")).toBe("/code/app");
    expect(mainWorktreeRoot([], "/r")).toBe("/r");
    expect(sortedWorktrees(list).map((entry) => entry.path)).toEqual(["/code/app", "/code/app-x"]);
  });

  it("validates the folder and offers branches not checked out elsewhere", () => {
    const list = [worktree({ isMain: true }), worktree({ path: "/code/app-x", branch: "x" })];
    expect(validateWorktreePath("", list)).toBe("Choose a folder for the worktree");
    expect(validateWorktreePath("relative/dir", list)).toBe("Use an absolute path");
    expect(validateWorktreePath("/code/app-x/", list)).toBe("A worktree already uses this folder");
    expect(validateWorktreePath("/code/app-y", list)).toBeNull();
    expect(availableBranches(["main", "x", "y"], list)).toEqual(["y"]);
  });
});
