// The Interactive Rebase dialog's list, kept pure: one row per commit (oldest first), its
// action, the reword and squash messages, reordering, validation and the todo entries sent
// to the backend. A squash or fixup row joins the nearest kept row above it; drop rows in
// between do not break that group, as in git's todo list.
//
// With merge commits in the range the plan carries the --rebase-merges todo (steps): rows
// follow it, each in a segment (one per `reset`, a branch) and a run (picks between two
// label, reset or merge lines). Rows move and meld only inside their run, a merge row is
// picked or dropped as a unit, and a dropped merge drops the segments that only fed it.

import type { RebaseAction, RebaseCommit, RebaseEntry, RebaseStep } from "$lib/types";

export interface RebaseRow {
  commit: RebaseCommit;
  action: RebaseAction;
  /** Reword: the new message; squash: the combined message (used on the group's last squash row). */
  message: string;
  /** With merges: the run of picks the row belongs to (it moves and melds only inside it). */
  run?: number;
  /** With merges: the segment (branch) of the todo, numbered from its first `reset`. */
  segment?: number;
}

export const REBASE_ACTIONS: { value: RebaseAction; label: string; key: string; description: string }[] = [
  { value: "pick", label: "Pick", key: "p", description: "Keep the commit" },
  { value: "reword", label: "Reword", key: "r", description: "Keep the commit and edit its message" },
  { value: "edit", label: "Edit", key: "e", description: "Stop at the commit to amend it" },
  { value: "squash", label: "Squash", key: "s", description: "Meld into the commit above and edit the message" },
  { value: "fixup", label: "Fixup", key: "f", description: "Meld into the commit above and keep its message" },
  { value: "drop", label: "Drop", key: "d", description: "Remove the commit" },
];

/** The action a letter key picks on a focused row, or null. */
export function actionForKey(key: string): RebaseAction | null {
  return REBASE_ACTIONS.find((action) => action.key === key.toLowerCase())?.value ?? null;
}

/** One pick row per commit, in the todo's order when the range has merges. */
export function initialRows(commits: RebaseCommit[], steps: RebaseStep[] = []): RebaseRow[] {
  if (steps.length === 0) {
    return commits.map((commit) => ({ commit, action: "pick", message: commit.message }));
  }
  const byId = new Map(commits.map((commit) => [commit.id, commit]));
  const rows: RebaseRow[] = [];
  let run = -1;
  let segment = -1;
  let inRun = false;
  for (const step of steps) {
    const commit = step.commitId ? byId.get(step.commitId) : undefined;
    if (step.kind === "reset") {
      segment++;
      inRun = false;
    } else if (step.kind === "label") {
      inRun = false;
    } else if (commit && step.kind === "pick") {
      if (!inRun) {
        run++;
        inRun = true;
      }
      rows.push({ commit, action: "pick", message: commit.message, run, segment });
    } else if (commit && step.kind === "merge") {
      run++;
      inRun = false;
      rows.push({ commit, action: "pick", message: commit.message, run, segment });
    }
  }
  return rows;
}

/** Actions a row offers: a merge commit is only picked or dropped. */
export function allowedActions(row: RebaseRow): RebaseAction[] {
  return row.commit.isMerge && row.segment !== undefined
    ? ["pick", "drop"]
    : REBASE_ACTIONS.map((action) => action.value);
}

/**
 * Commits whose whole segment is left out: a segment counts while the current branch's
 * segment needs it, through a `reset` to one of its labels or a kept merge of it.
 */
export function deadCommits(rows: RebaseRow[], steps: RebaseStep[]): Set<string> {
  const dead = new Set<string>();
  if (steps.length === 0) {
    return dead;
  }
  const dropped = new Set(rows.filter((row) => row.commit.isMerge && row.action === "drop").map((row) => row.commit.id));
  const definedIn = new Map<string, number>();
  const uses: string[][] = [];
  let segment = -1;
  for (const step of steps) {
    if (step.kind === "reset") {
      segment++;
      uses[segment] = step.label ? [step.label] : [];
    } else if (step.kind === "label" && step.label) {
      definedIn.set(step.label, segment);
    } else if (step.kind === "merge" && segment >= 0 && !dropped.has(step.commitId ?? "")) {
      uses[segment].push(...step.parents);
    }
  }
  const live = new Set<number>();
  const pending = segment >= 0 ? [segment] : [];
  while (pending.length > 0) {
    const current = pending.pop() ?? -1;
    if (current < 0 || live.has(current)) {
      continue;
    }
    live.add(current);
    for (const label of uses[current] ?? []) {
      const other = definedIn.get(label);
      if (other !== undefined) {
        pending.push(other);
      }
    }
  }
  for (const row of rows) {
    if (row.segment !== undefined && !live.has(row.segment)) {
      dead.add(row.commit.id);
    }
  }
  return dead;
}

/** A heading per segment: where the branch starts and what becomes of it. */
export function segmentTitles(steps: RebaseStep[], commits: RebaseCommit[], ontoLabel: string): string[] {
  const byId = new Map(commits.map((commit) => [commit.id, commit]));
  const labelUsers = new Map<string, RebaseCommit>();
  for (const step of steps) {
    const merge = step.kind === "merge" && step.commitId ? byId.get(step.commitId) : undefined;
    for (const parent of merge ? step.parents : []) {
      labelUsers.set(parent, merge as RebaseCommit);
    }
  }
  const resets = steps.filter((step) => step.kind === "reset");
  const titles: string[] = [];
  let segment = -1;
  let mergedBy: RebaseCommit | null = null;
  const finish = () => {
    const reset = resets[segment];
    if (!reset) {
      return;
    }
    const from = reset.commitId ? byId.get(reset.commitId) : undefined;
    let start: string;
    if (reset.label === "onto") {
      start = `starts on ${ontoLabel}`;
    } else if (reset.label && from) {
      start = `starts after ${from.shortId} ${from.summary}`;
    } else {
      start = `starts at ${(reset.commitId ?? "").slice(0, 8)}, which stays in place`;
    }
    const role = segment === resets.length - 1 ? "Current branch" : mergedBy ? `Merged by ${mergedBy.shortId}` : "Branch";
    titles.push(`${role}: ${start}`);
  };
  for (const step of steps) {
    if (step.kind === "reset") {
      finish();
      segment++;
      mergedBy = null;
    } else if (step.kind === "label" && step.label && labelUsers.has(step.label)) {
      mergedBy = labelUsers.get(step.label) ?? null;
    }
  }
  finish();
  return titles;
}

function melds(action: RebaseAction): boolean {
  return action === "squash" || action === "fixup";
}

/** Index of the kept row a squash or fixup at `index` melds into, or -1 (never across runs). */
export function targetIndex(rows: RebaseRow[], index: number): number {
  for (let candidate = index - 1; candidate >= 0; candidate--) {
    if (rows[candidate].run !== rows[index]?.run) {
      return -1;
    }
    const action = rows[candidate].action;
    if (action === "drop") {
      continue;
    }
    if (!melds(action)) {
      return candidate;
    }
  }
  return -1;
}

/** Rows of the group that starts at the kept row `start`: the squash and fixup rows below it. */
function groupMembers(rows: RebaseRow[], start: number): number[] {
  const members: number[] = [];
  for (let index = start + 1; index < rows.length; index++) {
    if (rows[index].run !== rows[start].run) {
      break;
    }
    const action = rows[index].action;
    if (action === "drop") {
      continue;
    }
    if (!melds(action)) {
      break;
    }
    members.push(index);
  }
  return members;
}

/** The message a kept row ends up with before squashing: its reworded text, else its own. */
function keptMessage(row: RebaseRow): string {
  return row.action === "reword" ? row.message : row.commit.message;
}

function joinMessages(messages: string[]): string {
  return messages
    .map((message) => message.trim())
    .filter((message) => message !== "")
    .join("\n\n");
}

/** Like git: the target's message and every squashed message, one after the other; fixups add nothing. */
export function combinedMessage(rows: RebaseRow[], index: number): string {
  const target = targetIndex(rows, index);
  if (target < 0) {
    return rows[index]?.commit.message ?? "";
  }
  const messages = [keptMessage(rows[target])];
  for (const member of groupMembers(rows, target)) {
    if (member > index) {
      break;
    }
    if (rows[member].action === "squash" || member === index) {
      messages.push(rows[member].commit.message);
    }
  }
  return joinMessages(messages);
}

/** The squash row whose message the group uses: the last squash row of its group. */
export function isMessageSquash(rows: RebaseRow[], index: number): boolean {
  if (rows[index]?.action !== "squash") {
    return false;
  }
  const target = targetIndex(rows, index);
  if (target < 0) {
    return false;
  }
  const squashes = groupMembers(rows, target).filter((member) => rows[member].action === "squash");
  return squashes[squashes.length - 1] === index;
}

/** Changes a row's action; a new reword starts from the commit's message, a new squash from the combined one. */
export function setAction(rows: RebaseRow[], index: number, action: RebaseAction): RebaseRow[] {
  const row = rows[index];
  if (!row || row.action === action || !allowedActions(row).includes(action)) {
    return rows;
  }
  const next = rows.map((candidate, position) => (position === index ? { ...candidate, action } : candidate));
  if (action === "reword") {
    next[index] = { ...next[index], message: row.commit.message };
  } else if (action === "squash") {
    next[index] = { ...next[index], message: combinedMessage(next, index) };
  }
  return next;
}

export function setMessage(rows: RebaseRow[], index: number, message: string): RebaseRow[] {
  return rows.map((row, position) => (position === index ? { ...row, message } : row));
}

/** Moves the row at `from` to `to` (both clamped); with merges only inside its run. */
export function moveRow(rows: RebaseRow[], from: number, to: number): RebaseRow[] {
  if (from < 0 || from >= rows.length) {
    return rows;
  }
  const target = Math.max(0, Math.min(rows.length - 1, to));
  if (target === from || rows[target].run !== rows[from].run) {
    return rows;
  }
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

/**
 * Where the row being dragged (`from`) lands when dropped on row `over`, or null when that
 * changes nothing: no drag, off the rows, the same row or another run.
 */
export function dropTarget(rows: RebaseRow[], from: number | null, over: number | null): number | null {
  if (from === null || over === null) {
    return null;
  }
  return moveRow(rows, from, over) === rows ? null : over;
}

/** Anything differs from the list the dialog opened with. */
export function rowsChanged(rows: RebaseRow[], original: RebaseRow[]): boolean {
  if (rows.length !== original.length) {
    return true;
  }
  return rows.some((row, index) => {
    const first = original[index];
    if (row.commit.id !== first.commit.id || row.action !== first.action) {
      return true;
    }
    return (row.action === "reword" || row.action === "squash") && row.message !== first.message;
  });
}

/** Why the list cannot be rebased as it is, or null; `steps` is the plan's merge layout. */
export function validateRows(rows: RebaseRow[], steps: RebaseStep[] = []): string | null {
  if (rows.length === 0) {
    return "There are no commits to rebase";
  }
  if (steps.length === 0 && rows.some((row) => row.commit.isMerge)) {
    return "The range has merge commits; interactive rebase of merges is not supported";
  }
  const dead = deadCommits(rows, steps);
  const live = rows.filter((row) => !dead.has(row.commit.id));
  const kept = live.filter((row) => row.action !== "drop");
  if (kept.length === 0) {
    return "At least one commit must remain";
  }
  const firstOfRun = new Map<number | undefined, RebaseRow>();
  for (const row of kept) {
    if (!firstOfRun.has(row.run)) {
      firstOfRun.set(row.run, row);
    }
  }
  for (const row of firstOfRun.values()) {
    if (melds(row.action)) {
      return steps.length > 0
        ? `${row.commit.shortId} cannot be squashed or fixed up: there is no commit above it on its branch`
        : "The first commit cannot be squashed or fixed up";
    }
  }
  for (const [index, row] of rows.entries()) {
    if (dead.has(row.commit.id)) {
      continue;
    }
    const needsMessage = row.action === "reword" || isMessageSquash(rows, index);
    if (needsMessage && row.message.trim() === "") {
      return `The message of ${row.commit.shortId} cannot be empty`;
    }
  }
  return null;
}

/** The todo for the backend, oldest first; only the message-carrying rows send a message. */
export function rebaseEntries(rows: RebaseRow[]): RebaseEntry[] {
  return rows.map((row, index) => {
    const carries = row.action === "reword" || isMessageSquash(rows, index);
    return { action: row.action, commitId: row.commit.id, message: carries ? `${row.message.trimEnd()}\n` : null };
  });
}

/** "Rebasing 3 commits" and the button's summary of what changes. */
export function rebaseTitle(count: number): string {
  return count === 1 ? "Rebasing 1 commit" : `Rebasing ${count} commits`;
}
