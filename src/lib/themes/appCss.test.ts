import { describe, expect, it } from "vitest";
import appCss from "../../app.css?raw";
import { themeColors } from "@git-manager/ui/themes/catalog";
import { COLOR_TOKENS, type ThemeColors } from "@git-manager/ui/themes/colorTokens";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from "@git-manager/ui/themes/themeIndex";

// The built-in themes live in app.css (so they apply without the catalog) and in the design tokens: both must agree.

/** `--name: value;` pairs of the first rule with `selector`. */
function cssBlock(selector: string): Record<string, string> {
  const start = appCss.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = appCss.slice(start + selector.length + 2, appCss.indexOf("}", start));
  const values: Record<string, string> = {};
  for (const match of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    values[match[1]] = match[2].trim();
  }
  return values;
}

/** app.css values with var() references resolved, like the browser's computed style. */
function resolved(values: Record<string, string>): Record<string, string> {
  const read = (value: string): string =>
    value.replace(/var\((--[a-z0-9-]+)\)/g, (_, token: string) => read(values[token] ?? ""));
  return Object.fromEntries(Object.entries(values).map(([token, value]) => [token, read(value)]));
}

function colorsOf(themeId: string): ThemeColors {
  const colors = themeColors(themeId);
  expect(colors, themeId).not.toBeNull();
  return colors as ThemeColors;
}

const root = cssBlock(":root");
const darkBlock = cssBlock(':root[data-theme="dark"]');

describe("app.css color themes", () => {
  it("covers every color token app.css defines", () => {
    const appTokens = Object.keys(root).filter(
      (token) => !/^--(font-|ui-size|code-size|radius|panel-gap|panel-radius)/.test(token),
    );
    expect([...COLOR_TOKENS].sort()).toEqual(appTokens.sort());
  });

  it("matches the built-in light and dark sets in app.css", () => {
    expect(colorsOf(DEFAULT_LIGHT_THEME)).toEqual(
      Object.fromEntries(COLOR_TOKENS.map((token) => [token, resolved(root)[token]])),
    );
    const dark = resolved({ ...root, ...darkBlock });
    expect(colorsOf(DEFAULT_DARK_THEME)).toEqual(Object.fromEntries(COLOR_TOKENS.map((token) => [token, dark[token]])));
  });

  it("keeps app.css's system dark set equal to its explicit dark set", () => {
    expect(cssBlock(':root:not([data-theme="light"])')).toEqual(darkBlock);
  });
});
