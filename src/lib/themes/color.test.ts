import { describe, expect, it } from "vitest";
import {
  colorDistance,
  composite,
  contrastRatio,
  ensureContrast,
  fitTint,
  isDarkColor,
  luminance,
  mix,
  parseColor,
  toHex,
  withAlpha,
} from "./color";

describe("parseColor", () => {
  it("reads short and long hex, with and without alpha", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#1e1f22")).toEqual({ r: 30, g: 31, b: 34, a: 1 });
    expect(parseColor("#0000ff80")?.a).toBeCloseTo(128 / 255);
    expect(parseColor("#f008")?.r).toBe(255);
  });

  it("reads rgb() and rgba() and clamps out of range values", () => {
    expect(parseColor("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseColor("rgba(300, 0, 0, 2)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor(" RGBA(10, 20, 30, 0.5) ")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
  });

  it("returns null for anything else", () => {
    expect(parseColor("")).toBeNull();
    expect(parseColor("red")).toBeNull();
    expect(parseColor("#12345")).toBeNull();
    expect(parseColor("0 8px 28px rgba(0, 0, 0, 0.5)")).toBeNull();
    expect(parseColor(undefined as unknown as string)).toBeNull();
  });
});

describe("mixing", () => {
  it("mixes by weight and clamps the weight", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 3)).toBe("#ffffff");
  });

  it("writes rgba() and drops alpha for hex", () => {
    expect(withAlpha("#3574f0", 0.2)).toBe("rgba(53, 116, 240, 0.2)");
    expect(toHex("rgba(53, 116, 240, 0.2)")).toBe("#3574f0");
    expect(toHex("not a color")).toBe("#000000");
  });

  it("paints a translucent color over an opaque one", () => {
    expect(composite("rgba(0, 0, 0, 0.5)", "#ffffff")).toBe("#808080");
    expect(composite("#123456", "#ffffff")).toBe("#123456");
  });
});

describe("contrast", () => {
  it("follows the WCAG formula", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1);
    expect(luminance("#000000")).toBe(0);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1);
    // The order of the two colors does not matter.
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#767676"));
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThan(4.5);
  });

  it("tells dark backgrounds from light ones", () => {
    expect(isDarkColor("#1e1f22")).toBe(true);
    expect(isDarkColor("#f7f8fa")).toBe(false);
  });

  it("leaves a passing color alone and moves a failing one until it passes", () => {
    expect(ensureContrast("#000000", "#ffffff", 4.5)).toBe("#000000");
    const fixed = ensureContrast("#ffcc00", "#ffffff", 3);
    expect(contrastRatio(fixed, "#ffffff")).toBeGreaterThanOrEqual(3);
    // It darkens, keeping the hue: still more red than blue.
    const { r, b } = parseColor(fixed) ?? { r: 0, b: 0 };
    expect(r).toBeGreaterThan(b);
    const lifted = ensureContrast("#333333", "#000000", 7);
    expect(contrastRatio(lifted, "#000000")).toBeGreaterThanOrEqual(7);
  });

  it("returns the best it can when the target cannot be reached", () => {
    const result = ensureContrast("#808080", "#808080", 30);
    expect(contrastRatio(result, "#808080")).toBeGreaterThan(5);
  });
});

describe("colorDistance", () => {
  it("is zero for equal colors and large for black and white", () => {
    expect(colorDistance("#3574f0", "#3574f0")).toBeCloseTo(0);
    expect(colorDistance("#000000", "#ffffff")).toBeGreaterThan(99);
  });

  it("paints translucent colors over the background first", () => {
    expect(colorDistance("rgba(0, 0, 0, 0)", "#ffffff", "#ffffff")).toBeCloseTo(0);
    expect(colorDistance("rgba(76, 175, 80, 0.16)", "#ffffff", "#ffffff")).toBeGreaterThan(5);
  });
});

describe("fitTint", () => {
  it("keeps the alpha when text stays readable", () => {
    expect(fitTint("#4caf50", "#ffffff", "#000000", 0.2, 4.5)).toBe("rgba(76, 175, 80, 0.2)");
  });

  it("fades the tint until text on it is readable again", () => {
    const tint = fitTint("#a5e075", "#282c34", "#abb2bf", 0.2, 4.5);
    const alpha = parseColor(tint)?.a ?? 1;
    expect(alpha).toBeLessThan(0.2);
    expect(contrastRatio("#abb2bf", composite(tint, "#282c34"))).toBeGreaterThanOrEqual(4.5);
  });

  it("never fades below a third of the alpha", () => {
    const tint = fitTint("#ffffff", "#000000", "#202020", 0.3, 21);
    expect(parseColor(tint)?.a).toBeCloseTo(0.1);
  });
});
