import { describe, expect, it } from "vitest";
import { MAX_RACE, taskSlug, taskWorktrees } from "./taskModel";

describe("taskSlug", () => {
  it.each([
    ["Fix the login race!", "fix-the-login-race"],
    ["  Café  menu: résumé  ", "cafe-menu-resume"],
    ["feature/Dark mode", "feature/dark-mode"],
    ["--weird..name//", "weird-name"],
    ["😀", ""],
  ])("%j is %j", (taskName, slug) => {
    expect(taskSlug(taskName)).toBe(slug);
  });

  it("keeps branch names short", () => {
    expect(taskSlug("a ".repeat(100)).length).toBeLessThanOrEqual(60);
  });
});

describe("taskWorktrees", () => {
  it("names a race's worktrees after the task and skips taken names", () => {
    const worktrees = taskWorktrees(
      "/work/app",
      "fix-login",
      3,
      new Set(["fix-login-2"]),
      new Set(["/work/app-fix-login-3"]),
    );
    expect(worktrees).toEqual([
      { branchName: "fix-login", folderPath: "/work/app-fix-login" },
      { branchName: "fix-login-4", folderPath: "/work/app-fix-login-4" },
      { branchName: "fix-login-5", folderPath: "/work/app-fix-login-5" },
    ]);
  });

  it("makes none for zero, and up to the race limit it is asked for", () => {
    expect(taskWorktrees("/work/app", "x", 0, new Set(), new Set())).toEqual([]);
    expect(taskWorktrees("/work/app", "x", MAX_RACE, new Set(), new Set())).toHaveLength(MAX_RACE);
  });
});
