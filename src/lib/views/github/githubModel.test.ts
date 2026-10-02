import { describe, expect, it } from "vitest";
import type { GitHubAccount } from "$lib/types";
import {
  accountInitials,
  defaultShareRemoteName,
  forkCompareUrl,
  gistFileName,
  missingScopesHint,
  suggestRepositoryName,
  syncForkBranch,
  syncForkTitle,
  validateGistFileName,
  validateRepositoryName,
  validateShareRemoteName,
} from "./githubModel";

describe("validateRepositoryName", () => {
  it("accepts GitHub's characters", () => {
    expect(validateRepositoryName("hello-world")).toBeNull();
    expect(validateRepositoryName(" my_repo.v2 ")).toBeNull();
    expect(validateRepositoryName("a".repeat(100))).toBeNull();
  });

  it("explains what is wrong", () => {
    expect(validateRepositoryName("")).toBe("Enter a repository name");
    expect(validateRepositoryName("   ")).toBe("Enter a repository name");
    expect(validateRepositoryName("a".repeat(101))).toMatch(/100 characters/);
    expect(validateRepositoryName(".")).toMatch(/reserved/);
    expect(validateRepositoryName("..")).toMatch(/reserved/);
    expect(validateRepositoryName("repo.git")).toMatch(/\.git/);
    expect(validateRepositoryName("has space")).toMatch(/letters, digits/);
    expect(validateRepositoryName("a/b")).toMatch(/letters, digits/);
    expect(validateRepositoryName("café")).toMatch(/letters, digits/);
  });
});

describe("suggestRepositoryName", () => {
  it("turns a folder name into a valid repository name", () => {
    expect(suggestRepositoryName("git-merger")).toBe("git-merger");
    expect(suggestRepositoryName("My Project (copy)")).toBe("My-Project-copy");
    expect(suggestRepositoryName("thing.git")).toBe("thing");
    expect(suggestRepositoryName("..")).toBe("");
    expect(validateRepositoryName(suggestRepositoryName("Ünïcode Folder"))).toBeNull();
  });
});

describe("remote names", () => {
  it("defaults to origin, then github", () => {
    expect(defaultShareRemoteName([])).toBe("origin");
    expect(defaultShareRemoteName(["upstream"])).toBe("origin");
    expect(defaultShareRemoteName(["origin"])).toBe("github");
    expect(defaultShareRemoteName(["origin", "github", "github-2"])).toBe("github-3");
  });

  it("refuses taken or invalid names", () => {
    expect(validateShareRemoteName("github", ["origin"])).toBeNull();
    expect(validateShareRemoteName("origin", ["origin"])).toMatch(/already exists/);
    expect(validateShareRemoteName("", [])).toMatch(/Enter/);
    expect(validateShareRemoteName("-x", [])).toMatch(/valid/);
    expect(validateShareRemoteName("a b", [])).toMatch(/valid/);
  });
});

describe("gists", () => {
  it("names the gist after the file", () => {
    expect(gistFileName("/Users/me/repo/src/main.rs")).toBe("main.rs");
    expect(gistFileName("notes.md")).toBe("notes.md");
    expect(gistFileName(null)).toBe("");
  });

  it("validates the file name", () => {
    expect(validateGistFileName("main.rs")).toBeNull();
    expect(validateGistFileName(" ")).toMatch(/Enter/);
    expect(validateGistFileName("src/main.rs")).toMatch(/slashes/);
  });
});

describe("sync fork", () => {
  it("syncs the current branch when it tracks the fork, else the default branch", () => {
    expect(syncForkBranch({ branch: "feature", upstream: "origin/feature" }, "origin", "main")).toBe("feature");
    expect(syncForkBranch({ branch: "feature", upstream: "upstream/feature" }, "origin", "main")).toBe("main");
    expect(syncForkBranch({ branch: "feature", upstream: null }, "origin", null)).toBe("feature");
    expect(syncForkBranch(null, "origin", null)).toBeNull();
  });

  it("titles each outcome", () => {
    expect(syncForkTitle({ kind: "fastForward", message: "", baseBranch: null })).toMatch(/fast-forward/);
    expect(syncForkTitle({ kind: "upToDate", message: "", baseBranch: null })).toMatch(/up to date/);
    expect(syncForkTitle({ kind: "conflict", message: "", baseBranch: null })).toMatch(/conflicts/);
  });

  it("links a pull request from the upstream branch into the fork", () => {
    expect(forkCompareUrl({ owner: "me", repo: "fork" }, { owner: "octo", repo: "original" }, "main")).toBe(
      "https://github.com/me/fork/compare/main...octo:original:main?expand=1",
    );
    expect(forkCompareUrl({ owner: "me", repo: "fork" }, { owner: "octo", repo: "original" }, "feat/a b", "trunk")).toBe(
      "https://github.com/me/fork/compare/feat/a%20b...octo:original:trunk?expand=1",
    );
  });
});

describe("account labels", () => {
  const account: GitHubAccount = {
    host: "github.com",
    login: "octocat",
    name: "The Octocat",
    source: "token",
    missingScopes: [],
  };

  it("makes initials from the name, else the login", () => {
    expect(accountInitials(account)).toBe("TO");
    expect(accountInitials({ ...account, name: null })).toBe("OC");
    expect(accountInitials({ ...account, name: "Mona" })).toBe("MO");
    expect(accountInitials(null)).toBe("");
  });

  it("warns about missing scopes", () => {
    expect(missingScopesHint(account)).toBeNull();
    expect(missingScopesHint({ ...account, missingScopes: ["gist"] })).toMatch(/gist scope:/);
    expect(missingScopesHint({ ...account, missingScopes: ["repo", "gist"] })).toMatch(/repo and gist scopes/);
  });
});
