import { describe, expect, it } from "vitest";
import type { RepoChangedEvent, WorkspaceChangedEvent } from "$lib/types";
import { repoRefresh, treeChanged, workspaceRefresh, writeFallback } from "./refreshPlan";

function repoEvent(change: Partial<RepoChangedEvent>): RepoChangedEvent {
  return {
    repoPath: "/w",
    refs: false,
    config: false,
    index: false,
    opState: false,
    workTree: false,
    structure: false,
    attributes: false,
    ...change,
  };
}

function workspaceEvent(change: Partial<WorkspaceChangedEvent>): WorkspaceChangedEvent {
  return {
    workspaceRoot: "/w",
    reposChanged: false,
    structure: false,
    outsideRepos: false,
    ...change,
  };
}

describe("repoRefresh", () => {
  it("reads the branches only for refs and config changes", () => {
    for (const change of [{ index: true }, { workTree: true }, { workTree: true, structure: true }, { opState: true }]) {
      expect(repoRefresh(repoEvent(change))).toEqual({ status: true, refs: false });
    }
    expect(repoRefresh(repoEvent({ refs: true }))).toEqual({ status: true, refs: true });
    expect(repoRefresh(repoEvent({ config: true, index: true }))).toEqual({ status: true, refs: true });
  });
});

describe("treeChanged", () => {
  it("is set by HEAD, index, entry and attributes changes, not by content edits", () => {
    expect(treeChanged(repoEvent({ workTree: true }))).toBe(false);
    expect(treeChanged(repoEvent({ config: true, opState: true }))).toBe(false);
    for (const change of [{ refs: true }, { index: true }, { workTree: true, structure: true }, { workTree: true, attributes: true }]) {
      expect(treeChanged(repoEvent(change))).toBe(true);
    }
  });
});

describe("workspaceRefresh", () => {
  it("re-lists the Files panel only when entries come and go", () => {
    expect(workspaceRefresh(workspaceEvent({ outsideRepos: true }))).toEqual({
      listing: false,
      looseFiles: true,
      rescan: false,
    });
    expect(workspaceRefresh(workspaceEvent({ structure: true }))).toEqual({
      listing: true,
      looseFiles: true,
      rescan: false,
    });
    expect(workspaceRefresh(workspaceEvent({ reposChanged: true }))).toEqual({
      listing: true,
      looseFiles: true,
      rescan: true,
    });
  });
});

describe("writeFallback", () => {
  const reads: Record<string, number> = { "/a": 5, "/b": 12 };
  const readAt = (repoRoot: string) => reads[repoRoot] ?? 0;

  it("does nothing once the watcher reported the write and the status was read since", () => {
    expect(writeFallback(10, ["/b"], readAt, 11)).toEqual({ statusOf: [], files: false });
  });

  it("reads the status of repositories not read since the write", () => {
    expect(writeFallback(10, ["/a", "/b", "/c"], readAt, 11)).toEqual({ statusOf: ["/a", "/c"], files: false });
  });

  it("refreshes the file views when no watcher event came at all", () => {
    expect(writeFallback(10, [], readAt, 9)).toEqual({ statusOf: [], files: true });
  });
});
