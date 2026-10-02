import { describe, expect, it } from "vitest";
import { DEFAULT_EDITOR_FONT } from "$lib/stores/settingsData";
import { buildTerminalFontFamily, NERD_FONT_FALLBACKS, TERMINAL_FONT_PICKS, xtermFontWeight } from "./fonts";

const nerdStack = NERD_FONT_FALLBACKS.map((family) => `'${family}'`).join(", ");

describe("buildTerminalFontFamily", () => {
  it("uses the editor font when the terminal font is empty", () => {
    expect(buildTerminalFontFamily({ terminalFontFamily: "", editorFontFamily: DEFAULT_EDITOR_FONT, nerdFontIcons: false })).toBe(
      DEFAULT_EDITOR_FONT,
    );
    expect(buildTerminalFontFamily({ terminalFontFamily: "   ", editorFontFamily: "Hack, monospace", nerdFontIcons: false })).toBe(
      "Hack, monospace",
    );
  });

  it("prefers the terminal font over the editor font", () => {
    expect(
      buildTerminalFontFamily({ terminalFontFamily: "'Fira Code', Menlo", editorFontFamily: DEFAULT_EDITOR_FONT, nerdFontIcons: false }),
    ).toBe("'Fira Code', Menlo, monospace");
  });

  it("puts the Nerd Font fallbacks after the chosen fonts and before monospace", () => {
    expect(buildTerminalFontFamily({ terminalFontFamily: "Menlo, monospace", editorFontFamily: "", nerdFontIcons: true })).toBe(
      `Menlo, ${nerdStack}, monospace`,
    );
  });

  it("does not list a fallback twice when it is already chosen", () => {
    const stack = buildTerminalFontFamily({
      terminalFontFamily: "\"MesloLGS NF\", Menlo",
      editorFontFamily: DEFAULT_EDITOR_FONT,
      nerdFontIcons: true,
    });
    const families = stack.split(", ");
    expect(families[0]).toBe("\"MesloLGS NF\"");
    expect(families.filter((family) => family.toLowerCase().includes("meslolgs nf"))).toHaveLength(1);
    expect(families.at(-1)).toBe("monospace");
  });

  it("keeps monospace last even when the list has it in the middle", () => {
    expect(
      buildTerminalFontFamily({ terminalFontFamily: "Menlo, MONOSPACE, Hack", editorFontFamily: "", nerdFontIcons: false }),
    ).toBe("Menlo, Hack, monospace");
  });

  it("starts the fallbacks with the single-cell symbol font", () => {
    expect(NERD_FONT_FALLBACKS[0]).toBe("Symbols Nerd Font Mono");
    expect(NERD_FONT_FALLBACKS).toContain("MesloLGS NF");
  });

  it("falls back to the default editor font when both lists are empty", () => {
    expect(buildTerminalFontFamily({ terminalFontFamily: "", editorFontFamily: "", nerdFontIcons: false })).toBe(DEFAULT_EDITOR_FONT);
  });
});

describe("xtermFontWeight", () => {
  it("maps each setting to an xterm weight", () => {
    expect(xtermFontWeight("normal")).toBe("normal");
    expect(xtermFontWeight("medium")).toBe("500");
    expect(xtermFontWeight("bold")).toBe("bold");
    expect(xtermFontWeight("heavy" as never)).toBe("normal");
  });
});

describe("TERMINAL_FONT_PICKS", () => {
  it("offers the Powerlevel10k font", () => {
    expect(TERMINAL_FONT_PICKS).toContain("MesloLGS NF");
    expect(new Set(TERMINAL_FONT_PICKS).size).toBe(TERMINAL_FONT_PICKS.length);
  });
});
