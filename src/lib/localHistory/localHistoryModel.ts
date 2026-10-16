// Local History, the pure parts: what the editor asks to keep when a file reloads, how
// versions are named and grouped in the window, and the small texts around them.

import { fullDate } from "$lib/log/format";
import type { Eol, LocalHistoryRecord, LocalHistoryUsage, LocalSnapshot, SnapshotLabel } from "$lib/types";

/** Why an open file's text is replaced by what is on disk. */
export type ReloadReason = "external" | "revert";

/**
 * The versions to keep before an open file takes the text on disk. An outside change keeps
 * the text the editor had (when history does not have it yet, the backend skips repeats) and
 * the new text. File > Revert keeps the unsaved edits it throws away.
 */
export function reloadRecords(
  filePath: string,
  previousText: string,
  eol: Eol,
  reason: ReloadReason,
): LocalHistoryRecord[] {
  if (reason === "revert") {
    return [{ filePath, text: previousText, eol, label: "beforeRevert" }];
  }
  return [
    { filePath, text: previousText, eol, label: "beforeExternalChange" },
    { filePath, text: null, eol: null, label: "externalChange" },
  ];
}

const LABELS: Record<SnapshotLabel, string> = {
  saved: "Saved",
  beforeSave: "Before save",
  externalChange: "External change",
  beforeExternalChange: "Before external change",
  beforeDiscard: "Before discard",
  beforeRollback: "Before rollback",
  beforeRevert: "Before revert",
  other: "Saved by a newer version",
};

export function snapshotLabel(label: SnapshotLabel): string {
  return LABELS[label] ?? LABELS.other;
}

/** Versions kept before something replaced the text are marked so they stand out. */
export function isSafetyCopy(label: SnapshotLabel): boolean {
  return label === "beforeDiscard" || label === "beforeRollback" || label === "beforeRevert";
}

export interface SnapshotGroup {
  /** "Today", "Yesterday" or a date. */
  title: string;
  snapshots: LocalSnapshot[];
}

function dayStart(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function dayTitle(time: number, nowMs: number): string {
  const days = Math.round((dayStart(nowMs) - dayStart(time)) / 86_400_000);
  if (days === 0) {
    return "Today";
  }
  if (days === 1) {
    return "Yesterday";
  }
  return dayFormat.format(new Date(time));
}

/** Snapshots (newest first) under one heading per day, keeping their order. */
export function groupByDay(snapshots: readonly LocalSnapshot[], nowMs: number): SnapshotGroup[] {
  const groups: SnapshotGroup[] = [];
  for (const snapshot of snapshots) {
    const title = dayTitle(snapshot.time, nowMs);
    const last = groups[groups.length - 1];
    if (last && last.title === title) {
      last.snapshots.push(snapshot);
    } else {
      groups.push({ title, snapshots: [snapshot] });
    }
  }
  return groups;
}

export function timeText(time: number): string {
  return timeFormat.format(new Date(time));
}

export function sizeText(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1)} KB`;
  }
  return `${bytes} B`;
}

export function usageText(usage: LocalHistoryUsage | null): string {
  if (!usage) {
    return "";
  }
  if (usage.snapshots === 0) {
    return "Nothing kept yet.";
  }
  const versions = `${usage.snapshots} ${usage.snapshots === 1 ? "version" : "versions"}`;
  const files = `${usage.files} ${usage.files === 1 ? "file" : "files"}`;
  return `${versions} of ${files}, ${sizeText(usage.bytes)} on disk.`;
}

/** A row of the version list: a day heading, or a version under it. */
export type VersionRow =
  { kind: "day"; key: string; title: string } | { kind: "version"; key: string; snapshot: LocalSnapshot };

/** The versions under their day headings ("Today", "Yesterday", a date), newest first as given. */
export function versionRows(snapshots: readonly LocalSnapshot[], nowMs: number): VersionRow[] {
  return groupByDay(snapshots, nowMs).flatMap((group): VersionRow[] => [
    { kind: "day", key: `day:${group.title}`, title: group.title },
    ...group.snapshots.map((snapshot) => ({ kind: "version" as const, key: versionKey(snapshot), snapshot })),
  ]);
}

/** A version's row key; its hash comes first, so `versionHash` reads it back. */
export function versionKey(snapshot: LocalSnapshot): string {
  return `${snapshot.hash}:${snapshot.time}`;
}

export function versionHash(key: string): string {
  return key.slice(0, key.lastIndexOf(":"));
}

/** A version's tooltip: what kept it, when, and its size. */
export function snapshotTitle(snapshot: LocalSnapshot): string {
  return `${snapshotLabel(snapshot.label)}, ${fullDate(Math.floor(snapshot.time / 1000))}, ${sizeText(snapshot.size)}`;
}
