// Adapted from Orca (github.com/stablyai/orca), MIT License: see LICENSE-ORCA.
import { describe, expect, it, vi } from "vitest";
import { reconcileSerializedMarkdown } from "./rich-markdown-source-reconcile";
import { fakeCanonicalize, reconcileWithFake, roundTrip } from "./rich-markdown-source-reconcile.fixtures";

describe("reconcileSerializedMarkdown: line endings and offsets", () => {
  it("skips the safety re-parse for a canonical LF file with a trailing newline (branch 2)", () => {
    // The common case: file is already canonical but ends in \n, so getMarkdown
    // (which strips the trailing newline) never equals it byte-for-byte. This
    // must NOT pay the expensive re-parse: the whole point of branch 2.
    const originalSource = "# Title\n\n*word*\n\n- one\n- two\n";
    const baseCanonical = "# Title\n\n*word*\n\n- one\n- two"; // getMarkdown: no trailing \n
    const edited = "# Title!\n\n*word*\n\n- one\n- two";
    const roundTrip = vi.fn(() => edited);

    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical,
      edited,
      roundTrip,
    });

    expect(roundTrip).not.toHaveBeenCalled();
    // Edit applied, and the source's trailing newline is preserved.
    expect(reconciled).toBe("# Title!\n\n*word*\n\n- one\n- two\n");
  });

  it("preserves CRLF + trailing newline for a canonical CRLF file without re-parsing (branch 2)", () => {
    const originalSource = "# H\r\n\r\n*word*\r\n";
    const baseCanonical = "# H\n\n*word*"; // getMarkdown: LF, no trailing
    const edited = "# H!\n\n*word*";
    const roundTrip = vi.fn(() => edited);

    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical,
      edited,
      roundTrip,
    });

    expect(roundTrip).not.toHaveBeenCalled();
    expect(reconciled).toBe("# H!\r\n\r\n*word*\r\n");
    // No mixed endings.
    expect(reconciled.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("restores CRLF on the oversize fallback so a uniform-CRLF file never flips to LF (branch 3)", () => {
    const big = "line of text\r\n".repeat(9000); // ~130 KB, above the cap, all CRLF
    const originalSource = `${big}_x_\r\n`; // non-canonical emphasis, oversize
    const editedLf = `${big.replace(/\r\n/g, "\n")}*x* y\n`;

    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical: `${big.replace(/\r\n/g, "\n")}*x*\n`,
      edited: editedLf,
      roundTrip: () => null,
    });

    // Canonical fallback content, but the source's CRLF endings are kept.
    expect(reconciled).toContain("\r\n");
    expect(reconciled.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("restores CRLF on the hunk-apply fallback (branch 5)", () => {
    const originalSource = "Zzz unrelated content sharing nothing here.\r\n";
    const baseCanonical = "The quick brown fox jumps over the lazy dog.\n";
    const edited = "The quick brown fox LEAPS over the lazy dog.\n";

    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical,
      edited,
      roundTrip,
    });

    // Falls back to canonical content, but in the source's CRLF ending.
    expect(reconciled).toBe("The quick brown fox LEAPS over the lazy dog.\r\n");
  });

  it("preserves CRLF endings on disk without mixing (branch 4 EOL restore)", () => {
    const originalSource = "# H\r\n\r\n_word_\r\n\r\n* one\r\n";
    // getMarkdown always emits LF, so base/edited are LF.
    const baseCanonical = "# H\n\n*word*\n\n- one\n";
    const edited = "# H!\n\n*word*\n\n- one\n";

    const reconciled = reconcileSerializedMarkdown({
      originalSource,
      baseCanonical,
      edited,
      roundTrip,
    });

    expect(reconciled).toContain("\r\n");
    expect(reconciled).toContain("_word_");
    expect(reconciled).toContain("# H!");
    // No mixed endings: stripping CRLF leaves no lone LF.
    expect(reconciled.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("lands a repeated-substring edit on the correct occurrence or falls back", () => {
    const originalSource = ["- _alpha_", "- _beta_", "", "- _alpha_", "- _beta_", ""].join("\n");
    const baseCanonical = fakeCanonicalize(originalSource);
    // Edit only the FIRST "alpha".
    const edited = baseCanonical.replace("*alpha*", "*alpha edited*");

    const reconciled = reconcileWithFake(originalSource, edited);

    // Invariant: the reconciled bytes render exactly to `edited`: the change is
    // never silently relocated to the wrong occurrence or dropped.
    expect(fakeCanonicalize(reconciled).trimEnd()).toBe(edited.trimEnd());
    // Either the source-preserving path landed it, or it cleanly fell back.
    const landedInStyle = reconciled.includes("_alpha edited_") && reconciled.split("_beta_").length === 3;
    expect(landedInStyle || reconciled === edited).toBe(true);
  });

  it('reconciles a multi-byte edit without throwing "Failed to determine byte offset" (#9492)', () => {
    // Regression: dmp's byte/char index mixup crashes when the patch seed lands mid multi-byte run.
    // Build a mostly-Chinese doc with non-canonical `_`/`*` markers and edit a position that
    // previously threw; every such edit must reconcile and stay render-equal to `edited`.
    const lines: string[] = [];
    for (let i = 0; i < 20; i++) {
      lines.push(`_强调${i}_ 😀 café 这是一段包含很多中文字符的文本内容用来测试多字节偏移问题`);
    }
    const originalSource = `# 标题\n\n${lines.join("\n")}\n`;
    const baseCanonical = fakeCanonicalize(originalSource);

    // Sweep insert positions so we exercise the offsets that used to overshoot the byte target.
    const chars = [...baseCanonical];
    for (let pos = 5; pos < chars.length - 5; pos += 3) {
      const inserted = ["插", "😀", "é"][Math.floor(pos / 3) % 3];
      const edited = `${chars.slice(0, pos).join("")}${inserted}${chars.slice(pos).join("")}`;

      const reconciled = reconcileWithFake(originalSource, edited);

      // Never throws or falls back to a whole-document canonical rewrite.
      expect(reconciled).not.toBe(edited);
      expect(fakeCanonicalize(reconciled).trimEnd()).toBe(edited.trimEnd());
    }
  });

  it("keeps later multi-hunk seeds in the rolling application coordinate space", () => {
    const lines = Array.from({ length: 8 }, (_, i) => `_强调${i}_ ascii segment ${i} 中文 tail`);
    const originalSource = `# 标题\n\n${lines.join("\n")}\n`;
    const baseCanonical = fakeCanonicalize(originalSource);
    // Why: the first hunk changes the UTF-8/code-unit delta before the second seed is decoded.
    const edited = baseCanonical.replace("segment 1", "segment 1 🚀🚀").replace("segment 6", "segment 6 XYZ");

    const reconciled = reconcileWithFake(originalSource, edited);

    expect(reconciled).not.toBe(edited);
    expect(fakeCanonicalize(reconciled)).toBe(edited);
  });
});
