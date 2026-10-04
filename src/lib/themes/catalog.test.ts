import { describe, expect, it } from "vitest";
import appCss from "../../app.css?raw";
import { catalogThemeIds, themeColors, themeCss, themeSwatch } from "./catalog";
import { colorDistance, composite, contrastRatio, parseColor } from "./color";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, isHighContrast, THEME_INDEX } from "./themeIndex";
import { COLOR_TOKENS, type ThemeColors } from "./tokens";

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
  const read = (value: string): string => value.replace(/var\((--[a-z0-9-]+)\)/g, (_, token: string) => read(values[token] ?? ""));
  return Object.fromEntries(Object.entries(values).map(([token, value]) => [token, read(value)]));
}

function colorsOf(themeId: string): ThemeColors {
  const colors = themeColors(themeId);
  expect(colors, themeId).not.toBeNull();
  return colors as ThemeColors;
}

const root = cssBlock(":root");
const darkBlock = cssBlock(':root[data-theme="dark"]');

describe("catalog", () => {
  it("has a palette for every listed theme", () => {
    expect(catalogThemeIds()).toEqual(THEME_INDEX.map((theme) => theme.id));
  });

  it("knows nothing about unknown ids", () => {
    expect(themeColors("no-such-theme")).toBeNull();
    expect(themeCss("no-such-theme")).toBeNull();
    expect(themeSwatch("no-such-theme")).toBeNull();
  });

  it("covers every color token app.css defines", () => {
    const appTokens = Object.keys(root).filter((token) => !/^--(font-|ui-size|code-size|radius|island-)/.test(token));
    expect([...COLOR_TOKENS].sort()).toEqual(appTokens.sort());
  });

  it("matches the built-in light and dark sets in app.css", () => {
    expect(colorsOf(DEFAULT_LIGHT_THEME)).toEqual(Object.fromEntries(COLOR_TOKENS.map((token) => [token, resolved(root)[token]])));
    const dark = resolved({ ...root, ...darkBlock });
    expect(colorsOf(DEFAULT_DARK_THEME)).toEqual(Object.fromEntries(COLOR_TOKENS.map((token) => [token, dark[token]])));
  });

  it("keeps app.css's system dark set equal to its explicit dark set", () => {
    expect(cssBlock(':root:not([data-theme="light"])')).toEqual(darkBlock);
  });

  it("writes one scoped rule with every token and the color scheme", () => {
    const css = themeCss("dracula") ?? "";
    expect(css.startsWith('html:root[data-color-theme="dracula"] {')).toBe(true);
    for (const token of COLOR_TOKENS) {
      expect(css).toContain(`  ${token}: `);
    }
    expect(css).toContain("color-scheme: dark;");
    expect(themeCss("github-light")).toContain("color-scheme: light;");
    expect(css).not.toContain("undefined");
  });

  it("gives swatches the editor colors", () => {
    expect(themeSwatch("dracula")).toEqual({
      background: "#282a36",
      foreground: "#f8f8f2",
      keyword: "#ff79c6",
      string: "#f1fa8c",
      selection: "#44475a",
      accent: "#bd93f9",
      border: "#44475a",
    });
  });
});

// Accessibility: every theme, including the built-ins, must pass these.
describe.each(THEME_INDEX.map((theme) => [theme.name, theme] as const))("%s", (_name, theme) => {
  const colors = colorsOf(theme.id);
  const textMinimum = isHighContrast(theme.kind) ? 7 : 4.5;
  const editorBg = colors["--editor-bg"];
  const text = colors["--text"];

  it("defines every token with a real color", () => {
    for (const token of COLOR_TOKENS) {
      if (token === "--shadow") {
        expect(colors[token]).toMatch(/rgba\(/);
      } else {
        expect(parseColor(colors[token]), token).not.toBeNull();
      }
    }
    expect(parseColor(editorBg)?.a).toBe(1);
    expect(parseColor(colors["--panel"])?.a).toBe(1);
  });

  it(`has editor and UI text at ${textMinimum}:1 or more`, () => {
    expect(contrastRatio(text, editorBg)).toBeGreaterThanOrEqual(textMinimum);
    expect(contrastRatio(text, colors["--panel"])).toBeGreaterThanOrEqual(textMinimum);
    expect(contrastRatio(text, colors["--bg"])).toBeGreaterThanOrEqual(textMinimum);
  });

  it("has a visible selection that text stays readable on", () => {
    const selection = composite(colors["--editor-selection"], editorBg);
    expect(contrastRatio(selection, editorBg)).toBeGreaterThanOrEqual(1.3);
    expect(contrastRatio(text, selection)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(text, colors["--selected"])).toBeGreaterThanOrEqual(4.5);
  });

  it("has diff tints that stand out and keep text readable", () => {
    for (const token of ["--diff-added", "--diff-deleted", "--diff-modified", "--diff-conflict"] as const) {
      expect(colorDistance(colors[token], editorBg, editorBg), token).toBeGreaterThanOrEqual(5);
      expect(contrastRatio(text, composite(colors[token], editorBg)), token).toBeGreaterThanOrEqual(4.5);
    }
    expect(colorDistance(colors["--diff-added"], colors["--diff-deleted"], editorBg)).toBeGreaterThanOrEqual(5);
  });

  it("has readable button text", () => {
    expect(contrastRatio(colors["--accent-text"], colors["--accent"])).toBeGreaterThanOrEqual(3);
  });
});
