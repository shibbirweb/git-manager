import { describe, expect, it } from "vitest";
import colorsCss from "../styles/colors.css?raw";
import { themeColors } from "./catalog";
import { COLOR_TOKENS, type ThemeColors } from "./colorTokens";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from "./themeIndex";

// The built-in themes are in styles/colors.css (so they apply without the catalog) and in the catalog: both agree.

/** `--name: value;` pairs of the rule with `selector`. */
function cssBlock(selector: string): Record<string, string> {
  const start = colorsCss.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = colorsCss.slice(start + selector.length + 2, colorsCss.indexOf("}", start));
  const values: Record<string, string> = {};
  for (const match of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    values[match[1]] = match[2].trim();
  }
  return values;
}

function colorsOf(themeId: string): ThemeColors {
  const colors = themeColors(themeId);
  expect(colors, themeId).not.toBeNull();
  return colors as ThemeColors;
}

describe("styles/colors.css", () => {
  it("defines every color token and nothing else", () => {
    expect(Object.keys(cssBlock(":root")).sort()).toEqual([...COLOR_TOKENS].sort());
  });

  it("equals the catalog's built-in light and dark sets", () => {
    expect(colorsOf(DEFAULT_LIGHT_THEME)).toEqual(cssBlock(":root"));
    expect(colorsOf(DEFAULT_DARK_THEME)).toEqual(cssBlock(':root[data-theme="dark"]'));
  });
});
