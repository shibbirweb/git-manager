import { describe, expect, it } from "vitest";
import { componentsCss, scalesCss, typographyCss } from "../../../../design-tokens/build/css";
import { designTokens } from "../../../../design-tokens/build/model";
import { fontSize, fontWeight, gapValue, textStyleVar, toneColor } from "./scale";

const css = [scalesCss, typographyCss, componentsCss].map((sheet) => sheet(designTokens)).join("\n");

function defined(variable: string): boolean {
  return css.includes(`${variable}:`);
}

describe("the prop steps", () => {
  it("map every gap to a spacing token that exists", () => {
    for (const gap of ["xxs", "xs", "sm", "md", "mdPlus", "lg", "lgPlus", "xl", "xxl", "xxxl"] as const) {
      const variable = /var\((--[a-z0-9-]+)\)/.exec(gapValue(gap))?.[1] ?? "";
      expect([gap, defined(variable)]).toEqual([gap, true]);
    }
    expect(gapValue("none")).toBe("0");
  });

  it("map text sizes and weights to tokens that exist", () => {
    const sizes = ["micro", "tiny", "xsmall", "compact", "small", "codeSmall", "ui", "title", "display"] as const;
    for (const size of sizes) {
      expect(defined(fontSize(size).slice(4, -1))).toBe(true);
    }
    for (const weight of ["regular", "medium", "semibold", "bold"] as const) {
      expect(defined(fontWeight(weight).slice(4, -1))).toBe(true);
    }
  });

  it("name every text style's variables, which exist", () => {
    for (const part of ["family", "size", "weight", "line-height", "letter-spacing", "transform"] as const) {
      expect(defined(textStyleVar("sectionLabel", part).slice(4, -1))).toBe(true);
    }
  });

  it("map tones to the theme's color tokens", () => {
    expect(toneColor("dim")).toBe("var(--text-dim)");
    expect(toneColor("danger")).toBe("var(--danger)");
  });
});
