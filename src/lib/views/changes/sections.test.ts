import { describe, expect, it } from "vitest";
import type { FileStatus, HeadInfo, RepoInfo, RepoStatus } from "$lib/types";
import type { FileSelection } from "./fileStatus";
import {
  branchLabel,
  buildSections,
  commitChoices,
  displayPath,
  findFile,
  groupFiles,
  opLabel,
  resolveCommitTarget,
  resolveSelection,
  selectableRows,
  showRelativePath,
  splitSections,
} from "./sections";

const repo = (root: string, relativePath = ""): RepoInfo => ({
  root,
  name: root.split("/").pop() ?? root,
  relativePath,
});

const head = (overrides: Partial<HeadInfo> = {}): HeadInfo => ({
  branch: "main",
  shortId: "abc1234",
  unborn: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  ...overrides,
});

const file = (path: string, overrides: Partial<FileStatus> = {}): FileStatus => ({
  path,
  origPath: null,
  staged: null,
  unstaged: "modified",
  conflicted: false,
  ...overrides,
});

const status = (files: FileStatus[]): RepoStatus => ({
  head: head(),
  op: { kind: "none", description: "", oursLabel: "", theirsLabel: "" },
  files,
});

const row = (repoRoot: string, path: string, area: FileSelection["area"] = "unstaged"): FileSelection => ({
  repoRoot,
  path,
  area,
});

const web = repo("/work/apps/web", "apps/web");
const api = repo("/work/apps/api", "apps/api");
const docs = repo("/work/docs", "docs");

describe("groupFiles", () => {
  it("splits conflicts, staged and unstaged, listing a partly staged file twice", () => {
    const groups = groupFiles(
      status([
        file("a.ts", { staged: "modified", unstaged: "modified" }),
        file("b.ts", { staged: "added", unstaged: null }),
        file("c.ts", { conflicted: true, unstaged: null }),
        file("d.ts"),
      ]),
    );
    expect(groups.conflicts.map((entry) => entry.path)).toEqual(["c.ts"]);
    expect(groups.staged.map((entry) => entry.path)).toEqual(["a.ts", "b.ts"]);
    expect(groups.unstaged.map((entry) => entry.path)).toEqual(["a.ts", "d.ts"]);
  });

  it("reuses the result for the same status object", () => {
    const repoStatus = status([file("a.ts")]);
    expect(groupFiles(repoStatus)).toBe(groupFiles(repoStatus));
    expect(groupFiles(null).staged).toEqual([]);
  });
});

describe("buildSections", () => {
  it("keeps repository order, tolerates missing statuses and reuses unchanged sections", () => {
    const webStatus = status([file("a.ts")]);
    const first = buildSections([web, api], { [web.root]: webStatus });
    expect(first.map((section) => section.repo.root)).toEqual([web.root, api.root]);
    expect(first[1].status).toBeNull();
    expect(first[1].changeCount).toBe(0);

    const second = buildSections([web, api], { [web.root]: webStatus, [api.root]: status([]) });
    expect(second[0]).toBe(first[0]);
  });

  it("separates repositories with changes from clean or loading ones", () => {
    const sections = buildSections([web, api, docs], {
      [web.root]: status([file("a.ts")]),
      [api.root]: status([]),
    });
    const { changed, clean } = splitSections(sections);
    expect(changed.map((section) => section.repo.name)).toEqual(["web"]);
    expect(clean.map((section) => section.repo.name)).toEqual(["api", "docs"]);
  });
});

describe("rows and selection", () => {
  const sections = buildSections([web, api], {
    [web.root]: status([file("a.ts", { staged: "modified", unstaged: null }), file("b.ts"), file("c.ts")]),
    [api.root]: status([file("x.ts"), file("y.ts")]),
  });

  it("lists staged then unstaged rows per repository and skips hidden groups", () => {
    expect(selectableRows(sections)).toEqual([
      row(web.root, "a.ts", "staged"),
      row(web.root, "b.ts"),
      row(web.root, "c.ts"),
      row(api.root, "x.ts"),
      row(api.root, "y.ts"),
    ]);
    const hidden = (repoRoot: string, group: string) => repoRoot === web.root && group === "unstaged";
    expect(selectableRows(sections, hidden).map((entry) => entry.path)).toEqual(["a.ts", "x.ts", "y.ts"]);
  });

  it("finds files by repository, so equal paths in two repositories stay apart", () => {
    expect(findFile(sections, row(api.root, "x.ts"))?.path).toBe("x.ts");
    expect(findFile(sections, row(web.root, "x.ts"))).toBeNull();
    expect(findFile(sections, row("/elsewhere", "x.ts"))).toBeNull();
  });

  it("keeps a valid selection and follows a file into the other area", () => {
    const rows = selectableRows(sections);
    expect(resolveSelection(row(web.root, "b.ts"), sections, rows, 1)).toEqual(row(web.root, "b.ts"));
    expect(resolveSelection(row(web.root, "a.ts"), sections, rows, 0)).toEqual(row(web.root, "a.ts", "staged"));
  });

  it("falls back to the nearest row of the same repository", () => {
    const rows = selectableRows(sections);
    // The last web row vanished; index 3 is the first api row, but web still has rows.
    expect(resolveSelection(row(web.root, "gone.ts"), sections, rows, 3)).toEqual(row(web.root, "c.ts"));
    // A repository with no rows left falls back by index.
    expect(resolveSelection(row("/work/other", "gone.ts"), sections, rows, 3)).toEqual(row(api.root, "x.ts"));
    expect(resolveSelection(null, sections, rows, 99)).toEqual(row(api.root, "y.ts"));
    expect(resolveSelection(row(web.root, "b.ts"), [], [], 0)).toBeNull();
  });
});

describe("labels", () => {
  it("names the branch or the detached commit", () => {
    expect(branchLabel(head())).toBe("main");
    expect(branchLabel(head({ branch: null }))).toBe("detached at abc1234");
    expect(branchLabel(head({ branch: null, shortId: null }))).toBe("detached");
    expect(branchLabel(null)).toBe("");
  });

  it("labels operations in progress", () => {
    expect(opLabel("merge")).toBe("Merging");
    expect(opLabel("rebase")).toBe("Rebasing");
    expect(opLabel("none")).toBeNull();
    expect(opLabel(undefined)).toBeNull();
  });

  it("shows the relative path only when it adds information", () => {
    expect(showRelativePath(web)).toBe(true);
    expect(showRelativePath(repo("/work", ""))).toBe(false);
    expect(showRelativePath(repo("/work/web", "web"))).toBe(false);
  });

  it("prefixes diff paths with the repository only when several are open", () => {
    expect(displayPath(web, "src/a.ts", true)).toBe("apps/web/src/a.ts");
    expect(displayPath(repo("/work", ""), "src/a.ts", true)).toBe("work/src/a.ts");
    expect(displayPath(web, "src/a.ts", false)).toBe("src/a.ts");
    expect(displayPath(null, "src/a.ts", true)).toBe("src/a.ts");
  });
});

describe("commit target", () => {
  it("prefers the chosen repository, then the active one, then the first", () => {
    expect(resolveCommitTarget([web, api], api.root, web.root)).toBe(api);
    expect(resolveCommitTarget([web, api], "/gone", api.root)).toBe(api);
    expect(resolveCommitTarget([web, api], null, null)).toBe(web);
    expect(resolveCommitTarget([], web.root, web.root)).toBeNull();
  });

  it("offers repositories with changes plus the current target", () => {
    const sections = buildSections([web, api, docs], {
      [web.root]: status([file("a.ts")]),
      [api.root]: status([]),
      [docs.root]: status([]),
    });
    expect(commitChoices(sections, docs.root).map((section) => section.repo.name)).toEqual(["web", "docs"]);
    expect(commitChoices(sections, null).map((section) => section.repo.name)).toEqual(["web"]);
  });
});
