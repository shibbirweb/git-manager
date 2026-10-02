// Items of the branch, stash and tag pickers opened from a repository row.

import type { LocalBranch, Refs, StashEntry } from "$lib/types";
import type { PickItem } from "$lib/ui/pickList";

export type RefPick =
  | { kind: "create" }
  | { kind: "createFrom" }
  | { kind: "local"; name: string }
  | { kind: "remote"; name: string }
  | { kind: "tag"; name: string };

const PREFIXES = ["local", "remote", "tag"] as const;

export function encodeRefPick(pick: RefPick): string {
  return pick.kind === "create" || pick.kind === "createFrom" ? pick.kind : `${pick.kind}:${pick.name}`;
}

export function decodeRefPick(value: string | null): RefPick | null {
  if (value === "create" || value === "createFrom") {
    return { kind: value };
  }
  for (const kind of PREFIXES) {
    if (value?.startsWith(`${kind}:`)) {
      return { kind, name: value.slice(kind.length + 1) };
    }
  }
  return null;
}

export interface RefPickOptions {
  local?: boolean;
  remote?: boolean;
  tags?: boolean;
  /** Leave out the checked-out branch (merge into it, delete it...). */
  skipCurrent?: boolean;
  /** List the checked-out branch, but disabled (Checkout to...). */
  disableCurrent?: boolean;
}

function localDescription(branch: LocalBranch): string | undefined {
  const parts = [branch.isHead ? "current" : null, branch.upstream, branch.shortId];
  const text = parts.filter((part): part is string => !!part).join("  ");
  return text || undefined;
}

/** Local branches, then remote branches, then tags, each under its heading. */
export function refPickItems(refs: Refs | null, options: RefPickOptions): PickItem[] {
  const items: PickItem[] = [];
  if (options.local ?? true) {
    for (const branch of refs?.local ?? []) {
      if (branch.isHead && options.skipCurrent) {
        continue;
      }
      items.push({
        value: encodeRefPick({ kind: "local", name: branch.name }),
        label: branch.name,
        description: localDescription(branch),
        group: "Branches",
        disabled: branch.isHead && options.disableCurrent,
      });
    }
  }
  if (options.remote ?? false) {
    for (const remoteBranch of refs?.remote ?? []) {
      items.push({
        value: encodeRefPick({ kind: "remote", name: remoteBranch.name }),
        label: remoteBranch.name,
        group: "Remote Branches",
      });
    }
  }
  if (options.tags ?? false) {
    for (const tagName of refs?.tags ?? []) {
      items.push({ value: encodeRefPick({ kind: "tag", name: tagName }), label: tagName, group: "Tags" });
    }
  }
  return items;
}

/** VS Code's Checkout to...: create entries first, then every branch and tag. */
export function checkoutPickItems(refs: Refs | null): PickItem[] {
  return [
    { value: encodeRefPick({ kind: "create" }), label: "+ Create Branch...", pinned: true },
    { value: encodeRefPick({ kind: "createFrom" }), label: "+ Create Branch From...", pinned: true },
    ...refPickItems(refs, { local: true, remote: true, tags: true, disableCurrent: true }),
  ];
}

export function stashPickItems(stashes: StashEntry[]): PickItem[] {
  return stashes.map((stash) => ({
    value: String(stash.index),
    label: stash.message || `stash@{${stash.index}}`,
    description: `stash@{${stash.index}}  ${stash.shortId}`,
  }));
}

/** The stash picked by `value`, or null (cancelled, or gone meanwhile). */
export function pickedStash(stashes: StashEntry[], value: string | null): StashEntry | null {
  if (value === null) {
    return null;
  }
  return stashes.find((stash) => String(stash.index) === value) ?? null;
}

export function tagPickItems(tags: string[]): PickItem[] {
  return tags.map((tagName) => ({ value: tagName, label: tagName }));
}

/** Git's ref name rules, roughly (git itself has the last word), plus no duplicates. */
export function validateTagName(tagName: string, existing: string[]): string | null {
  const invalid =
    tagName === "" ||
    /\s|\.\.|[~^:?*[\\]|@\{|\/\//.test(tagName) ||
    tagName.startsWith("-") ||
    tagName.startsWith("/") ||
    tagName.endsWith("/") ||
    tagName.endsWith(".") ||
    tagName.endsWith(".lock") ||
    tagName === "@";
  if (invalid) {
    return "Not a valid tag name";
  }
  return existing.includes(tagName) ? "A tag with this name already exists" : null;
}
