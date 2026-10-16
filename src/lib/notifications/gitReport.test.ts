import { describe, expect, it } from "vitest";
import type { HeadInfo } from "$lib/types";
import {
  commitReport,
  fetchReport,
  MAX_REF_LINES,
  operationReport,
  outputSummary,
  publishTitle,
  pullReport,
  pushReport,
  pushTagsReport,
  refUpdates,
  syncReport,
  upstreamRemote,
} from "./gitReport";

// Output recorded from git 2.4x with --progress (progress lines ending in a carriage return are dropped by the app).
const FETCH = [
  "remote: Total 9 (delta 0), reused 0 (delta 0), pack-reused 0 (from 0)",
  "From github.com:acme/storefront",
  "   7eba1a2..fc63817  main       -> origin/main",
  " * [new branch]      feature    -> origin/feature",
  " * [new tag]         v1         -> v1",
  " - [deleted]         (none)     -> origin/old",
  " + 1111111...2222222 wip        -> origin/wip  (forced update)",
].join("\n");
const PULL_FAST_FORWARD = [
  "From github.com:acme/storefront",
  "   7eba1a2..fc63817  main       -> origin/main",
  "Updating 7eba1a2..fc63817",
  "Fast-forward",
  " f | 1 +",
  " 1 file changed, 1 insertion(+)",
].join("\n");
const PULL_MERGE = [
  "   fc63817..510aba1  main       -> origin/main",
  "Merge made by the 'ort' strategy.",
  " 2 files changed, 3 insertions(+), 1 deletion(-)",
].join("\n");
const PULL_REBASE =
  "   510aba1..3d26132  main -> origin/main\rRebasing (1/2)\rSuccessfully rebased and updated refs/heads/main.";
const PUSH = ["To github.com:acme/storefront.git", "   0867b60..7eba1a2  main -> main"].join("\n");
const FIRST_PUSH = [
  "To github.com:acme/storefront.git",
  " * [new branch]      feature -> feature",
  "branch 'feature' set up to track 'origin/feature'.",
].join("\n");
const REJECTED = " ! [rejected]        main -> main (fetch first)";

function head(extra: Partial<HeadInfo> = {}): HeadInfo {
  return { branch: "main", shortId: "7eba1a2", unborn: false, upstream: "origin/main", ahead: 2, behind: 0, ...extra };
}

describe("reading git's output", () => {
  it("reads every kind of ref line", () => {
    expect(refUpdates(FETCH).map((update) => [update.flag, update.summary, update.to])).toEqual([
      [" ", "7eba1a2..fc63817", "origin/main"],
      ["*", "[new branch]", "origin/feature"],
      ["*", "[new tag]", "v1"],
      ["-", "[deleted]", "origin/old"],
      ["+", "1111111...2222222", "origin/wip"],
    ]);
    expect(refUpdates(REJECTED)[0]).toMatchObject({ flag: "!", to: "main", reason: "fetch first" });
  });

  it("keeps one fact per line and drops the progress", () => {
    expect(outputSummary(FETCH)).toBe(
      [
        "origin/main: 7eba1a2..fc63817",
        "New branch origin/feature",
        "New tag v1",
        "Deleted origin/old",
        "origin/wip: 1111111...2222222 (forced)",
      ].join("\n"),
    );
    expect(outputSummary(PULL_FAST_FORWARD)).toBe(
      ["origin/main: 7eba1a2..fc63817", "Fast-forward", "1 file changed, 1 insertion(+)"].join("\n"),
    );
    expect(outputSummary(PULL_MERGE)).toContain("Made a merge commit\n2 files changed");
    expect(outputSummary(PULL_REBASE)).toBe("origin/main: 510aba1..3d26132\nRebased");
    expect(outputSummary(FIRST_PUSH)).toBe("New branch feature\nTracks origin/feature");
    expect(outputSummary("[main 74dae5f] Fix the cart total\n 1 file changed, 2 insertions(+)")).toBe(
      "74dae5f Fix the cart total\n1 file changed, 2 insertions(+)",
    );
    expect(outputSummary("Everything up-to-date")).toBeNull();
    expect(outputSummary("")).toBeNull();
  });

  it("lists a few refs, then how many more", () => {
    const many = Array.from(
      { length: MAX_REF_LINES + 3 },
      (_, index) => ` * [new branch]      b${index} -> origin/b${index}`,
    );
    const summary = (outputSummary(many.join("\n")) ?? "").split("\n");
    expect(summary).toHaveLength(MAX_REF_LINES + 1);
    expect(summary.at(-1)).toBe("and 3 more");
  });

  it("finds the upstream's remote", () => {
    expect(upstreamRemote(head())).toBe("origin");
    expect(upstreamRemote(head({ upstream: null }))).toBeNull();
    expect(upstreamRemote(null)).toBeNull();
  });
});

describe("titles", () => {
  it("names the remote a fetch read, or says it brought nothing", () => {
    expect(fetchReport(FETCH, head(), false)).toMatchObject({ title: "Fetched origin", kind: "success" });
    expect(fetchReport(FETCH, head(), true, true).title).toBe("Fetched all remotes and pruned");
    expect(fetchReport("", head(), false)).toEqual({
      title: "Fetched origin: nothing new",
      detail: null,
      kind: "info",
    });
  });

  it("names the upstream and branch of a pull", () => {
    expect(pullReport(PULL_FAST_FORWARD, head()).title).toBe("Pulled origin/main into main");
    expect(pullReport(PULL_REBASE, head(), true).title).toBe("Pulled origin/main into main with rebase");
    expect(pullReport("Already up to date.", head())).toMatchObject({
      title: "main is up to date with origin/main",
      kind: "info",
    });
    expect(pullReport(PULL_MERGE, head({ upstream: null })).title).toBe("Pulled into main");
  });

  it("counts the commits a push sent and where", () => {
    expect(pushReport(PUSH, head())).toMatchObject({
      title: "Pushed 2 commits of main to origin/main",
      detail: "main: 0867b60..7eba1a2",
    });
    expect(pushReport(PUSH, head({ ahead: 1 })).title).toBe("Pushed 1 commit of main to origin/main");
    expect(pushReport(PUSH, head(), true).title).toBe("Force pushed main to origin/main");
    expect(pushReport("Everything up-to-date", head())).toMatchObject({
      title: "main is up to date on origin/main",
      kind: "info",
    });
    expect(pushReport(FIRST_PUSH, head({ branch: "feature", upstream: null, ahead: 0 })).title).toBe(
      "Pushed feature to origin/feature",
    );
    expect(publishTitle("feature", FIRST_PUSH)).toBe("Published feature to origin/feature");
    expect(publishTitle("feature", "")).toBe("Published feature");
  });

  it("names the remote tags went to", () => {
    expect(pushTagsReport(" * [new tag]         v2 -> v2", head())).toEqual({
      title: "Pushed tags to origin",
      detail: "New tag v2",
      kind: "success",
    });
    expect(pushTagsReport("Everything up-to-date", head()).kind).toBe("info");
  });

  it("says how many commits a sync moved each way", () => {
    expect(syncReport(head(), 3, 1)).toEqual({
      title: "Synced main with origin/main",
      detail: "Pulled 3 commits, pushed 1 commit",
      kind: "success",
    });
    expect(syncReport(head(), 0, 2).detail).toBe("Pushed 2 commits");
    expect(syncReport(head(), 0, 0)).toMatchObject({ title: "main is in sync with origin/main", kind: "info" });
  });

  it("names the branch of a commit and shows the new commit", () => {
    const output = {
      stdout: "[main 74dae5f] Fix the cart total\n 1 file changed, 2 insertions(+)",
      stderr: "",
      success: true,
    };
    expect(commitReport(output, "main", false)).toEqual({
      title: "Committed on main",
      detail: "74dae5f Fix the cart total\n1 file changed, 2 insertions(+)",
      kind: "success",
    });
    expect(commitReport(output, null, true).title).toBe("Amended the last commit");
  });

  it("names the operation and branch of Continue and Abort", () => {
    const op = {
      kind: "rebase" as const,
      description: "Rebasing main onto origin/main",
      oursLabel: "",
      theirsLabel: "",
    };
    expect(operationReport("Finished", op, head())).toEqual({
      title: "Finished the rebase on main",
      detail: "Rebasing main onto origin/main",
      kind: "success",
    });
    expect(operationReport("Aborted", null, null).title).toBe("Aborted the operation");
  });
});
