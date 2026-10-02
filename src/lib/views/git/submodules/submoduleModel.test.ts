import { describe, expect, it } from "vitest";
import type { FileStatus, RepoInfo } from "$lib/types";
import { defaultSubmodulePath, describeSubmoduleChange, findRepo, isSubmoduleEntry, validateSubmodulePath } from "./submoduleModel";

function file(overrides: Partial<FileStatus>): FileStatus {
  return { path: "lib", origPath: null, staged: null, unstaged: "modified", conflicted: false, ...overrides };
}

describe("submoduleModel", () => {
  it("describes a submodule change like git status", () => {
    expect(describeSubmoduleChange({ newCommits: true, modifiedContent: true, untrackedContent: false })).toBe(
      "new commits, modified content",
    );
    expect(describeSubmoduleChange({ newCommits: false, modifiedContent: false, untrackedContent: true })).toBe("untracked content");
    expect(describeSubmoduleChange(null)).toBe("");
    expect(describeSubmoduleChange(undefined)).toBe("");
  });

  it("tells submodule entries from files", () => {
    expect(isSubmoduleEntry(file({ submodule: { newCommits: true, modifiedContent: false, untrackedContent: false } }))).toBe(true);
    expect(isSubmoduleEntry(file({ submodule: null }))).toBe(false);
    expect(isSubmoduleEntry(file({}))).toBe(false);
  });

  it("checks the submodule path", () => {
    expect(defaultSubmodulePath("https://github.com/owner/lib.git")).toBe("lib");
    expect(validateSubmodulePath("", [])).toBe("Enter a path inside the repository");
    expect(validateSubmodulePath("/abs", [])).toBe("Use a path relative to the repository");
    expect(validateSubmodulePath("--force", [])).toBe("Use a path relative to the repository");
    expect(validateSubmodulePath("a/../b", [])).toBe("Not a valid path");
    expect(validateSubmodulePath("libs/x/", ["libs/x"])).toBe("A submodule already uses this path");
    expect(validateSubmodulePath("libs/y", ["libs/x"])).toBeNull();
  });

  it("finds an open repository by path", () => {
    const repos: RepoInfo[] = [{ root: "/w/app/lib", name: "lib", relativePath: "app/lib", submodule: true }];
    expect(findRepo(repos, "/w/app/lib/")?.name).toBe("lib");
    expect(findRepo(repos, "/w/app/other")).toBeNull();
  });
});
