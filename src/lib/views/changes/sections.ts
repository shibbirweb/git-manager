// Pure helpers that turn per-repository statuses into the sections, rows and
// labels of the Changes view.

import type { DiffArea, FileStatus, HeadInfo, OpKind, RepoInfo, RepoStatus } from "$lib/types";
import type { FileSelection, GroupId } from "./fileStatus";

export interface FileGroups {
  conflicts: FileStatus[];
  staged: FileStatus[];
  unstaged: FileStatus[];
}

export interface RepoSection extends FileGroups {
  repo: RepoInfo;
  /** Null while the first status of this repository is loading. */
  status: RepoStatus | null;
  changeCount: number;
}

export type HiddenGroup = (repoRoot: string, group: GroupId) => boolean;

const EMPTY_GROUPS: FileGroups = {
  conflicts: [],
  staged: [],
  unstaged: [],
};

// Statuses are replaced per repository, so unchanged repositories keep their
// status object and reuse the grouped lists (and section) computed before.
const groupCache = new WeakMap<RepoStatus, FileGroups>();
const sectionCache = new WeakMap<RepoStatus, RepoSection>();

export function groupFiles(status: RepoStatus | null): FileGroups {
  if (!status) {
    return EMPTY_GROUPS;
  }
  const cached = groupCache.get(status);
  if (cached) {
    return cached;
  }
  const groups: FileGroups = {
    conflicts: [],
    staged: [],
    unstaged: [],
  };
  for (const file of status.files ?? []) {
    if (file.conflicted) {
      groups.conflicts.push(file);
      continue;
    }
    if (file.staged !== null) {
      groups.staged.push(file);
    }
    if (file.unstaged !== null) {
      groups.unstaged.push(file);
    }
  }
  groupCache.set(status, groups);
  return groups;
}

export function buildSection(repo: RepoInfo, status: RepoStatus | null): RepoSection {
  if (status) {
    const cached = sectionCache.get(status);
    if (cached && cached.repo === repo) {
      return cached;
    }
  }
  const section: RepoSection = {
    repo,
    status,
    ...groupFiles(status),
    changeCount: status?.files?.length ?? 0,
  };
  if (status) {
    sectionCache.set(status, section);
  }
  return section;
}

/** One section per repository, in repository order. */
export function buildSections(repos: RepoInfo[], statuses: Record<string, RepoStatus>): RepoSection[] {
  return repos.map((repo) => buildSection(repo, statuses[repo.root] ?? null));
}

/** Sections with changes, and the rest (clean or still loading). */
export function splitSections(sections: RepoSection[]): { changed: RepoSection[]; clean: RepoSection[] } {
  const changed: RepoSection[] = [];
  const clean: RepoSection[] = [];
  for (const section of sections) {
    if (section.changeCount > 0) {
      changed.push(section);
    } else {
      clean.push(section);
    }
  }
  return { changed, clean };
}

/** Selectable rows (staged, then unstaged) in display order, skipping hidden groups. */
export function selectableRows(sections: RepoSection[], hidden?: HiddenGroup): FileSelection[] {
  const rows: FileSelection[] = [];
  for (const section of sections) {
    const repoRoot = section.repo.root;
    for (const area of ["staged", "unstaged"] as const) {
      if (hidden?.(repoRoot, area)) {
        continue;
      }
      for (const file of section[area]) {
        rows.push({ repoRoot, path: file.path, area });
      }
    }
  }
  return rows;
}

export function findSection(sections: RepoSection[], repoRoot: string): RepoSection | null {
  return sections.find((section) => section.repo.root === repoRoot) ?? null;
}

export function findFile(sections: RepoSection[], selection: FileSelection): FileStatus | null {
  const section = findSection(sections, selection.repoRoot);
  if (!section) {
    return null;
  }
  return section[selection.area].find((file) => file.path === selection.path) ?? null;
}

export function otherArea(area: DiffArea): DiffArea {
  return area === "staged" ? "unstaged" : "staged";
}

/**
 * Keeps a selection valid after a status change: the same row, else the same
 * file in the other area (it was staged or unstaged), else the row nearest to
 * `lastIndex`, preferring rows of the same repository.
 */
export function resolveSelection(
  current: FileSelection | null,
  sections: RepoSection[],
  rows: FileSelection[],
  lastIndex: number,
): FileSelection | null {
  if (current && findFile(sections, current)) {
    return current;
  }
  if (current) {
    const moved: FileSelection = { ...current, area: otherArea(current.area) };
    if (findFile(sections, moved)) {
      return moved;
    }
  }
  if (rows.length === 0) {
    return null;
  }
  const target = Math.max(0, Math.min(lastIndex, rows.length - 1));
  if (!current || rows[target].repoRoot === current.repoRoot) {
    return rows[target];
  }
  let best = -1;
  for (let index = 0; index < rows.length; index++) {
    if (rows[index].repoRoot !== current.repoRoot) {
      continue;
    }
    if (best < 0 || Math.abs(index - target) < Math.abs(best - target)) {
      best = index;
    }
  }
  return rows[best < 0 ? target : best];
}

export function branchLabel(head: HeadInfo | null | undefined): string {
  if (!head) {
    return "";
  }
  if (head.branch) {
    return head.branch;
  }
  return head.shortId ? `detached at ${head.shortId}` : "detached";
}

const opLabels: Record<OpKind, string | null> = {
  none: null,
  merge: "Merging",
  rebase: "Rebasing",
  cherryPick: "Cherry-picking",
  revert: "Reverting",
  other: "In progress",
};

export function opLabel(kind: OpKind | null | undefined): string | null {
  return kind ? (opLabels[kind] ?? null) : null;
}

/** The relative path is worth showing next to the name. */
export function showRelativePath(repo: RepoInfo): boolean {
  return repo.relativePath !== "" && repo.relativePath !== repo.name;
}

/** Path shown in the diff toolbar: prefixed with the repository when there are several. */
export function displayPath(repo: RepoInfo | null, filePath: string, multiRepo: boolean): string {
  if (!multiRepo || !repo) {
    return filePath;
  }
  const prefix = repo.relativePath || repo.name;
  return prefix ? `${prefix}/${filePath}` : filePath;
}

/** Repository a commit goes to: the preferred one, else the active one, else the first. */
export function resolveCommitTarget(
  repos: RepoInfo[],
  preferredRoot: string | null,
  activeRoot: string | null,
): RepoInfo | null {
  return (
    repos.find((repo) => repo.root === preferredRoot) ??
    repos.find((repo) => repo.root === activeRoot) ??
    repos[0] ??
    null
  );
}

/** Repositories offered in the commit target picker: those with changes, plus the current target. */
export function commitChoices(sections: RepoSection[], targetRoot: string | null): RepoSection[] {
  return sections.filter((section) => section.changeCount > 0 || section.repo.root === targetRoot);
}

export function groupKey(repoRoot: string, group: GroupId): string {
  return `${repoRoot}\n${group}`;
}
