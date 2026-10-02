// Pure helpers for Git LFS: sizes for the diff view, pattern checks and file lookups.

import type { LfsDiff, LfsStatus } from "$lib/types";

const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** 1536 -> "1.5 KB"; whole bytes below 1 KB. */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "";
  }
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  if (unit === 0) {
    return `${bytes} B`;
  }
  const rounded = value >= 100 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, "");
  return `${rounded} ${UNITS[unit]}`;
}

/** "1.5 KB -> 2 MB", "Added: 2 MB" or "Deleted: 1.5 KB" for an LFS diff. */
export function lfsSizeText(diff: LfsDiff): string {
  const before = diff.originalSize;
  const after = diff.modifiedSize;
  if (before === null && after !== null) {
    return `Added: ${formatSize(after)}`;
  }
  if (before !== null && after === null) {
    return `Deleted: ${formatSize(before)}`;
  }
  if (before !== null && after !== null) {
    return before === after ? `Size: ${formatSize(after)}` : `${formatSize(before)} -> ${formatSize(after)}`;
  }
  return "";
}

/** Whether the content changed: different object ids when both sides are pointers, else sizes. */
export function lfsContentChanged(diff: LfsDiff): boolean {
  if (diff.originalOid !== null && diff.modifiedOid !== null) {
    return diff.originalOid !== diff.modifiedOid;
  }
  return true;
}

export function validateLfsPattern(pattern: string): string | null {
  const trimmed = pattern.trim();
  if (trimmed === "") {
    return "Enter a pattern, for example *.psd";
  }
  if (trimmed.startsWith("-")) {
    return "A pattern cannot start with '-'";
  }
  if (/\s/.test(trimmed)) {
    return "Use a pattern without spaces";
  }
  return null;
}

const fileSets = new WeakMap<LfsStatus, Set<string>>();

/** The LFS files of a status as a set (built once per status object). */
export function lfsFileSet(status: LfsStatus | null | undefined): Set<string> {
  if (!status) {
    return new Set();
  }
  let set = fileSets.get(status);
  if (!set) {
    set = new Set(status.files ?? []);
    fileSets.set(status, set);
  }
  return set;
}

/** Git LFS is used here but not installed: the files are only pointers. */
export function needsLfsInstall(status: LfsStatus | null | undefined): boolean {
  return status !== null && status !== undefined && status.used && status.version === null;
}
