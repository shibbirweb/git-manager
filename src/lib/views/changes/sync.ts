// The Sync Changes button under the commit box:
// pull what the remote has, then push what you have; or publish a new branch.

import type { HeadInfo } from "$lib/types";

export type SyncPlan =
  | { kind: "none" }
  | { kind: "publish"; branch: string }
  | { kind: "sync"; pull: number; push: number; upstream: string };

export function syncPlan(head: HeadInfo | null | undefined): SyncPlan {
  if (!head || head.unborn || !head.branch) {
    return { kind: "none" };
  }
  if (!head.upstream) {
    return { kind: "publish", branch: head.branch };
  }
  if (head.ahead === 0 && head.behind === 0) {
    return { kind: "none" };
  }
  return { kind: "sync", pull: head.behind, push: head.ahead, upstream: head.upstream };
}

function commits(count: number): string {
  return count === 1 ? "1 commit" : `${count} commits`;
}

/** The button's tooltip, saying exactly what a click does. */
export function syncTooltip(plan: SyncPlan): string {
  if (plan.kind === "publish") {
    return `Push ${plan.branch} to the remote and track it`;
  }
  if (plan.kind === "none") {
    return "";
  }
  const parts = [
    plan.pull > 0 ? `pull ${commits(plan.pull)} from ${plan.upstream}` : null,
    plan.push > 0 ? `push ${commits(plan.push)} to ${plan.upstream}` : null,
  ].filter((part): part is string => part !== null);
  const text = parts.join(", then ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The toast after a sync: "Pulled 2 commits and pushed 1". */
export function syncDoneMessage(pulled: number, pushed: number): string {
  if (pulled > 0 && pushed > 0) {
    return `Pulled ${commits(pulled)} and pushed ${pushed}`;
  }
  if (pulled > 0) {
    return `Pulled ${commits(pulled)}`;
  }
  return pushed > 0 ? `Pushed ${commits(pushed)}` : "Already in sync";
}

/**
 * The Sync button of a repository row: hidden without a branch, Publish Branch
 * without an upstream, else Sync Changes, shown even when in step (a click then
 * pulls whatever the remote has).
 */
export type RowSync =
  | { kind: "hidden" }
  | { kind: "publish"; branch: string }
  | { kind: "sync"; pull: number; push: number; upstream: string };

export function rowSync(head: HeadInfo | null | undefined): RowSync {
  if (!head || head.unborn || !head.branch) {
    return { kind: "hidden" };
  }
  if (!head.upstream) {
    return { kind: "publish", branch: head.branch };
  }
  return { kind: "sync", pull: head.behind, push: head.ahead, upstream: head.upstream };
}

export function rowSyncTooltip(sync: RowSync): string {
  if (sync.kind === "hidden") {
    return "";
  }
  if (sync.kind === "publish") {
    return `Publish Branch: push ${sync.branch} to the remote and track it`;
  }
  if (sync.pull === 0 && sync.push === 0) {
    return `Sync Changes: pull from ${sync.upstream}, then push`;
  }
  return syncTooltip({ kind: "sync", pull: sync.pull, push: sync.push, upstream: sync.upstream });
}

/** The small count next to the Sync icon, e.g. "2↓ 1↑"; empty when in step. */
export function rowSyncBadge(sync: RowSync): string {
  if (sync.kind !== "sync") {
    return "";
  }
  const parts = [sync.pull > 0 ? `${sync.pull}↓` : null, sync.push > 0 ? `${sync.push}↑` : null];
  return parts.filter((part) => part !== null).join(" ");
}
