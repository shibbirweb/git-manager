import { describe, expect, it } from "vitest";
import type { GitCommandEntry } from "$lib/types";
import {
  commandText,
  formatDuration,
  isAtBottom,
  listLayout,
  MAX_OUTPUT_LINES,
  matchesFilter,
  mergeEntries,
  OUTPUT_LINE_HEIGHT,
  OUTPUT_PADDING,
  outputBlocks,
  quoteArg,
  repoName,
  ROW_HEIGHT,
  rowHeight,
  statusOf,
  upsertEntry,
  visibleRange,
} from "./consoleModel";

function entry(id: number, patch: Partial<GitCommandEntry> = {}): GitCommandEntry {
  return {
    id,
    startedAt: 0,
    repoPath: "/work/app",
    args: ["status"],
    running: false,
    durationMs: 5,
    exitCode: 0,
    success: true,
    error: null,
    stdout: "",
    stderr: "",
    stdoutTruncated: false,
    stderrTruncated: false,
    ...patch,
  };
}

describe("upsertEntry", () => {
  it("appends new entries, replaces finished ones and keeps the cap", () => {
    let entries = upsertEntry([], entry(1, { running: true }));
    entries = upsertEntry(entries, entry(2, { running: true }));
    entries = upsertEntry(entries, entry(1, { running: false, exitCode: 1, success: false }));
    expect(entries.map((item) => [item.id, statusOf(item)])).toEqual([
      [1, "failed"],
      [2, "running"],
    ]);
    const capped = upsertEntry(entries, entry(3), 2);
    expect(capped.map((item) => item.id)).toEqual([2, 3]);
  });

  it("never lets a late start event undo a finish", () => {
    const finished = [entry(1)];
    expect(upsertEntry(finished, entry(1, { running: true }))).toBe(finished);
  });

  it("puts an out of order entry in place", () => {
    expect(upsertEntry([entry(1), entry(3)], entry(2)).map((item) => item.id)).toEqual([1, 2, 3]);
  });
});

describe("mergeEntries", () => {
  it("merges events that arrived while loading", () => {
    const merged = mergeEntries([entry(1), entry(2, { running: true })], [entry(2), entry(4, { running: true })], 3);
    expect(merged.map((item) => [item.id, item.running])).toEqual([
      [1, false],
      [2, false],
      [4, true],
    ]);
    expect(mergeEntries([entry(1), entry(2), entry(3)], [], 2).map((item) => item.id)).toEqual([2, 3]);
  });
});

describe("command text", () => {
  it("quotes what a shell would split or expand", () => {
    expect(quoteArg("--format=%H")).toBe("--format=%H");
    expect(quoteArg("refs/heads/main")).toBe("refs/heads/main");
    expect(quoteArg("my file.txt")).toBe("'my file.txt'");
    expect(quoteArg("it's")).toBe("'it'\\''s'");
    expect(quoteArg("")).toBe("''");
    expect(quoteArg("*.log")).toBe("'*.log'");
    expect(commandText(entry(1, { args: ["commit", "-m", "fix: a b"] }))).toBe("git commit -m 'fix: a b'");
  });

  it("names the repository by its folder", () => {
    expect(repoName("/Users/me/work/app")).toBe("app");
    expect(repoName("/Users/me/work/app/")).toBe("app");
  });

  it("formats durations", () => {
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(0)).toBe("0 ms");
    expect(formatDuration(12.4)).toBe("12 ms");
    expect(formatDuration(1234)).toBe("1.23 s");
    expect(formatDuration(12_345)).toBe("12.3 s");
    expect(formatDuration(125_000)).toBe("2m 5s");
  });
});

describe("matchesFilter", () => {
  it("matches every word in the command or the repository name", () => {
    const fetch = entry(1, { args: ["fetch", "--all", "--prune"], repoPath: "/w/backend" });
    expect(matchesFilter(fetch, "")).toBe(true);
    expect(matchesFilter(fetch, "FETCH")).toBe(true);
    expect(matchesFilter(fetch, "fetch backend")).toBe(true);
    expect(matchesFilter(fetch, "fetch frontend")).toBe(false);
  });
});

describe("output", () => {
  it("shows stdout, stderr, cuts and errors, or says there is none", () => {
    expect(outputBlocks(entry(1)).map((block) => block.text)).toEqual(["No output"]);
    expect(outputBlocks(entry(1, { running: true })).map((block) => block.text)).toEqual(["Running..."]);
    const blocks = outputBlocks(entry(1, { stdout: "a\nb\n", stderr: "warn\n", stdoutTruncated: true, error: "boom" }));
    expect(blocks.map((block) => block.kind)).toEqual(["stdout", "note", "stderr", "error"]);
    expect(blocks[0].text).toBe("a\nb");
  });
});

describe("layout", () => {
  it("gives closed rows one line and open rows their capped output", () => {
    const small = entry(1, { stdout: "one\ntwo\n" });
    const big = entry(2, { stdout: "x\n".repeat(100) });
    expect(rowHeight(small, false)).toBe(ROW_HEIGHT);
    expect(rowHeight(small, true)).toBe(ROW_HEIGHT + 2 * OUTPUT_LINE_HEIGHT + OUTPUT_PADDING);
    expect(rowHeight(big, true)).toBe(ROW_HEIGHT + MAX_OUTPUT_LINES * OUTPUT_LINE_HEIGHT + OUTPUT_PADDING);

    const layout = listLayout([small, big, entry(3)], new Set([2]));
    expect(layout.offsets).toEqual([0, ROW_HEIGHT, ROW_HEIGHT + rowHeight(big, true)]);
    expect(layout.total).toBe(layout.offsets[2] + ROW_HEIGHT);
  });

  it("finds the rows in view with overscan", () => {
    const entries = Array.from({ length: 1000 }, (_, index) => entry(index + 1));
    const layout = listLayout(entries, new Set());
    expect(visibleRange(layout, 0, 240, 0)).toEqual({ start: 0, end: 11 });
    expect(visibleRange(layout, 2400, 240, 5)).toEqual({ start: 95, end: 116 });
    expect(visibleRange(layout, 1e9, 240, 0)).toEqual({ start: 999, end: 1000 });
    expect(visibleRange(listLayout([], new Set()), 0, 240)).toEqual({ start: 0, end: 0 });
  });

  it("knows when the list is scrolled to the end", () => {
    expect(isAtBottom(760, 240, 1000)).toBe(true);
    expect(isAtBottom(700, 240, 1000)).toBe(false);
  });
});
