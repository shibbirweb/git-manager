// Adapted from Orca (github.com/stablyai/orca), MIT License: see LICENSE-ORCA.
import { describe, expect, it } from "vitest";
import { reconcileSerializedMarkdown } from "./rich-markdown-source-reconcile";
import { serializeRichMarkdownForReconcile } from "./rich-markdown-reconcile-serializer";

describe("serializeRichMarkdownForReconcile (real editor pipeline)", () => {
  const serialize = (md: string): string | null => serializeRichMarkdownForReconcile(md);

  it("applies normalizeEmptyListItems so empty list items round-trip stably", () => {
    // `3. ` immediately before a heading parses as an empty list item; without the
    // normalize step the safety re-parse would spuriously mismatch and no-op.
    const doc = "3. \n# Heading\n";
    const once = serialize(doc);
    expect(once).not.toBeNull();
    // Idempotent: re-serializing the output is stable (the live editor's steady state).
    expect(serialize(once!)?.trimEnd()).toBe(once!.trimEnd());
  });

  it("reconciles a non-canonical doc end-to-end with the real serializer, preserving style", () => {
    const originalSource = "# Title\n\n_emphasis_ text\n";
    const baseCanonical = serialize(originalSource)!;
    const edited = baseCanonical.replace("# Title", "# Title!");

    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical,
      edited,
      roundTrip: (md) => serialize(md),
    });

    expect(reconciled).toContain("_emphasis_"); // original style preserved
    expect(reconciled).toContain("# Title!"); // edit applied
    // Safety invariant: reconciled renders exactly to the editor's canonical output.
    expect(serialize(reconciled)!.trimEnd()).toBe(edited.trimEnd());
  });

  it("minimizes the diff for the exact #6080 repro (real serializer)", () => {
    // The reported case: a 1-char H1 edit must not rewrite untouched markup.
    const originalSource = "# Title\n\n_emphasis_ and __strong__\n\n* one\n* two\n* three\n\n_more emphasis_\n";
    const baseCanonical = serialize(originalSource)!;
    const edited = baseCanonical.replace("# Title", "# Title!");

    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical,
      edited,
      roundTrip: (md) => serialize(md),
    });

    // Every untouched non-canonical construct keeps its original bytes.
    for (const preserved of ["_emphasis_", "__strong__", "* one", "* two", "* three", "_more emphasis_"]) {
      expect(reconciled).toContain(preserved);
    }
    // The edit landed, and nothing else was re-canonicalized.
    expect(reconciled).toContain("# Title!");
    expect(reconciled).not.toContain("*emphasis*");
    expect(reconciled).not.toContain("- one");
    // Safety invariant: reconciled renders exactly to the editor's canonical output.
    expect(serialize(reconciled)!.trimEnd()).toBe(edited.trimEnd());
  });

  it("branch-2 fast path output still renders to the canonical edit (real serializer)", () => {
    // Guards the re-parse-skipping fast path: even though branch 2 does NOT run
    // the safety re-parse, its output must satisfy the same invariant the full
    // path proves: reconciled renders exactly to the editor's canonical output.
    const originalSource = "# Title\n\n*emphasis* text\n\n- one\n- two\n"; // canonical + trailing \n
    const baseCanonical = serialize(originalSource)!;
    expect(originalSource).not.toBe(baseCanonical); // differs only by the trailing \n
    const edited = baseCanonical.replace("# Title", "# Title!");
    let roundTripCalls = 0;

    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical,
      edited,
      roundTrip: (md) => {
        roundTripCalls += 1;
        return serialize(md);
      },
    });

    expect(roundTripCalls).toBe(0); // took the cheap path
    expect(reconciled).toBe("# Title!\n\n*emphasis* text\n\n- one\n- two\n");
    expect(serialize(reconciled)!.trimEnd()).toBe(edited.trimEnd());
  });

  it("does not drop a user-added trailing empty paragraph (branch 2 edited-side guard)", () => {
    // getMarkdown keeps `\n\n` for a real trailing empty paragraph, so the fast
    // path must NOT strip it: a canonical doc with a single trailing newline
    // (branch-2 eligible on the source side) edited to add a trailing empty
    // paragraph must persist that block, not silently drop it on save.
    const originalSource = "# H\n\ntext\n";
    const baseCanonical = serialize(originalSource)!; // '# H\n\ntext'
    const edited = "# H\n\ntext\n\n"; // user pressed Enter at EOF
    let roundTripCalls = 0;

    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical,
      edited,
      roundTrip: (md) => {
        roundTripCalls += 1;
        return serialize(md);
      },
    });

    expect(roundTripCalls).toBeGreaterThan(0); // deferred to the safety-verified path
    // Exact reload equality (NOT trimEnd): the empty paragraph survives.
    expect(serialize(reconciled)).toBe(serialize(edited));
  });

  it("does not introduce a spurious &nbsp; when a trailing-blank-line doc is edited (branch 2 guard)", () => {
    // A canonical heading-ending doc with 3 trailing blank lines: the fast path
    // must NOT preserve that long trailing run while skipping the re-parse, or a
    // reload materializes a literal &nbsp; paragraph (a content change). The
    // >1-trailing-newline guard defers this to the safety-checked path.
    const originalSource = "# Notes\n\nSome text here.\n\n## TODO\n\n\n\n";
    const baseCanonical = serialize(originalSource)!;
    const edited = baseCanonical.replace("## TODO", "## TODO\n\nA new note.");
    let roundTripCalls = 0;

    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical,
      edited,
      roundTrip: (md) => {
        roundTripCalls += 1;
        return serialize(md);
      },
    });

    expect(roundTripCalls).toBeGreaterThan(0); // took the safety-verified path
    expect(reconciled).not.toContain("&nbsp;");
    // Safety invariant: reconciled renders exactly to the editor's canonical edit.
    expect(serialize(reconciled)!.trimEnd()).toBe(edited.trimEnd());
  });

  it("falls back cleanly when an empty-list doc cannot be source-preserved", () => {
    // Combines an empty list item with non-canonical emphasis; whatever the fuzzy
    // patch does, the output must render to `edited` (no corruption).
    const originalSource = "_lead_\n\n3. \n# Heading\n";
    const baseCanonical = serialize(originalSource)!;
    const edited = baseCanonical.replace("Heading", "Heading!");

    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical,
      edited,
      roundTrip: (md) => serialize(md),
    });

    expect(serialize(reconciled)!.trimEnd()).toBe(edited.trimEnd());
  });
});
