import { describe, expect, it } from "vitest";
import { DEFAULT_EDITOR_FONT, normalizeFontFamily } from "./settings.svelte";

describe("normalizeFontFamily", () => {
  it("keeps a list that already ends in monospace", () => {
    expect(normalizeFontFamily(DEFAULT_EDITOR_FONT)).toBe(DEFAULT_EDITOR_FONT);
  });

  it("adds a monospace fallback and tidies spacing", () => {
    expect(normalizeFontFamily("  'Fira Code' ,Menlo ")).toBe("'Fira Code', Menlo, monospace");
  });

  it("falls back to the default for empty input", () => {
    expect(normalizeFontFamily("   ")).toBe(DEFAULT_EDITOR_FONT);
    expect(normalizeFontFamily(",,")).toBe("monospace");
  });

  it("drops a family named twice, ignoring quotes and case", () => {
    expect(normalizeFontFamily(`'JetBrains Mono', ${DEFAULT_EDITOR_FONT}`)).toBe(DEFAULT_EDITOR_FONT);
    expect(normalizeFontFamily("Menlo, menlo, \"Menlo\", Hack")).toBe("Menlo, Hack, monospace");
  });

  it("strips characters that could break out of the CSS value", () => {
    expect(normalizeFontFamily("Menlo; color: red {}")).toBe("Menlo color: red, monospace");
  });
});
