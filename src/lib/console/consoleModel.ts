// The Git Console's list: merging entries from the backend and its events, the filter, and the
// text shown and copied. Pure, so it is tested; the list itself is the UI library's List.

import type { GitCommandEntry } from "$lib/types";

/** As many as the backend keeps (git_console.rs). */
export const MAX_CONSOLE_ENTRIES = 500;

export type EntryStatus = "running" | "success" | "failed";

export function statusOf(entry: GitCommandEntry): EntryStatus {
  if (entry.running) {
    return "running";
  }
  return entry.success ? "success" : "failed";
}

/** Adds or replaces `entry` (an event), keeping the list ordered by id and capped. */
export function upsertEntry(
  entries: GitCommandEntry[],
  entry: GitCommandEntry,
  max = MAX_CONSOLE_ENTRIES,
): GitCommandEntry[] {
  const last = entries[entries.length - 1];
  let next: GitCommandEntry[];
  if (!last || entry.id > last.id) {
    next = [...entries, entry];
  } else {
    const index = entries.findIndex((existing) => existing.id === entry.id);
    if (index >= 0) {
      // A late "started" event never replaces the finished entry.
      if (entry.running && !entries[index].running) {
        return entries;
      }
      next = entries.slice();
      next[index] = entry;
    } else {
      next = [...entries, entry].sort((left, right) => left.id - right.id);
    }
  }
  return next.length > max ? next.slice(next.length - max) : next;
}

/** The backend's list merged with events that arrived while it loaded. */
export function mergeEntries(
  loaded: GitCommandEntry[],
  received: GitCommandEntry[],
  max = MAX_CONSOLE_ENTRIES,
): GitCommandEntry[] {
  let merged = [...(loaded ?? [])].sort((left, right) => left.id - right.id);
  for (const entry of received) {
    merged = upsertEntry(merged, entry, Number.MAX_SAFE_INTEGER);
  }
  return merged.length > max ? merged.slice(merged.length - max) : merged;
}

const SAFE_ARG = /^[\w@%+=:,./^~-]+$/;

/** One argument as a shell would need it, for Copy Command. */
export function quoteArg(arg: string): string {
  if (arg !== "" && SAFE_ARG.test(arg)) {
    return arg;
  }
  return `'${arg.replaceAll("'", "'\\''")}'`;
}

/** "git <args>", quoted so it can be pasted into a terminal. */
export function commandText(entry: GitCommandEntry): string {
  return ["git", ...(entry.args ?? []).map(quoteArg)].join(" ");
}

export function repoName(repoPath: string): string {
  const trimmed = repoPath.replace(/\/+$/, "");
  return trimmed.slice(trimmed.lastIndexOf("/") + 1) || trimmed;
}

export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return "";
  }
  if (durationMs < 1000) {
    return `${Math.max(0, Math.round(durationMs))} ms`;
  }
  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 2 : 1)} s`;
  }
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/** The local time of day, "14:03:27". */
export function formatTime(startedAt: number): string {
  const date = new Date(startedAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Case-insensitive match on the command and the repository name; every word must match. */
export function matchesFilter(entry: GitCommandEntry, filter: string): boolean {
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return true;
  }
  const haystack = `${commandText(entry)} ${repoName(entry.repoPath)}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export interface OutputBlock {
  kind: "stdout" | "stderr" | "error" | "note";
  text: string;
}

/** What an open entry shows below its row. */
export function outputBlocks(entry: GitCommandEntry): OutputBlock[] {
  const blocks: OutputBlock[] = [];
  const stdout = (entry.stdout ?? "").replace(/\s+$/, "");
  const stderr = (entry.stderr ?? "").replace(/\s+$/, "");
  if (stdout) {
    blocks.push({ kind: "stdout", text: stdout });
  }
  if (entry.stdoutTruncated) {
    blocks.push({ kind: "note", text: "(output cut: only the start is kept)" });
  }
  if (stderr) {
    blocks.push({ kind: "stderr", text: stderr });
  }
  if (entry.stderrTruncated) {
    blocks.push({ kind: "note", text: "(error output cut: only the start is kept)" });
  }
  if (entry.error) {
    blocks.push({ kind: "error", text: entry.error });
  }
  if (blocks.length === 0) {
    blocks.push({ kind: "note", text: entry.running ? "Running..." : "No output" });
  }
  return blocks;
}
