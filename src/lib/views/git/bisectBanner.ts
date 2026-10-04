// The bisect banner's text and the Log's bisect badges, from the state git keeps for a
// `git bisect` (git/bisect.rs). Pure, so the wording is tested.

import type { BisectState } from "$lib/types";

/** "about 3 steps left": git's own estimate, never below one while commits are left. */
function stepsText(steps: number): string {
  const count = Math.max(1, steps);
  return count === 1 ? "about 1 step left" : `about ${count} steps left`;
}

/** "a bad", "an old": custom terms may start with a vowel. */
function withArticle(term: string): string {
  return /^[aeiou]/i.test(term) ? `an ${term}` : `a ${term}`;
}

export function bisectBannerText(state: BisectState): string {
  if (state.firstBad) {
    const summary = state.firstBad.summary ? ` ${state.firstBad.summary}` : "";
    return `Found the first ${state.badTerm} commit: ${state.firstBad.shortId}${summary}`;
  }
  if (state.bad === null && state.good.length === 0) {
    return `Bisecting: mark ${withArticle(state.badTerm)} and ${withArticle(state.goodTerm)} commit`;
  }
  if (state.bad === null) {
    return `Bisecting: mark ${withArticle(state.badTerm)} commit`;
  }
  if (state.good.length === 0) {
    return `Bisecting: mark ${withArticle(state.goodTerm)} commit`;
  }
  if (state.remainingCapped) {
    return "Bisecting: many commits left to test";
  }
  const toTest = Math.max(0, state.remaining - 1);
  const commits = toTest === 1 ? "1 commit" : `${toTest} commits`;
  return `Bisecting: ${stepsText(state.steps)} (${commits} to test)`;
}

export type BisectBadgeKind = "bad" | "good" | "skip" | "current";

export interface BisectBadge {
  kind: BisectBadgeKind;
  label: string;
}

/** Badges for the Log rows: the bad commit, the good ones, the skipped ones and the one under test. */
export function bisectBadges(state: BisectState | null): Map<string, BisectBadge[]> {
  const badges = new Map<string, BisectBadge[]>();
  if (!state) {
    return badges;
  }
  const add = (commitId: string | null, badge: BisectBadge) => {
    if (commitId) {
      badges.set(commitId, [...(badges.get(commitId) ?? []), badge]);
    }
  };
  add(state.firstBad?.id ?? null, { kind: "bad", label: `first ${state.badTerm}` });
  if (state.bad !== state.firstBad?.id) {
    add(state.bad, { kind: "bad", label: state.badTerm });
  }
  for (const commitId of state.good) {
    add(commitId, { kind: "good", label: state.goodTerm });
  }
  for (const commitId of state.skipped) {
    add(commitId, { kind: "skip", label: "skipped" });
  }
  if (!state.firstBad) {
    add(state.current, { kind: "current", label: "testing" });
  }
  return badges;
}
