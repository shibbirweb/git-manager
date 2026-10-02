import { describe, expect, it } from "vitest";
import type { RebaseCommit, RebaseStep } from "$lib/types";
import {
  actionForKey,
  allowedActions,
  combinedMessage,
  deadCommits,
  initialRows,
  isMessageSquash,
  moveRow,
  rebaseEntries,
  rebaseTitle,
  rowsChanged,
  segmentTitles,
  setAction,
  setMessage,
  targetIndex,
  validateRows,
} from "./rebaseModel";

function commit(id: string, message: string, isMerge = false): RebaseCommit {
  return {
    id: id.repeat(40).slice(0, 40),
    shortId: id.repeat(8).slice(0, 8),
    summary: message.split("\n")[0],
    message,
    authorName: "Ann",
    authorEmail: "ann@example.com",
    time: 1_700_000_000,
    isMerge,
  };
}

const commits = [commit("a", "First\n\nBody one\n"), commit("b", "Second\n"), commit("c", "Third\n"), commit("d", "Fourth\n")];

describe("rebase rows", () => {
  it("start as picks with each commit's message", () => {
    const rows = initialRows(commits);
    expect(rows.map((row) => row.action)).toEqual(["pick", "pick", "pick", "pick"]);
    expect(rows[0].message).toBe("First\n\nBody one\n");
    expect(rebaseTitle(4)).toBe("Rebasing 4 commits");
    expect(rebaseTitle(1)).toBe("Rebasing 1 commit");
  });

  it("maps letter keys to actions", () => {
    expect(["p", "r", "e", "s", "f", "d", "R", "x"].map(actionForKey)).toEqual([
      "pick",
      "reword",
      "edit",
      "squash",
      "fixup",
      "drop",
      "reword",
      null,
    ]);
  });

  it("prefills a squash with the combined messages, skipping fixups and dropped rows", () => {
    let rows = initialRows(commits);
    rows = setAction(rows, 1, "fixup");
    rows = setAction(rows, 2, "drop");
    rows = setAction(rows, 3, "squash");
    expect(targetIndex(rows, 3)).toBe(0);
    expect(rows[3].message).toBe("First\n\nBody one\n\nFourth");
    expect(combinedMessage(rows, 3)).toBe("First\n\nBody one\n\nFourth");
    expect(isMessageSquash(rows, 3)).toBe(true);
  });

  it("uses a reworded target's message and only the last squash of a group carries it", () => {
    let rows = initialRows(commits);
    rows = setAction(rows, 0, "reword");
    rows = setMessage(rows, 0, "New first\n");
    rows = setAction(rows, 1, "squash");
    rows = setAction(rows, 2, "squash");
    expect(rows[2].message).toBe("New first\n\nSecond\n\nThird");
    expect(isMessageSquash(rows, 1)).toBe(false);
    expect(isMessageSquash(rows, 2)).toBe(true);
    const entries = rebaseEntries(rows);
    expect(entries.map((entry) => entry.message)).toEqual(["New first\n", null, "New first\n\nSecond\n\nThird\n", null]);
  });

  it("reorders and resets", () => {
    const original = initialRows(commits);
    const moved = moveRow(original, 3, 0);
    expect(moved.map((row) => row.commit.summary)).toEqual(["Fourth", "First", "Second", "Third"]);
    expect(moveRow(moved, 0, 99).map((row) => row.commit.summary)).toEqual(["First", "Second", "Third", "Fourth"]);
    expect(moveRow(original, 2, 2)).toBe(original);
    expect(rowsChanged(moved, original)).toBe(true);
    expect(rowsChanged(original, initialRows(commits))).toBe(false);
    expect(rowsChanged(setAction(original, 1, "edit"), original)).toBe(true);
  });

  it("keeps the list valid", () => {
    const rows = initialRows(commits);
    expect(validateRows(rows)).toBeNull();
    expect(validateRows(setAction(rows, 0, "squash"))).toBe("The first commit cannot be squashed or fixed up");
    // A dropped first row makes the next one first.
    expect(validateRows(setAction(setAction(rows, 0, "drop"), 1, "fixup"))).toBe("The first commit cannot be squashed or fixed up");
    let dropped = rows;
    for (let index = 0; index < rows.length; index++) {
      dropped = setAction(dropped, index, "drop");
    }
    expect(validateRows(dropped)).toBe("At least one commit must remain");
    expect(validateRows(setMessage(setAction(rows, 1, "reword"), 1, "  \n"))).toBe("The message of bbbbbbbb cannot be empty");
    expect(validateRows(initialRows([commit("a", "A"), commit("m", "Merge", true)]))).toMatch(/merge commits/);
    expect(validateRows([])).toBe("There are no commits to rebase");
  });

  it("sends every row in order with its action", () => {
    let rows = moveRow(initialRows(commits), 2, 0);
    rows = setAction(rows, 1, "edit");
    rows = setAction(rows, 3, "drop");
    expect(rebaseEntries(rows).map((entry) => [entry.action, entry.commitId[0]])).toEqual([
      ["pick", "c"],
      ["edit", "a"],
      ["pick", "b"],
      ["drop", "d"],
    ]);
  });
});

describe("rebase rows with merges", () => {
  const s1 = commit("1", "s1\n");
  const s2 = commit("2", "s2\n");
  const f2 = commit("3", "f2\n");
  const merge = commit("4", "Merge side\n", true);
  const f3 = commit("5", "f3\n");
  const label = `gm-${s2.id.slice(0, 12)}`;
  const step = (kind: RebaseStep["kind"], extra: Partial<RebaseStep> = {}): RebaseStep => ({
    kind,
    commitId: null,
    label: null,
    parents: [],
    ...extra,
  });
  // git rebase -i --rebase-merges: the side branch first, then the current branch merging it.
  const steps: RebaseStep[] = [
    step("label", { label: "onto" }),
    step("reset", { label: "onto" }),
    step("pick", { commitId: s1.id }),
    step("pick", { commitId: s2.id }),
    step("label", { label }),
    step("reset", { label: "onto" }),
    step("pick", { commitId: f2.id }),
    step("merge", { commitId: merge.id, parents: [label] }),
    step("pick", { commitId: f3.id }),
  ];
  // The plan's commits come in topological order, not the todo's.
  const planCommits = [f2, s1, s2, merge, f3];

  it("follows the todo, with runs split at labels, resets and merges", () => {
    const rows = initialRows(planCommits, steps);
    expect(rows.map((row) => row.commit.summary)).toEqual(["s1", "s2", "f2", "Merge side", "f3"]);
    expect(rows.map((row) => row.run)).toEqual([0, 0, 1, 2, 3]);
    expect(rows.map((row) => row.segment)).toEqual([0, 0, 1, 1, 1]);
    expect(validateRows(rows, steps)).toBeNull();
    expect(segmentTitles(steps, planCommits, "main")).toEqual([
      "Merged by 44444444: starts on main",
      "Current branch: starts on main",
    ]);
  });

  it("moves and melds only inside a run", () => {
    const rows = initialRows(planCommits, steps);
    const swapped = moveRow(rows, 1, 0);
    expect(swapped.map((row) => row.commit.summary).slice(0, 2)).toEqual(["s2", "s1"]);
    expect(moveRow(rows, 1, 2)).toBe(rows);
    expect(moveRow(rows, 4, 3)).toBe(rows);
    const fixup = setAction(rows, 1, "fixup");
    expect(targetIndex(fixup, 1)).toBe(0);
    expect(validateRows(fixup, steps)).toBeNull();
    const orphan = setAction(rows, 4, "squash");
    expect(targetIndex(orphan, 4)).toBe(-1);
    expect(validateRows(orphan, steps)).toMatch(/no commit above it on its branch/);
  });

  it("picks or drops a merge as a unit, with the branch it merged", () => {
    const rows = initialRows(planCommits, steps);
    expect(allowedActions(rows[3])).toEqual(["pick", "drop"]);
    expect(setAction(rows, 3, "reword")).toBe(rows);
    const dropped = setAction(rows, 3, "drop");
    expect([...deadCommits(dropped, steps)]).toEqual([s1.id, s2.id]);
    expect(deadCommits(rows, steps).size).toBe(0);
    // A squash on a dropped branch does not matter any more.
    expect(validateRows(setAction(dropped, 0, "squash"), steps)).toBeNull();
    const allGone = [0, 1, 2, 3, 4].reduce((next, index) => setAction(next, index, "drop"), rows);
    expect(validateRows(allGone, steps)).toBe("At least one commit must remain");
    expect(rebaseEntries(dropped).map((entry) => entry.action)).toEqual(["pick", "pick", "pick", "drop", "pick"]);
  });
});
