import { describe, expect, it } from "vitest";
import type { ReplaceOutcome, ReplacedFile, ReplaceSkippedFile } from "$lib/types";
import { nothingToReplace, replaceConfirm, replaceSummary, skippedText } from "./replaceModel";

function file(relativePath: string, replacements: number): ReplacedFile {
  return { path: `/w/${relativePath}`, root: "/w", relativePath, replacements };
}

function skip(relativePath: string, reason: ReplaceSkippedFile["reason"], matches = 1): ReplaceSkippedFile {
  return { path: `/w/${relativePath}`, relativePath, reason, matches };
}

function outcome(overrides: Partial<ReplaceOutcome> = {}): ReplaceOutcome {
  return {
    files: [],
    replacements: 0,
    skipped: [],
    failed: [],
    cancelled: false,
    preview: false,
    error: null,
    ...overrides,
  };
}

describe("replaceConfirm", () => {
  it("asks with the counts", () => {
    const preview = outcome({ files: [file("a.ts", 9), file("b/c.ts", 3)], replacements: 12, preview: true });
    expect(replaceConfirm(preview, "basket")).toEqual({
      title: "Replace All",
      message: "Replace 12 matches in 2 files? Files are written right away and cannot be undone here.",
      confirmLabel: "Replace All",
    });
  });

  it("mentions deletion and skipped files", () => {
    const preview = outcome({
      files: [file("a.ts", 1)],
      replacements: 1,
      skipped: [skip("src/cart.ts", "unsaved", 4)],
      preview: true,
    });
    expect(replaceConfirm(preview, "")?.message).toBe(
      "Replace 1 match in 1 file? The matches are deleted. Skipped 1 file with unsaved changes: cart.ts. " +
        "Files are written right away and cannot be undone here.",
    );
  });

  it("is null when there is nothing to replace", () => {
    expect(replaceConfirm(outcome({ preview: true }), "x")).toBeNull();
  });
});

describe("skippedText", () => {
  it("groups by reason and shortens long lists", () => {
    expect(
      skippedText([
        skip("a.ts", "unsaved"),
        skip("b.ts", "unsaved"),
        skip("c.ts", "unsaved"),
        skip("d/e.ts", "unsaved"),
        skip("link.ts", "link"),
        skip("ro.ts", "readOnly"),
      ]),
    ).toBe(
      "Skipped 4 files with unsaved changes: a.ts, b.ts, c.ts and 1 more. Skipped 1 symbolic link: link.ts. " +
        "Skipped 1 read-only file: ro.ts.",
    );
    expect(skippedText([])).toBe("");
  });
});

describe("replaceSummary", () => {
  it("reports what was replaced", () => {
    const done = outcome({ files: [file("a.ts", 8), file("b.ts", 2), file("c.ts", 1), file("d.ts", 1)], replacements: 12 });
    expect(replaceSummary(done)).toEqual({ kind: "success", title: "Replaced 12 matches in 4 files", detail: "" });
  });

  it("reports skips, failures and a cancel", () => {
    const done = outcome({
      files: [file("a.ts", 1)],
      replacements: 1,
      skipped: [skip("src/cart.ts", "unsaved")],
      failed: [{ path: "/w/x.ts", relativePath: "x.ts", message: "Permission denied" }],
      cancelled: true,
    });
    expect(replaceSummary(done)).toEqual({
      kind: "error",
      title: "Stopped after replacing 1 match in 1 file, 1 file failed",
      detail: "Skipped 1 file with unsaved changes: cart.ts. x.ts: Permission denied",
    });
  });
});

describe("nothingToReplace", () => {
  it("explains an error or the skipped files", () => {
    expect(nothingToReplace(outcome({ error: "Invalid regular expression: x" }))).toBe("Invalid regular expression: x");
    expect(nothingToReplace(outcome({ skipped: [skip("a.ts", "unsaved")] }))).toBe("Skipped 1 file with unsaved changes: a.ts.");
    expect(nothingToReplace(outcome())).toBe("");
  });
});
