// Notification text for git operations: titles that name the branch and where it went, and a short detail read
// from git's own output (the ref lines of fetch and push, Updating a..b, the files changed), so a list of pushes
// and pulls across repositories tells each one apart. Pure; gitActions.ts and repoStore.runOp use it.

import type { GitOutput, HeadInfo, OpKind, OpState } from "$lib/types";

/** One `<flag> <summary> <from> -> <to>` line of git fetch or push. */
export interface RefUpdate {
  /** " " fast-forward, "+" forced, "*" new, "-" deleted, "t" tag moved, "!" rejected, "=" unchanged. */
  flag: string;
  /** a1b2c3d..e4f5g6h, or a bracketed word such as [new branch] or [deleted]. */
  summary: string;
  from: string;
  to: string;
  /** git's words in parentheses, such as (fetch first). */
  reason: string | null;
}

export interface OpReport {
  title: string;
  detail: string | null;
  /** "info" when nothing changed (already up to date), so it reads as news, not as work done. */
  kind: "success" | "info";
}

/** Ref lines shown before "and N more". */
export const MAX_REF_LINES = 6;

const REF_LINE = /^ ([ +*\-t!=]) (\S+(?: \S+)?\]|\S+)\s+(\S+)\s+->\s+(\S+)(?:\s+\((.+)\))?\s*$/;
const COMMIT_LINE = /^\[(\S+)(?: \([^)]*\))? ([0-9a-f]{7,40})\] (.+)$/;

function lines(output: string): string[] {
  // Progress such as "Rebasing (1/2)" ends in a carriage return, not a newline.
  return output.split(/\r\n|\r|\n/);
}

export function refUpdates(output: string): RefUpdate[] {
  const updates: RefUpdate[] = [];
  for (const line of lines(output)) {
    const match = REF_LINE.exec(line);
    if (match) {
      updates.push({ flag: match[1], summary: match[2], from: match[3], to: match[4], reason: match[5] ?? null });
    }
  }
  return updates;
}

function refLine(update: RefUpdate): string | null {
  const kind = /\[new (branch|tag|ref)\]/.exec(update.summary)?.[1] ?? null;
  switch (update.flag) {
    case "*":
      return `New ${kind ?? "ref"} ${update.to}`;
    case "-":
      return `Deleted ${update.to}`;
    case "+":
      return `${update.to}: ${update.summary} (forced)`;
    case "t":
      return `Moved tag ${update.to}`;
    case "!":
      return `Rejected ${update.to}${update.reason ? ` (${update.reason})` : ""}`;
    case "=":
      return null;
    default:
      return `${update.to}: ${update.summary}`;
  }
}

/** Whether git said there was nothing to do. */
export function upToDate(output: string): boolean {
  return /^(Already up to date\.?|Everything up-to-date|Current branch \S+ is up to date\.?)$/m.test(output);
}

/** The lines worth keeping from git's output, one fact each; null when it said nothing useful. */
export function outputSummary(output: string): string | null {
  const facts: string[] = [];
  const updates = refUpdates(output)
    .map(refLine)
    .filter((line): line is string => line !== null);
  facts.push(...updates.slice(0, MAX_REF_LINES));
  if (updates.length > MAX_REF_LINES) {
    facts.push(`and ${updates.length - MAX_REF_LINES} more`);
  }
  for (const line of lines(output).map((text) => text.trim())) {
    const commit = COMMIT_LINE.exec(line);
    const updating = /^Updating ([0-9a-f]+\.\.[0-9a-f]+)$/.exec(line);
    const tracking = /set up to track '([^']+)'/.exec(line);
    if (commit) {
      facts.push(`${commit[2].slice(0, 7)} ${commit[3]}`);
    } else if (updating) {
      // A pull's fetch line usually shows the same range already.
      if (!facts.some((fact) => fact.includes(updating[1]))) {
        facts.push(updating[1]);
      }
    } else if (line === "Fast-forward") {
      facts.push("Fast-forward");
    } else if (/^Merge made by/.test(line)) {
      facts.push("Made a merge commit");
    } else if (/^Successfully rebased/.test(line)) {
      facts.push("Rebased");
    } else if (/^\d+ files? changed/.test(line)) {
      facts.push(line);
    } else if (tracking) {
      facts.push(`Tracks ${tracking[1]}`);
    }
  }
  return facts.length > 0 ? facts.join("\n") : null;
}

/** The remote a branch's upstream lives on: origin for origin/main. */
export function upstreamRemote(head: HeadInfo | null): string | null {
  const upstream = head?.upstream ?? null;
  if (!upstream || !upstream.includes("/")) {
    return null;
  }
  return upstream.slice(0, upstream.indexOf("/"));
}

function commits(count: number): string {
  return count === 1 ? "1 commit" : `${count} commits`;
}

function branchOf(head: HeadInfo | null): string {
  return head?.branch ?? "HEAD";
}

/** Fetch: which remote, and what it brought. */
export function fetchReport(output: string, head: HeadInfo | null, allRemotes: boolean, prune = false): OpReport {
  const where = allRemotes ? "all remotes" : (upstreamRemote(head) ?? "the remote");
  const detail = outputSummary(output);
  if (refUpdates(output).every((update) => update.flag === "=")) {
    return { title: `Fetched ${where}: nothing new`, detail, kind: "info" };
  }
  return { title: `Fetched ${where}${prune ? " and pruned" : ""}`, detail, kind: "success" };
}

/** Pull: from which upstream into which branch, or that it was up to date already. */
export function pullReport(output: string, head: HeadInfo | null, rebase = false): OpReport {
  const branch = branchOf(head);
  const upstream = head?.upstream ?? null;
  const detail = outputSummary(output);
  if (upToDate(output)) {
    return {
      title: upstream ? `${branch} is up to date with ${upstream}` : `${branch} is up to date`,
      detail,
      kind: "info",
    };
  }
  const from = upstream ? `${upstream} into ${branch}` : `into ${branch}`;
  return { title: `Pulled ${from}${rebase ? " with rebase" : ""}`, detail, kind: "success" };
}

/** Push: how many commits of which branch went where; a first push names the new upstream. */
export function pushReport(output: string, head: HeadInfo | null, force = false): OpReport {
  const branch = branchOf(head);
  const tracking = /set up to track '([^']+)'/.exec(output)?.[1] ?? null;
  const upstream = head?.upstream ?? tracking;
  const detail = outputSummary(output);
  if (upToDate(output)) {
    return {
      title: upstream ? `${branch} is up to date on ${upstream}` : `${branch} is up to date`,
      detail,
      kind: "info",
    };
  }
  const to = upstream ? ` to ${upstream}` : "";
  if (force) {
    return { title: `Force pushed ${branch}${to}`, detail, kind: "success" };
  }
  const ahead = head?.upstream ? head.ahead : 0;
  const what = ahead > 0 ? `${commits(ahead)} of ${branch}` : branch;
  return { title: `Pushed ${what}${to}`, detail, kind: "success" };
}

/** Publish: the new branch and the upstream git set up for it. */
export function publishTitle(branchName: string, output: string): string {
  const tracking = /set up to track '([^']+)'/.exec(output)?.[1] ?? null;
  return tracking ? `Published ${branchName} to ${tracking}` : `Published ${branchName}`;
}

/** Commit: on which branch, and the new commit's id and subject with the files it changed. */
export function commitReport(output: GitOutput, branchName: string | null, amend: boolean): OpReport {
  const on = branchName ? ` on ${branchName}` : "";
  return {
    title: amend ? `Amended the last commit${on}` : `Committed${on}`,
    detail: outputSummary(`${output.stdout}\n${output.stderr}`),
    kind: "success",
  };
}

/** Push tags: which remote, and the tags it did not have. */
export function pushTagsReport(output: string, head: HeadInfo | null): OpReport {
  const remote = upstreamRemote(head) ?? "the remote";
  if (upToDate(output)) {
    return { title: `${remote} has every tag already`, detail: null, kind: "info" };
  }
  return { title: `Pushed tags to ${remote}`, detail: outputSummary(output), kind: "success" };
}

/** Sync: the branch and its upstream, with how many commits went each way. */
export function syncReport(head: HeadInfo | null, pulled: number, pushed: number): OpReport {
  const branch = branchOf(head);
  const upstream = head?.upstream ?? null;
  const parts: string[] = [];
  if (pulled > 0) {
    parts.push(`pulled ${commits(pulled)}`);
  }
  if (pushed > 0) {
    parts.push(`pushed ${commits(pushed)}`);
  }
  if (parts.length === 0) {
    return {
      title: upstream ? `${branch} is in sync with ${upstream}` : `${branch} is in sync`,
      detail: null,
      kind: "info",
    };
  }
  return {
    title: upstream ? `Synced ${branch} with ${upstream}` : `Synced ${branch}`,
    detail: `${parts.join(", ").charAt(0).toUpperCase()}${parts.join(", ").slice(1)}`,
    kind: "success",
  };
}

const OPERATION_NAMES: Record<OpKind, string> = {
  none: "operation",
  merge: "merge",
  rebase: "rebase",
  cherryPick: "cherry-pick",
  revert: "revert",
  other: "operation",
};

/** Continue or Abort: which operation on which branch, with git's own description of it. */
export function operationReport(verb: "Finished" | "Aborted", op: OpState | null, head: HeadInfo | null): OpReport {
  const name = OPERATION_NAMES[op?.kind ?? "none"];
  const on = head?.branch ? ` on ${head.branch}` : "";
  return { title: `${verb} the ${name}${on}`, detail: op?.description || null, kind: "success" };
}
