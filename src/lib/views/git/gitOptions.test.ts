import { describe, expect, it } from "vitest";
import type { FileStatus, HeadInfo, RepoStatus } from "$lib/types";
import {
  addedFiles,
  cloneFolderName,
  defaultPushTarget,
  pullCommand,
  pushCommand,
  RESET_MODES,
  rollbackCandidates,
  rollbackPaths,
  splitRemoteRef,
  updatePlan,
  updateProgressText,
  validateFolderName,
  validateRemoteName,
  validateRemoteUrl,
  validateRevision,
} from "./gitOptions";

function head(overrides: Partial<HeadInfo> = {}): HeadInfo {
  return { branch: "main", shortId: "abc1234", unborn: false, upstream: "origin/main", ahead: 0, behind: 0, ...overrides };
}

function status(overrides: Partial<HeadInfo> = {}, opKind: RepoStatus["op"]["kind"] = "none"): RepoStatus {
  return { head: head(overrides), op: { kind: opKind, description: "", oursLabel: "", theirsLabel: "" }, bisect: null, files: [] };
}

function file(path: string, overrides: Partial<FileStatus> = {}): FileStatus {
  return { path, origPath: null, staged: null, unstaged: "modified", conflicted: false, ...overrides };
}

describe("push target", () => {
  it("splits remote refs with slashes in the remote name", () => {
    expect(splitRemoteRef("origin/feature/x", ["origin"])).toEqual({ remoteName: "origin", remoteBranch: "feature/x" });
    expect(splitRemoteRef("team/fork/main", ["team", "team/fork"])).toEqual({ remoteName: "team/fork", remoteBranch: "main" });
    expect(splitRemoteRef("gone/main", ["origin"])).toBeNull();
  });

  it("uses the upstream, else the same name on origin or the first remote", () => {
    expect(defaultPushTarget(head({ upstream: "fork/topic" }), ["origin", "fork"])).toEqual({ remoteName: "fork", remoteBranch: "topic" });
    expect(defaultPushTarget(head({ branch: "new", upstream: null }), ["upstream", "origin"])).toEqual({
      remoteName: "origin",
      remoteBranch: "new",
    });
    expect(defaultPushTarget(head({ branch: "new", upstream: null }), ["upstream"])).toEqual({ remoteName: "upstream", remoteBranch: "new" });
    expect(defaultPushTarget(head({ upstream: null }), [])).toBeNull();
    expect(defaultPushTarget(head({ branch: null }), ["origin"])).toBeNull();
  });

  it("previews the push command", () => {
    const base = { localBranch: "main", remoteName: "origin", remoteBranch: "main", forceWithLease: false, pushTags: false, setUpstream: false };
    expect(pushCommand(base)).toBe("git push origin main");
    expect(pushCommand({ ...base, remoteBranch: "release", forceWithLease: true, pushTags: true, setUpstream: true })).toBe(
      "git push --force-with-lease --tags -u origin main:release",
    );
  });
});

describe("pull command", () => {
  it("maps each mode to its flag", () => {
    expect(pullCommand({ remoteName: "origin", branchName: "main", mode: "merge", noCommit: false })).toBe("git pull --no-rebase origin main");
    expect(pullCommand({ remoteName: "origin", branchName: "main", mode: "merge", noCommit: true })).toBe(
      "git pull --no-rebase --no-commit origin main",
    );
    expect(pullCommand({ remoteName: "origin", branchName: null, mode: "rebase", noCommit: true })).toBe("git pull --rebase origin");
    expect(pullCommand({ remoteName: null, branchName: "main", mode: "ffOnly", noCommit: false })).toBe("git pull --ff-only");
  });
});

describe("reset", () => {
  it("offers JetBrains' four modes, Hard marked as dangerous", () => {
    expect(RESET_MODES.map((mode) => mode.value)).toEqual(["soft", "mixed", "hard", "keep"]);
    expect(RESET_MODES.filter((mode) => mode.danger).map((mode) => mode.value)).toEqual(["hard"]);
  });

  it("checks typed revisions", () => {
    expect(validateRevision("HEAD~2")).toBeNull();
    expect(validateRevision("origin/main")).toBeNull();
    expect(validateRevision("")).toBe("Enter a revision");
    expect(validateRevision("--hard")).toBe("Not a valid revision");
    expect(validateRevision("a b")).toBe("Not a valid revision");
  });
});

describe("remotes", () => {
  it("validates names", () => {
    expect(validateRemoteName("upstream", ["origin"])).toBeNull();
    expect(validateRemoteName("origin", ["origin"])).toBe("A remote with this name already exists");
    expect(validateRemoteName("origin", ["origin"], "origin")).toBeNull();
    for (const name of ["", "-x", ".hidden", "a b", "a..b", "a:b", "x.lock", "x/", "@"]) {
      expect(validateRemoteName(name, []), name).not.toBeNull();
    }
  });

  it("validates URLs", () => {
    expect(validateRemoteUrl("git@github.com:o/r.git")).toBeNull();
    expect(validateRemoteUrl("")).toBe("Enter a URL");
    expect(validateRemoteUrl("", true)).toBeNull();
    expect(validateRemoteUrl("--upload-pack=x")).toBe("Not a valid URL");
  });
});

describe("clone", () => {
  it("names the folder like git clone", () => {
    expect(cloneFolderName("https://github.com/octo/hello.git")).toBe("hello");
    expect(cloneFolderName("git@github.com:octo/hello.git")).toBe("hello");
    expect(cloneFolderName("https://github.com/octo/hello/")).toBe("hello");
    expect(cloneFolderName("/srv/repos/project/.git")).toBe("project");
    expect(cloneFolderName("/srv/repos/backup.bundle")).toBe("backup");
    expect(cloneFolderName("host:project")).toBe("project");
    expect(cloneFolderName("")).toBe("");
  });

  it("validates the folder name", () => {
    expect(validateFolderName("hello")).toBeNull();
    for (const name of ["", ".", "..", "a/b", "a\\b"]) {
      expect(validateFolderName(name), name).not.toBeNull();
    }
  });
});

describe("update project", () => {
  it("pulls repositories with an upstream and lists the others", () => {
    const repos = [
      { root: "/w/a", name: "a", relativePath: "a" },
      { root: "/w/b", name: "b", relativePath: "b" },
      { root: "/w/c", name: "c", relativePath: "c" },
      { root: "/w/d", name: "d", relativePath: "d" },
      { root: "/w/e", name: "e", relativePath: "e" },
    ];
    const plan = updatePlan(repos, {
      "/w/a": status(),
      "/w/b": status({ upstream: null }),
      "/w/c": status({ branch: null }),
      "/w/d": status({}, "rebase"),
    });
    expect(plan.steps.map((step) => step.name)).toEqual(["a"]);
    expect(plan.skipped).toEqual([
      { name: "b", reason: "no upstream" },
      { name: "c", reason: "detached HEAD" },
      { name: "d", reason: "an operation is in progress" },
      { name: "e", reason: "status not loaded" },
    ]);
  });

  it("counts the steps", () => {
    expect(updateProgressText(1, 5, "api")).toBe("Updating 2 of 5: api");
    expect(updateProgressText(0, 1, "api")).toBe("Updating api");
  });
});

describe("rollback", () => {
  const files = [
    file("modified.txt"),
    file("staged.txt", { staged: "modified", unstaged: null }),
    file("new.txt", { staged: "added", unstaged: null }),
    file("moved.txt", { staged: "renamed", unstaged: null, origPath: "old.txt" }),
    file("untracked.txt", { unstaged: "untracked" }),
    file("conflict.txt", { conflicted: true }),
  ];

  it("lists tracked changes only", () => {
    expect(rollbackCandidates(files).map((entry) => entry.path)).toEqual(["modified.txt", "staged.txt", "new.txt", "moved.txt"]);
  });

  it("sends both sides of a rename", () => {
    expect(rollbackPaths(rollbackCandidates(files))).toEqual(["modified.txt", "staged.txt", "new.txt", "moved.txt", "old.txt"]);
    expect(addedFiles(files).map((entry) => entry.path)).toEqual(["new.txt"]);
  });
});
