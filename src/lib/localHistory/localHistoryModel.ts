// Local History, the pure parts: what the editor asks to keep when a file reloads, how
// versions are named and grouped in the window, and the small texts around them.

import type { Eol, LocalHistoryRecord, LocalHistoryUsage, LocalSnapshot, SnapshotLabel } from "$lib/types";

/** Why an open file's text is replaced by what is on disk. */
export type ReloadReason = "external" | "revert";

/**
 * The versions to keep before an open file takes the text on disk. An outside change keeps
 * the text the editor had (when history does not have it yet, the backend skips repeats) and
 * the new text. File > Revert keeps the unsaved edits it throws away.
 */
export function reloadRecords(filePath: string, previousText: string, eol: Eol, reason: ReloadReason): LocalHistoryRecord[] {
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

/** The selection after a key press in the version list. */
export function movedSelection(count: number, current: number, key: string): number {
  if (count === 0) {
    return -1;
  }
  if (key === "ArrowDown") {
    return Math.min(count - 1, current + 1);
  }
  if (key === "ArrowUp") {
    return Math.max(0, current - 1);
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return count - 1;
  }
  return current;
}
