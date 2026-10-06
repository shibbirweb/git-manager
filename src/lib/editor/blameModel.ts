// Pure blame bookkeeping: which commit owns each line, kept in step with edits.

import type { ChangeSet, Text } from "@codemirror/state";
import type { NavLocation } from "$lib/stores/navHistory";
import type { BlameCommit, BlameInfo } from "$lib/types";

/** Line owner: an index into `commits`, or -1 for a line edited locally. */
export interface BlameState {
  commits: BlameCommit[];
  lines: number[];
  /** Per line, its 0-based line in the owning commit's version of the file, or -1 when unknown. */
  origins?: number[];
  /** Repository and repo-relative path the blame belongs to, for navigation. */
  repoRoot?: string;
  filePath?: string;
  /** Builds the Back / Forward step for a clicked line of this view. */
  origin?: (line: number) => NavLocation;
}

export const LOCAL_EDIT = -1;
export const UNKNOWN_LINE = -1;
/** A line the inline diff shows from the old text: it has no blame of its own. */
export const REMOVED_LINE = -2;

export function fromInfo(info: BlameInfo, lineCount: number): BlameState {
  const lines: number[] = [];
  const origins: number[] = [];
  const runs = info.runs ?? [];
  for (let index = 0; index + 2 < runs.length && lines.length < lineCount; index += 3) {
    const [length, commit, originalStart] = [runs[index], runs[index + 1], runs[index + 2]];
    for (let offset = 0; offset < length && lines.length < lineCount; offset++) {
      lines.push(commit);
      origins.push(originalStart + offset);
    }
  }
  // git counts no line after a trailing newline; CodeMirror has an empty last line.
  while (lines.length < lineCount) {
    lines.push(lines.length > 0 ? lines[lines.length - 1] : LOCAL_EDIT);
    origins.push(UNKNOWN_LINE);
  }
  return { commits: info.commits, lines, origins };
}

/** Every line owned by uncommitted work, e.g. a file git does not track yet. */
export function allUncommitted(lineCount: number): BlameState {
  return { commits: [], lines: new Array<number>(lineCount).fill(LOCAL_EDIT) };
}

/** Maps line owners through an edit: touched lines become local edits. */
export function mapBlame(state: BlameState, changes: ChangeSet, oldDoc: Text, newDoc: Text): BlameState {
  const edits: { oldFrom: number; oldTo: number; newFrom: number; newTo: number }[] = [];
  changes.iterChanges((fromA, toA, fromB, toB) => {
    edits.push({
      oldFrom: oldDoc.lineAt(fromA).number - 1,
      oldTo: oldDoc.lineAt(toA).number - 1,
      newFrom: newDoc.lineAt(fromB).number - 1,
      newTo: newDoc.lineAt(toB).number - 1,
    });
  });
  if (edits.length === 0) {
    return state;
  }
  const lines = state.lines.slice();
  const origins = state.origins?.slice() ?? null;
  // Apply from the bottom so earlier line numbers stay valid.
  for (let index = edits.length - 1; index >= 0; index--) {
    const edit = edits[index];
    const count = edit.newTo - edit.newFrom + 1;
    lines.splice(edit.oldFrom, edit.oldTo - edit.oldFrom + 1, ...new Array<number>(count).fill(LOCAL_EDIT));
    origins?.splice(edit.oldFrom, edit.oldTo - edit.oldFrom + 1, ...new Array<number>(count).fill(UNKNOWN_LINE));
  }
  while (lines.length < newDoc.lines) {
    lines.push(LOCAL_EDIT);
  }
  lines.length = newDoc.lines;
  if (!origins) {
    return { ...state, lines };
  }
  while (origins.length < newDoc.lines) {
    origins.push(UNKNOWN_LINE);
  }
  origins.length = newDoc.lines;
  return { ...state, lines, origins };
}

export function commitAt(state: BlameState, line: number): BlameCommit | null {
  const index = state.lines[line];
  if (index === undefined || index < 0) {
    return null;
  }
  return state.commits[index] ?? null;
}

/** The 0-based line in the owning commit's version of the file, or null when unknown. */
export function commitLineAt(state: BlameState, line: number): number | null {
  const origin = state.origins?.[line] ?? UNKNOWN_LINE;
  return origin >= 0 ? origin : null;
}

/**
 * Where the commit's diff should scroll for a clicked line: its line in that
 * commit when known, else the same line number plus its text to search for.
 */
export function commitLineTarget(state: BlameState, line: number, lineText: string): { line: number; lineText?: string } {
  const exact = commitLineAt(state, line);
  return exact !== null ? { line: exact } : { line, lineText };
}

/** True for a removed line of an inline diff, which shows no blame. */
export function isRemoved(state: BlameState, line: number): boolean {
  return state.lines[line] === REMOVED_LINE;
}

/**
 * Blame of the new text, spread over an inline diff's lines: `newLineOf` gives each document
 * line its new text line, or null for a removed line. Clicked lines report their new line.
 */
export function expandBlame(state: BlameState, newLineOf: readonly (number | null)[]): BlameState {
  const lines = newLineOf.map((line) => (line === null ? REMOVED_LINE : (state.lines[line] ?? LOCAL_EDIT)));
  const origins = state.origins
    ? newLineOf.map((line) => (line === null ? UNKNOWN_LINE : (state.origins?.[line] ?? UNKNOWN_LINE)))
    : undefined;
  const origin = state.origin;
  const nearestNewLine = (docLine: number): number => {
    for (let index = docLine; index < newLineOf.length; index++) {
      const line = newLineOf[index];
      if (line !== null && line !== undefined) {
        return line;
      }
    }
    return 0;
  };
  return { ...state, lines, origins, origin: origin ? (docLine) => origin(nearestNewLine(docLine)) : undefined };
}

/** True when a line is not committed (local edit or git's uncommitted marker). */
export function isUncommitted(state: BlameState, line: number): boolean {
  const index = state.lines[line];
  if (index === undefined || index < 0) {
    return true;
  }
  return state.commits[index]?.uncommitted ?? true;
}

/** Age rank from 0 (oldest) to 1 (newest) per commit, for the gutter heat colors. */
export function ageRanks(commits: BlameCommit[]): number[] {
  const times = [...new Set(commits.filter((commit) => !commit.uncommitted).map((commit) => commit.authorTime))].sort(
    (a, b) => a - b,
  );
  return commits.map((commit) => {
    if (commit.uncommitted) {
      return 1;
    }
    if (times.length <= 1) {
      return 1;
    }
    return times.indexOf(commit.authorTime) / (times.length - 1);
  });
}
