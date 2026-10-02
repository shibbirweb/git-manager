import { describe, expect, it, vi } from "vitest";
import type { FileStatus, HeadInfo } from "$lib/types";
import type { MenuItem } from "$lib/ui/menu.svelte";
import {
  branchDecorations,
  branchTooltip,
  commitButtonTooltip,
  commitChoiceSpec,
  commitDropdownItems,
  commitModeBlocked,
  commitPlan,
  type RepoActionState,
  repoActionState,
  type RepoMenuHandlers,
  repoMenuItems,
} from "./repoMenu";
import type { FileGroups } from "./sections";

const head = (overrides: Partial<HeadInfo> = {}): HeadInfo => ({
  branch: "main",
  shortId: "abc1234",
  unborn: false,
  upstream: "origin/main",
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

const groups = (overrides: Partial<FileGroups> = {}): FileGroups => ({
  conflicts: [],
  staged: [],
  unstaged: [],
  ...overrides,
});

const state = (overrides: Partial<RepoActionState> = {}): RepoActionState => ({
  ...repoActionState(head(), groups(), false, false, { stashCount: 1, tagCount: 1, remoteCount: 1 }),
  ...overrides,
});

function handlers(): RepoMenuHandlers {
  return new Proxy({} as RepoMenuHandlers, {
    get: (target, key: string) => {
      const record = target as unknown as Record<string, () => void>;
      record[key] ??= vi.fn();
      return record[key];
    },
  });
}

/** The leaf item at a "Submenu/Label" path. */
function find(items: MenuItem[], path: string): MenuItem | undefined {
  const [first, ...rest] = path.split("/");
  const item = items.find((candidate) => !("separator" in candidate) && candidate.label === first);
  if (rest.length === 0 || !item || !("submenu" in item)) {
    return rest.length === 0 ? item : undefined;
  }
  return find(item.submenu, rest.join("/"));
}

function enabled(items: MenuItem[], path: string): boolean {
  const item = find(items, path);
  if (!item || "separator" in item) {
    throw new Error(`No menu item ${path}`);
  }
  return !item.disabled;
}

function labels(items: MenuItem[]): string[] {
  return items.map((item) => ("separator" in item ? "---" : item.label));
}

describe("branch decorations", () => {
  it("marks unstaged, staged and conflicted files like VS Code", () => {
    expect(branchDecorations(groups())).toBe("");
    expect(branchDecorations(groups({ unstaged: [file("a")] }))).toBe("*");
    expect(branchDecorations(groups({ staged: [file("a")] }))).toBe("+");
    expect(branchDecorations(groups({ unstaged: [file("a")], staged: [file("b")], conflicts: [file("c")] }))).toBe("*+!");
  });

  it("explains them in the tooltip", () => {
    expect(branchTooltip("main", groups({ unstaged: [file("a")], staged: [file("b")] }), "origin/main")).toBe(
      "Branches... (main), * changes, + staged changes, tracking origin/main",
    );
    expect(branchTooltip("main", groups(), null)).toBe("Branches... (main)");
  });
});

describe("repository state", () => {
  it("counts tracked unstaged changes apart from untracked files", () => {
    const result = repoActionState(
      head({ ahead: 2 }),
      groups({ unstaged: [file("a"), file("new", { unstaged: "untracked" })], staged: [file("s")] }),
      false,
      true,
    );
    expect(result).toMatchObject({
      busy: true,
      branch: "main",
      ahead: 2,
      stagedCount: 1,
      unstagedCount: 2,
      trackedCount: 1,
      stashCount: null,
    });
  });

  it("defaults a missing head", () => {
    expect(repoActionState(null, groups(), false, false)).toMatchObject({ branch: null, unborn: false, upstream: null });
  });
});

describe("commit plan", () => {
  const message = { message: "Fix it", amend: false };

  it("commits staged changes with a message", () => {
    expect(commitPlan(state({ stagedCount: 1 }), message)).toEqual({ kind: "commit", mode: "staged", amend: false });
  });

  it("focuses the commit box when there is no message", () => {
    expect(commitPlan(state({ stagedCount: 1 }), { message: "  ", amend: false })).toEqual({ kind: "focus" });
    expect(commitPlan(state({ stagedCount: 1 }), { message: "", amend: true })).toEqual({ kind: "focus" });
  });

  it("asks to commit all when only tracked files changed", () => {
    expect(commitPlan(state({ unstagedCount: 1, trackedCount: 1 }), message)).toEqual({ kind: "confirmAll" });
  });

  it("refuses conflicts, nothing to commit, only new files, and amending without a commit", () => {
    expect(commitPlan(state({ stagedCount: 1, conflictCount: 1 }), message)).toEqual({
      kind: "blocked",
      reason: "Resolve conflicts before committing",
    });
    expect(commitPlan(state(), message)).toEqual({ kind: "blocked", reason: "There are no changes to commit" });
    expect(commitPlan(state({ unstagedCount: 1, trackedCount: 0 }), message).kind).toBe("blocked");
    expect(commitPlan(state({ unborn: true }), { message: "x", amend: true }).kind).toBe("blocked");
  });

  it("amends even with nothing staged", () => {
    expect(commitPlan(state(), { message: "Reword", amend: true })).toEqual({ kind: "commit", mode: "staged", amend: true });
  });

  it("says what the button does", () => {
    expect(commitButtonTooltip({ kind: "focus" })).toBe("Commit: write a message first");
    expect(commitButtonTooltip({ kind: "blocked", reason: "Nope" })).toBe("Nope");
    expect(commitButtonTooltip({ kind: "commit", mode: "staged", amend: false })).toBe("Commit staged changes");
  });

  it("checks Commit Staged, Commit All and Commit (Amend)", () => {
    expect(commitModeBlocked(state({ unstagedCount: 1, trackedCount: 1 }), "staged")).not.toBeNull();
    expect(commitModeBlocked(state({ unstagedCount: 1, trackedCount: 1 }), "all")).toBeNull();
    expect(commitModeBlocked(state({ unstagedCount: 1, trackedCount: 0 }), "all")).not.toBeNull();
    expect(commitModeBlocked(state(), "staged", true)).toBeNull();
    expect(commitModeBlocked(state({ unborn: true }), "staged", true)).not.toBeNull();
  });
});

describe("commit dropdown", () => {
  const ready = { busy: false, canCommit: true, canAmend: true, canPush: true, amendChecked: false };

  it("maps each choice to amend and a follow-up", () => {
    expect(commitChoiceSpec("commit")).toEqual({ amend: false, followUp: "none" });
    expect(commitChoiceSpec("commitPush")).toEqual({ amend: false, followUp: "push" });
    expect(commitChoiceSpec("commitSync")).toEqual({ amend: false, followUp: "sync" });
    expect(commitChoiceSpec("amend")).toEqual({ amend: true, followUp: "none" });
  });

  it("lists the VS Code entries and runs the picked one", () => {
    const run = vi.fn();
    const items = commitDropdownItems(ready, run);
    expect(labels(items)).toEqual(["Commit", "Commit & Push", "Commit & Sync", "---", "Commit (Amend)"]);
    const push = items[1];
    if ("action" in push) {
      push.action();
    }
    expect(run).toHaveBeenCalledWith("commitPush");
  });

  it("disables what cannot run", () => {
    const blocked = commitDropdownItems({ ...ready, canCommit: false }, vi.fn());
    expect(blocked.map((item) => ("separator" in item ? null : !item.disabled))).toEqual([false, false, false, null, true]);
    const detached = commitDropdownItems({ ...ready, canPush: false }, vi.fn());
    expect(enabled(detached, "Commit")).toBe(true);
    expect(enabled(detached, "Commit & Push")).toBe(false);
    // Pushing an amended commit needs a force push: not offered as a one-click follow-up.
    const amending = commitDropdownItems({ ...ready, amendChecked: true }, vi.fn());
    expect(labels(amending)[0]).toBe("Amend Commit");
    expect(enabled(amending, "Commit & Sync")).toBe(false);
    const busy = commitDropdownItems({ ...ready, busy: true }, vi.fn());
    expect(busy.every((item) => "separator" in item || item.disabled)).toBe(true);
  });
});

describe("repository menu", () => {
  it("has VS Code's groups as submenus, then Show Log", () => {
    const items = repoMenuItems(state(), handlers());
    expect(labels(items)).toEqual(["Commit", "Changes", "Pull, Push", "Branch", "Stash", "Tags", "---", "Show Log"]);
    const submenu = (label: string) => {
      const item = find(items, label);
      return item && "submenu" in item ? labels(item.submenu) : [];
    };
    expect(submenu("Commit")).toEqual(["Commit", "Commit Staged", "Commit All", "---", "Undo Last Commit", "Commit (Amend)"]);
    expect(submenu("Changes")).toEqual(["Stage All Changes", "Unstage All Changes", "Discard All Changes"]);
    expect(submenu("Pull, Push")).toEqual([
      "Pull",
      "Pull (Rebase)",
      "---",
      "Push",
      "Force Push",
      "---",
      "Fetch",
      "Fetch (Prune)",
      "Fetch From All Remotes",
    ]);
    expect(submenu("Branch")).toEqual([
      "Checkout to...",
      "Create Branch...",
      "Create Branch From...",
      "Rename Branch...",
      "Delete Branch...",
      "---",
      "Merge Branch...",
      "Rebase Branch...",
    ]);
    expect(submenu("Stash")).toEqual([
      "Stash",
      "Stash (Include Untracked)",
      "---",
      "Apply Latest Stash",
      "Pop Latest Stash",
      "---",
      "Apply Stash...",
      "Pop Stash...",
      "Drop Stash...",
      "Drop All Stashes",
      "---",
      "Shelve Changes...",
      "Show Shelf",
    ]);
    expect(submenu("Tags")).toEqual(["Create Tag...", "Delete Tag...", "Push Tags"]);
  });

  it("offers Publish Branch only without an upstream", () => {
    const items = repoMenuItems(state({ upstream: null }), handlers());
    expect(enabled(items, "Branch/Publish Branch")).toBe(true);
    expect(enabled(items, "Pull, Push/Pull")).toBe(false);
    expect(enabled(items, "Pull, Push/Force Push")).toBe(false);
    expect(enabled(items, "Pull, Push/Push")).toBe(true);
    expect(find(repoMenuItems(state(), handlers()), "Branch/Publish Branch")).toBeUndefined();
  });

  it("enables changes and commit items by what there is", () => {
    const clean = repoMenuItems(state(), handlers());
    expect(enabled(clean, "Changes/Stage All Changes")).toBe(false);
    expect(enabled(clean, "Changes/Discard All Changes")).toBe(false);
    expect(enabled(clean, "Commit/Commit")).toBe(false);
    expect(enabled(clean, "Stash/Stash")).toBe(false);
    expect(enabled(clean, "Commit/Commit (Amend)")).toBe(true);

    const dirty = repoMenuItems(state({ stagedCount: 1, unstagedCount: 2, trackedCount: 2 }), handlers());
    expect(enabled(dirty, "Changes/Stage All Changes")).toBe(true);
    expect(enabled(dirty, "Changes/Unstage All Changes")).toBe(true);
    expect(enabled(dirty, "Commit/Commit All")).toBe(true);
    expect(enabled(dirty, "Stash/Stash (Include Untracked)")).toBe(true);
  });

  it("disables stash, tag and remote items when there are none, but not while unknown", () => {
    const empty = repoMenuItems(state({ stashCount: 0, tagCount: 0, remoteCount: 0 }), handlers());
    expect(enabled(empty, "Stash/Pop Latest Stash")).toBe(false);
    expect(enabled(empty, "Stash/Drop All Stashes")).toBe(false);
    expect(enabled(empty, "Tags/Delete Tag...")).toBe(false);
    expect(enabled(empty, "Tags/Push Tags")).toBe(false);
    expect(enabled(empty, "Pull, Push/Fetch")).toBe(false);
    expect(enabled(empty, "Tags/Create Tag...")).toBe(true);

    const unknown = repoMenuItems(state({ stashCount: null, tagCount: null, remoteCount: null }), handlers());
    expect(enabled(unknown, "Stash/Apply Stash...")).toBe(true);
    expect(enabled(unknown, "Tags/Push Tags")).toBe(true);
    expect(enabled(unknown, "Pull, Push/Fetch From All Remotes")).toBe(true);
  });

  it("blocks history-changing items during a merge or rebase, and everything while busy", () => {
    const merging = repoMenuItems(state({ operation: true }), handlers());
    expect(enabled(merging, "Pull, Push/Pull")).toBe(false);
    expect(enabled(merging, "Branch/Checkout to...")).toBe(false);
    expect(enabled(merging, "Branch/Merge Branch...")).toBe(false);
    expect(enabled(merging, "Commit/Undo Last Commit")).toBe(false);
    expect(enabled(merging, "Pull, Push/Fetch")).toBe(true);

    const busy = repoMenuItems(state({ busy: true, stagedCount: 1 }), handlers());
    const leaves = (items: MenuItem[]): MenuItem[] =>
      items.flatMap((item) => ("submenu" in item ? leaves(item.submenu) : [item]));
    const views = ["Show Log", "Show Shelf"];
    const actions = leaves(busy).filter((item) => !("separator" in item) && !views.includes(item.label));
    expect(actions.every((item) => !("separator" in item) && item.disabled)).toBe(true);
  });

  it("keeps a detached HEAD from pushing or rebasing", () => {
    const detached = repoMenuItems(state({ branch: null, upstream: null }), handlers());
    expect(enabled(detached, "Pull, Push/Push")).toBe(false);
    expect(enabled(detached, "Branch/Rebase Branch...")).toBe(false);
    expect(find(detached, "Branch/Publish Branch")).toBeUndefined();
    expect(enabled(detached, "Branch/Checkout to...")).toBe(true);
  });

  it("shows ahead and behind counts and marks destructive items", () => {
    const items = repoMenuItems(state({ ahead: 1, behind: 3 }), handlers());
    const pull = find(items, "Pull, Push/Pull");
    const push = find(items, "Pull, Push/Push");
    expect(pull && "action" in pull ? pull.hint : null).toBe("3 behind");
    expect(push && "action" in push ? push.hint : null).toBe("1 ahead");
    for (const path of ["Changes/Discard All Changes", "Pull, Push/Force Push", "Stash/Drop All Stashes", "Tags/Delete Tag..."]) {
      const item = find(items, path);
      expect(item && "action" in item ? item.danger : false, path).toBe(true);
    }
  });

  it("runs the matching handler", () => {
    const spy = handlers();
    const item = find(repoMenuItems(state(), spy), "Pull, Push/Pull (Rebase)");
    if (item && "action" in item) {
      item.action();
    }
    expect(spy.pullRebase).toHaveBeenCalledOnce();
    expect(spy.pull).not.toHaveBeenCalled();
  });
});
