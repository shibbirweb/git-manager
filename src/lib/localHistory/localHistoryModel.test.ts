import { describe, expect, it } from "vitest";
import type { LocalSnapshot, SnapshotLabel } from "$lib/types";
import {
  dayTitle,
  groupByDay,
  isSafetyCopy,
  movedSelection,
  reloadRecords,
  sizeText,
  snapshotLabel,
  usageText,
} from "./localHistoryModel";

function at(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour).getTime();
}

function snap(time: number, label: SnapshotLabel = "saved"): LocalSnapshot {
  return { time, label, hash: `${time}`.padStart(40, "0"), size: 10 };
}

describe("reload snapshots", () => {
  it("an outside change keeps the old editor text, then the new file", () => {
    expect(reloadRecords("/r/a.txt", "old", "crlf", "external")).toEqual([
      { filePath: "/r/a.txt", text: "old", eol: "crlf", label: "beforeExternalChange" },
      { filePath: "/r/a.txt", text: null, eol: null, label: "externalChange" },
    ]);
  });

  it("Revert keeps the unsaved edits it throws away", () => {
    expect(reloadRecords("/r/a.txt", "edits", "lf", "revert")).toEqual([
      { filePath: "/r/a.txt", text: "edits", eol: "lf", label: "beforeRevert" },
    ]);
  });
});

describe("labels and texts", () => {
  it("names every label", () => {
    const labels: SnapshotLabel[] = [
      "saved",
      "beforeSave",
      "externalChange",
      "beforeExternalChange",
      "beforeDiscard",
      "beforeRollback",
      "beforeRevert",
      "other",
    ];
    const names = labels.map(snapshotLabel);
    expect(new Set(names).size).toBe(labels.length);
    expect(snapshotLabel("beforeDiscard")).toBe("Before discard");
    expect(snapshotLabel("externalChange")).toBe("External change");
    expect(snapshotLabel("unknown" as SnapshotLabel)).toBe(snapshotLabel("other"));
    expect(names.every((name) => !name.includes(String.fromCharCode(0x2014)))).toBe(true);
  });

  it("marks copies kept before something replaced the text", () => {
    expect(isSafetyCopy("beforeDiscard")).toBe(true);
    expect(isSafetyCopy("beforeRollback")).toBe(true);
    expect(isSafetyCopy("beforeRevert")).toBe(true);
    expect(isSafetyCopy("saved")).toBe(false);
    expect(isSafetyCopy("externalChange")).toBe(false);
  });

  it("writes sizes and usage", () => {
    expect(sizeText(512)).toBe("512 B");
    expect(sizeText(1536)).toBe("1.5 KB");
    expect(sizeText(20 * 1024)).toBe("20 KB");
    expect(sizeText(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(usageText(null)).toBe("");
    expect(usageText({ files: 0, snapshots: 0, bytes: 0 })).toBe("Nothing kept yet.");
    expect(usageText({ files: 1, snapshots: 1, bytes: 100 })).toBe("1 version of 1 file, 100 B on disk.");
    expect(usageText({ files: 2, snapshots: 5, bytes: 2048 })).toBe("5 versions of 2 files, 2.0 KB on disk.");
  });
});

describe("the version list", () => {
  it("groups by day under Today, Yesterday and dates", () => {
    const now = at(2026, 10, 3, 15);
    expect(dayTitle(at(2026, 10, 3, 1), now)).toBe("Today");
    expect(dayTitle(at(2026, 10, 2, 23), now)).toBe("Yesterday");
    const older = dayTitle(at(2026, 9, 28), now);
    expect(older).not.toBe("Today");
    expect(older).not.toBe("Yesterday");

    const groups = groupByDay([snap(at(2026, 10, 3, 14)), snap(at(2026, 10, 3, 9)), snap(at(2026, 10, 2)), snap(at(2026, 9, 28))], now);
    expect(groups.map((group) => [group.title, group.snapshots.length])).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
      [older, 1],
    ]);
    expect(groupByDay([], now)).toEqual([]);
  });

  it("moves the selection with the arrow keys within bounds", () => {
    expect(movedSelection(0, -1, "ArrowDown")).toBe(-1);
    expect(movedSelection(3, 0, "ArrowDown")).toBe(1);
    expect(movedSelection(3, 2, "ArrowDown")).toBe(2);
    expect(movedSelection(3, 0, "ArrowUp")).toBe(0);
    expect(movedSelection(3, -1, "ArrowUp")).toBe(0);
    expect(movedSelection(3, 1, "End")).toBe(2);
    expect(movedSelection(3, 2, "Home")).toBe(0);
    expect(movedSelection(3, 1, "a")).toBe(1);
  });
});
