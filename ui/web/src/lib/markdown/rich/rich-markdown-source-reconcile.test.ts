// Adapted from Orca (github.com/stablyai/orca), MIT License: see LICENSE-ORCA.
import { describe, expect, it, vi } from "vitest";
import { reconcileSerializedMarkdown } from "./rich-markdown-source-reconcile";
import { fakeCanonicalize, reconcileWithFake, roundTrip } from "./rich-markdown-source-reconcile.fixtures";

describe("reconcileSerializedMarkdown", () => {
  it("preserves untouched non-canonical regions on a 1-char edit", () => {
    const originalSource = "# Title\n\n_emphasis_ and __strong__\n\n* one\n* two\n";
    const baseCanonical = fakeCanonicalize(originalSource);
    const edited = baseCanonical.replace("# Title", "# Title!");

    const reconciled = reconcileWithFake(originalSource, edited);

    // Untouched markup keeps its original bytes.
    expect(reconciled).toContain("_emphasis_");
    expect(reconciled).toContain("__strong__");
    expect(reconciled).toContain("* one");
    expect(reconciled).toContain("* two");
    // The edited region reflects the change.
    expect(reconciled).toContain("# Title!");
    // Never re-canonicalized.
    expect(reconciled).not.toContain("*emphasis*");
    expect(reconciled).not.toContain("- one");
  });

  it("preserves the trailing newline of the original source", () => {
    const originalSource = "# H\n\n_word_\n";
    const edited = fakeCanonicalize(originalSource).replace("# H", "# H!");

    const reconciled = reconcileWithFake(originalSource, edited);

    expect(reconciled.endsWith("\n")).toBe(true);
    expect(reconciled).toContain("_word_");
  });

  it("keeps newly-typed content canonical while preserving the original style", () => {
    const originalSource = "_old_\n";
    const edited = "*old* and *new*\n";

    const reconciled = reconcileWithFake(originalSource, edited);

    expect(reconciled).toContain("_old_"); // original preserved
    expect(reconciled).toContain("*new*"); // new content stays canonical
  });

  it("returns edited when the source is already canonical (branch 2)", () => {
    const originalSource = "*word* here\n";
    const edited = "*word* there\n";

    // baseCanonical === originalSource, so there is nothing to preserve.
    expect(reconcileWithFake(originalSource, edited)).toBe(edited);
  });

  it("returns the source verbatim when there is no semantic change (branch 1)", () => {
    const originalSource = "_word_ and * bullet\n";
    const baseCanonical = fakeCanonicalize(originalSource);

    // edited === baseCanonical: e.g. cursor moved, selection changed, no edit.
    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical,
      edited: baseCanonical,
      roundTrip,
    });

    // Exact bytes, including trailing newline: zero disk churn.
    expect(reconciled).toBe(originalSource);
  });

  it("falls back to canonical when either string exceeds the size cap (branch 3)", () => {
    const big = "line of text\n".repeat(9000); // ~117 KB, above the size cap
    const originalSource = `${big}_x_\n`;
    const edited = `${big}*x* y\n`;

    // Non-canonical source + real semantic change, but oversize → canonical fallback.
    expect(reconcileWithFake(originalSource, edited)).toBe(edited);
  });

  it("bounds diff work for replacement-heavy edits instead of using the 1s library default", () => {
    let now = 0;
    const dateNow = vi.spyOn(Date, "now").mockImplementation(() => {
      now += 10;
      return now;
    });
    const baseCanonical = "a".repeat(20_000);
    const edited = "b".repeat(20_000);

    try {
      const reconciled = reconcileSerializedMarkdown({
        originalSource: `_${baseCanonical.slice(1)}`,
        baseCanonical,
        edited,
        roundTrip: (markdown) => markdown,
      });

      expect(reconciled).toBe(edited);
      // The 10ms budget expires almost immediately; the dependency's default
      // one-second budget takes ~102 reads with this deterministic clock.
      expect(dateNow.mock.calls.length).toBeLessThan(10);
    } finally {
      dateNow.mockRestore();
    }
  });

  it("skips the dependency half-match path when its long seed repeats", () => {
    const dateNow = vi.spyOn(Date, "now");
    const baseCanonical = "ab".repeat(24_500);
    const edited = "ba".repeat(24_500);

    try {
      const reconciled = reconcileSerializedMarkdown({
        originalSource: `_${baseCanonical.slice(1)}`,
        baseCanonical,
        edited,
        roundTrip: (markdown) => markdown,
      });

      expect(reconciled).toBe(edited);
      // The dependency reads the clock when diffing; zero reads proves the
      // repetitive-input preflight returned before its unbounded half-match scan.
      expect(dateNow).not.toHaveBeenCalled();
    } finally {
      dateNow.mockRestore();
    }
  });

  it("still preserves a small edit inside a highly repetitive document", () => {
    const dateNow = vi.spyOn(Date, "now");
    const baseCanonical = "ab".repeat(24_500);
    const editIndex = Math.floor(baseCanonical.length / 2);
    const edited = `${baseCanonical.slice(0, editIndex)}X${baseCanonical.slice(editIndex + 1)}`;

    try {
      const reconciled = reconcileSerializedMarkdown({
        originalSource: `_${baseCanonical.slice(1)}`,
        baseCanonical,
        edited,
        roundTrip: (markdown) => `a${markdown.slice(1)}`,
      });

      expect(reconciled).toBe(`_${edited.slice(1)}`);
      expect(dateNow).toHaveBeenCalled();
    } finally {
      dateNow.mockRestore();
    }
  });

  it("falls back to canonical when a hunk fails to apply (branch 5)", () => {
    const baseCanonical = "The quick brown fox jumps over the lazy dog every morning.\n";
    const edited = "The quick brown fox LEAPS over the lazy dog every morning.\n";
    const originalSource = "Zzz totally unrelated content sharing nothing at all here.\n";

    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical,
      edited,
      roundTrip,
    });

    expect(reconciled).toBe(edited);
  });

  it("falls back to canonical when the safety re-parse mismatches (branch 6)", () => {
    const reconciled = reconcileSerializedMarkdown({
      originalSource: "_a_\n",
      baseCanonical: "*a*\n",
      edited: "*a* b\n",
      // Simulates a fuzzy misplacement whose render differs from `edited`.
      roundTrip: () => "something entirely different",
    });

    expect(reconciled).toBe("*a* b\n");
  });

  it("falls back to canonical when the safety serializer returns null (branch 6)", () => {
    const reconciled = reconcileSerializedMarkdown({
      originalSource: "_a_\n",
      baseCanonical: "*a*\n",
      edited: "*a* b\n",
      roundTrip: () => null,
    });

    expect(reconciled).toBe("*a* b\n");
  });

  it("preserves non-canonical regions across an incremental two-edit ref chain", () => {
    const originalSource = "# Title\n\n_emphasis_\n\n* item\n";
    const base = fakeCanonicalize(originalSource);
    const edited1 = base.replace("# Title", "# Title A");

    const reconciled1 = reconcileWithFake(originalSource, edited1);
    expect(reconciled1).toContain("_emphasis_");
    expect(reconciled1).toContain("* item");

    // Simulate the commit helper advancing the refs: originalSource := reconciled1,
    // baseCanonical := edited1. The second edit must still preserve the markup.
    const edited2 = edited1.replace("# Title A", "# Title AB");
    const reconciled2 = reconcileSerializedMarkdown({
      originalSource: reconciled1,
      baseCanonical: edited1,
      edited: edited2,
      roundTrip,
    });

    expect(reconciled2).toContain("_emphasis_");
    expect(reconciled2).toContain("* item");
    expect(reconciled2).toContain("# Title AB");
  });
});
