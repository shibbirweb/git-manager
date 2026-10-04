// Back / forward location history across files, like VS Code's Go Back / Go
// Forward. Small cursor moves update the current location in place; opening
// another file or jumping far records a new entry.

import { isPseudoTab } from "./pseudoTabs";

/** A spot in a file tab. */
export interface FileLocation {
  kind?: "file";
  /** Absolute file path (see workspacePaths.ts). */
  filePath: string;
  /** 0-based line. */
  line: number;
}

/** The Log showing a commit, e.g. after clicking a blame note. */
export interface LogLocation {
  kind: "log";
  repoRoot: string;
  commitId: string;
  /** Repo-relative file whose diff was opened in the commit details. */
  filePath: string | null;
  /** 0-based line in that file's diff, to scroll back to. */
  line?: number;
  /** Text of the line, e.g. the blamed one, to find it again when `line` is only a guess. */
  lineText?: string;
}

/** The Changes diff of one file. */
export interface DiffLocation {
  kind: "diff";
  repoRoot: string;
  /** Repo-relative path. */
  path: string;
  area: "staged" | "unstaged";
  /** 0-based line on the right side of the diff. */
  line: number;
}

export type NavLocation = FileLocation | LogLocation | DiffLocation;

function isFile(location: NavLocation): location is FileLocation {
  return location.kind === undefined || location.kind === "file";
}

/** Whether `next` only refines `current` (same place) instead of being a new jump. */
function sameSpot(current: NavLocation, next: NavLocation): boolean {
  if (current.kind === "log" || next.kind === "log") {
    return (
      current.kind === "log" &&
      next.kind === "log" &&
      current.repoRoot === next.repoRoot &&
      current.commitId === next.commitId &&
      (current.filePath === next.filePath || current.filePath === null || next.filePath === null)
    );
  }
  if (current.kind === "diff" || next.kind === "diff") {
    return (
      current.kind === "diff" &&
      next.kind === "diff" &&
      current.repoRoot === next.repoRoot &&
      current.path === next.path &&
      current.area === next.area &&
      Math.abs(current.line - next.line) < JUMP_LINES
    );
  }
  return current.filePath === next.filePath && Math.abs(current.line - next.line) < JUMP_LINES;
}

/**
 * The entry that replaces `current` when `next` is the same spot. A Log step
 * without a file (just the commit) keeps the file and line already recorded.
 */
function refine(current: NavLocation, next: NavLocation): NavLocation {
  if (current.kind === "log" && next.kind === "log" && next.filePath === null && current.filePath !== null) {
    return current;
  }
  return next;
}

/** How showing a history stop went: shown, cancelled by the user, or no longer there. */
export type StopOutcome = "shown" | "cancelled" | "gone";

/** True for the error of reading a file that does not exist (ENOENT is error 2 on every platform). */
export function isMissingFileError(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  return /\(os error 2\)/.test(message);
}

/** Cursor moves shorter than this stay in the same history entry. */
export const JUMP_LINES = 10;
export const MAX_ENTRIES = 50;

export class NavigationHistory {
  back: NavLocation[] = [];
  forward: NavLocation[] = [];
  current: NavLocation | null = null;

  /** Records the cursor position; returns true when a new entry was created. */
  record(location: NavLocation): boolean {
    // A tab that is not a file (a commit or a terminal) is never a stop to go back to.
    if (location.kind !== "log" && location.kind !== "diff" && isPseudoTab(location.filePath)) {
      return false;
    }
    const current = this.current;
    if (current && sameSpot(current, location)) {
      this.current = refine(current, location);
      return false;
    }
    if (current) {
      this.back.push(current);
      if (this.back.length > MAX_ENTRIES) {
        this.back.shift();
      }
    }
    this.forward = [];
    this.current = location;
    return true;
  }

  goBack(): NavLocation | null {
    const target = this.back.pop();
    if (!target) {
      return null;
    }
    if (this.current) {
      this.forward.push(this.current);
    }
    this.current = target;
    return target;
  }

  goForward(): NavLocation | null {
    const target = this.forward.pop();
    if (!target) {
      return null;
    }
    if (this.current) {
      this.back.push(this.current);
    }
    this.current = target;
    return target;
  }

  /**
   * Goes one step back or forward with `show`. Stops that are gone are
   * dropped (with every other stop of a missing file) and the next one is
   * tried; a cancelled step leaves the history as it was. Returns the stop
   * shown, or null.
   */
  async travel(direction: "back" | "forward", show: (target: NavLocation) => Promise<StopOutcome>): Promise<NavLocation | null> {
    for (;;) {
      const before = { back: this.back.slice(), forward: this.forward.slice(), current: this.current };
      // Move first so locations recorded while the stop opens refine it.
      const target = direction === "back" ? this.goBack() : this.goForward();
      if (!target) {
        return null;
      }
      const outcome = await show(target);
      if (outcome === "shown") {
        return target;
      }
      this.back = before.back;
      this.forward = before.forward;
      this.current = before.current;
      if (outcome === "cancelled") {
        return null;
      }
      (direction === "back" ? this.back : this.forward).pop();
      if (isFile(target)) {
        this.forget(target.filePath);
      }
    }
  }

  /** Drops entries for a file that no longer exists. */
  forget(filePath: string): void {
    const keep = (location: NavLocation) => !isFile(location) || location.filePath !== filePath;
    this.back = this.back.filter(keep);
    this.forward = this.forward.filter(keep);
    if (this.current && !keep(this.current)) {
      this.current = null;
    }
  }

  clear(): void {
    this.back = [];
    this.forward = [];
    this.current = null;
  }
}
