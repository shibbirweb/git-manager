import { describe, expect, it } from "vitest";
import type { LastAction, ReflogEntry } from "$lib/types";
import { type DeletedBranch, restoreStillValid, undoPlan, type UndoInputs, undoStillValid } from "./undoPlan";

const OLD = "1111111111111111111111111111111111111111";
const NEW = "2222222222222222222222222222222222222222";

const entry = (overrides: Partial<ReflogEntry> = {}): ReflogEntry => ({
  index: 0,
  selector: "HEAD@{0}",
  oldId: OLD,
  newId: NEW,
  oldShortId: OLD.slice(0, 8),
  newShortId: NEW.slice(0, 8),
  action: "commit",
  detail: "Add login",
  message: "commit: Add login",
  time: 1000,
  committerName: "Ann",
  checkoutFrom: null,
  ...overrides,
});

const last = (entryOverrides: Partial<ReflogEntry> = {}, overrides: Partial<LastAction> = {}): LastAction => ({
  entry: entry(entryOverrides),
  branch: "main",
  pushed: false,
  fromBranchExists: false,
  ...overrides,
});

const inputs = (overrides: Partial<UndoInputs> = {}): UndoInputs => ({
  last: last(),
  op: "none",
  bisecting: false,
  deleted: null,
  localBranches: ["main"],
  ...overrides,
});

const deleted = (deletedAt: number): DeletedBranch => ({ repoRoot: "/r", branchName: "topic", commitId: OLD, deletedAt });

describe("undoPlan", () => {
  it("undoes a commit softly back to its parent", () => {
    const plan = undoPlan(inputs());
    expect(plan).toMatchObject({ kind: "moveHead", mode: "soft", headId: NEW, commitId: OLD, pushed: false, title: "Undo Commit" });
    expect(plan.kind === "moveHead" && plan.message).toBe('Undo the commit "Add login" on main? Its changes stay staged.');
  });

  it("warns when the commit is pushed", () => {
    const plan = undoPlan(inputs({ last: last({}, { pushed: true }) }));
    expect(plan).toMatchObject({ kind: "moveHead", pushed: true });
    expect(plan.kind === "moveHead" && plan.message).toContain("rewrites published history");
  });

  it("undoes an amend softly to the commit before it", () => {
    expect(undoPlan(inputs({ last: last({ action: "amend" }) }))).toMatchObject({ kind: "moveHead", mode: "soft", title: "Undo Amend", commitId: OLD });
  });

  it("undoes merges, pulls and resets keeping local changes", () => {
    expect(undoPlan(inputs({ last: last({ action: "merge" }) }))).toMatchObject({ kind: "moveHead", mode: "keep", title: "Undo Merge" });
    expect(undoPlan(inputs({ last: last({ action: "pull" }) }))).toMatchObject({ kind: "moveHead", mode: "keep", title: "Undo Pull" });
    const reset = undoPlan(inputs({ last: last({ action: "reset" }, { pushed: true }) }));
    expect(reset).toMatchObject({ kind: "moveHead", mode: "keep", title: "Undo Reset", pushed: false });
  });

  it("switches back after a checkout, or detaches at the old commit", () => {
    const checkout = { action: "checkout" as const, checkoutFrom: "main", oldId: OLD, newId: OLD };
    expect(undoPlan(inputs({ last: last(checkout, { fromBranchExists: true }) }))).toMatchObject({
      kind: "switchBranch",
      branchName: "main",
    });
    expect(undoPlan(inputs({ last: last({ ...checkout, checkoutFrom: OLD.slice(0, 7) }) }))).toMatchObject({
      kind: "detach",
      commitId: OLD,
    });
  });

  it("restores a branch deleted after the last HEAD movement", () => {
    const plan = undoPlan(inputs({ deleted: deleted(2_000_000) }));
    expect(plan).toMatchObject({ kind: "restoreBranch", branchName: "topic", commitId: OLD });
    expect(undoPlan(inputs({ deleted: deleted(500_000) }))).toMatchObject({ kind: "moveHead" });
    expect(undoPlan(inputs({ deleted: deleted(2_000_000), localBranches: ["main", "topic"] }))).toMatchObject({ kind: "moveHead" });
    expect(undoPlan(inputs({ last: null, deleted: deleted(1) }))).toMatchObject({ kind: "restoreBranch" });
  });

  it("refuses what it cannot undo", () => {
    const reasons = [
      undoPlan(inputs({ op: "merge" })),
      undoPlan(inputs({ bisecting: true })),
      undoPlan(inputs({ last: null })),
      undoPlan(inputs({ last: { entry: null, branch: null, pushed: false, fromBranchExists: false } })),
      undoPlan(inputs({ last: last({ action: "initialCommit", oldId: "0".repeat(40) }) })),
      undoPlan(inputs({ last: last({ action: "reset", oldId: NEW }) })),
      undoPlan(inputs({ last: last({ action: "rebase" }) })),
      undoPlan(inputs({ last: last({ action: "clone" }) })),
    ];
    for (const plan of reasons) {
      expect(plan.kind).toBe("none");
    }
    expect(reasons[0]).toEqual({ kind: "none", reason: "Finish or abort the operation in progress first" });
    expect(reasons[2]).toEqual({ kind: "none", reason: "Nothing to undo" });
  });

  it("does not restore a branch while an operation runs", () => {
    expect(undoPlan(inputs({ op: "rebase", deleted: deleted(2_000_000) })).kind).toBe("none");
  });
});

describe("undoStillValid", () => {
  it("holds while HEAD and the branch stay", () => {
    const captured = { shortId: "abcd1234", branch: "main" };
    expect(undoStillValid(captured, { shortId: "abcd1234", branch: "main" })).toBe(true);
    expect(undoStillValid(captured, { shortId: "ffff0000", branch: "main" })).toBe(false);
    expect(undoStillValid(captured, { shortId: "abcd1234", branch: null })).toBe(false);
    expect(undoStillValid(captured, null)).toBe(false);
    expect(undoStillValid(null, captured)).toBe(false);
    expect(undoStillValid({ shortId: null, branch: "main" }, { shortId: null, branch: "main" })).toBe(false);
  });

  it("offers Restore until the branch exists again", () => {
    expect(restoreStillValid("topic", ["main"])).toBe(true);
    expect(restoreStillValid("topic", ["main", "topic"])).toBe(false);
    expect(restoreStillValid("topic", null)).toBe(true);
  });
});
