import { describe, expect, it } from "vitest";
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  defaultThemeFor,
  effectiveMode,
  isHighContrast,
  modeOfKind,
  pickerMove,
  pickThemeId,
  THEME_INDEX,
  themeGroups,
  themeInfo,
} from "./themeIndex";

describe("THEME_INDEX", () => {
  it("has the two built-ins plus 10 light, 21 dark and 5 high contrast themes", () => {
    const count = (kinds: string[]) => THEME_INDEX.filter((theme) => kinds.includes(theme.kind)).length;
    expect(THEME_INDEX).toHaveLength(42);
    expect(count(["light"])).toBe(13);
    expect(count(["dark"])).toBe(24);
    expect(count(["high-contrast-light", "high-contrast-dark"])).toBe(5);
  });

  it("uses unique ids and names", () => {
    expect(new Set(THEME_INDEX.map((theme) => theme.id)).size).toBe(THEME_INDEX.length);
    expect(new Set(THEME_INDEX.map((theme) => theme.name)).size).toBe(THEME_INDEX.length);
    expect(THEME_INDEX.every((theme) => /^[a-z0-9-]+$/.test(theme.id))).toBe(true);
  });

  it("keeps the built-ins as the defaults", () => {
    expect(themeInfo(DEFAULT_LIGHT_THEME)?.name).toBe("Git Manager Light");
    expect(themeInfo(DEFAULT_DARK_THEME)?.name).toBe("Git Manager Dark");
    expect(defaultThemeFor("light")).toBe(DEFAULT_LIGHT_THEME);
    expect(defaultThemeFor("dark")).toBe(DEFAULT_DARK_THEME);
  });
});

describe("kinds and modes", () => {
  it("puts high contrast themes in the mode of their base", () => {
    expect(modeOfKind("high-contrast-dark")).toBe("dark");
    expect(modeOfKind("high-contrast-light")).toBe("light");
    expect(isHighContrast("high-contrast-light")).toBe(true);
    expect(isHighContrast("dark")).toBe(false);
  });

  it("follows macOS only for System", () => {
    expect(effectiveMode("system", true)).toBe("dark");
    expect(effectiveMode("system", false)).toBe("light");
    expect(effectiveMode("light", true)).toBe("light");
    expect(effectiveMode("dark", false)).toBe("dark");
  });
});

describe("pickThemeId", () => {
  it("keeps a known theme of the right mode", () => {
    expect(pickThemeId("dracula", "dark")).toBe("dracula");
    expect(pickThemeId("high-contrast-light", "light")).toBe("high-contrast-light");
  });

  it("falls back to the default for unknown ids, other types and the other mode", () => {
    expect(pickThemeId("no-such-theme", "dark")).toBe(DEFAULT_DARK_THEME);
    expect(pickThemeId(42, "light")).toBe(DEFAULT_LIGHT_THEME);
    expect(pickThemeId(undefined, "light")).toBe(DEFAULT_LIGHT_THEME);
    expect(pickThemeId("dracula", "light")).toBe(DEFAULT_LIGHT_THEME);
    expect(pickThemeId("github-light", "dark")).toBe(DEFAULT_DARK_THEME);
  });
});

describe("themeGroups", () => {
  it("lists the mode's themes with high contrast in its own group", () => {
    const dark = themeGroups("dark");
    expect(dark.map((group) => group.label)).toEqual(["Dark", "High contrast"]);
    expect(dark[0].themes).toHaveLength(24);
    expect(dark[0].themes[0].id).toBe(DEFAULT_DARK_THEME);
    expect(dark[1].themes.map((theme) => theme.kind)).toEqual(["high-contrast-dark", "high-contrast-dark", "high-contrast-dark"]);
    const light = themeGroups("light");
    expect(light[0].themes).toHaveLength(13);
    expect(light[1].themes.every((theme) => theme.kind === "high-contrast-light")).toBe(true);
  });

  it("lists every theme exactly once across both pickers", () => {
    const listed = [...themeGroups("light"), ...themeGroups("dark")].flatMap((group) => group.themes.map((theme) => theme.id));
    expect(listed.sort()).toEqual(THEME_INDEX.map((theme) => theme.id).sort());
  });
});

describe("pickerMove", () => {
  it("moves with the arrows and stops at the ends", () => {
    expect(pickerMove(0, "ArrowDown", 5)).toBe(1);
    expect(pickerMove(4, "ArrowDown", 5)).toBe(4);
    expect(pickerMove(0, "ArrowUp", 5)).toBe(0);
    expect(pickerMove(3, "ArrowUp", 5)).toBe(2);
  });

  it("starts from the first or last when nothing is selected", () => {
    expect(pickerMove(-1, "ArrowDown", 5)).toBe(0);
    expect(pickerMove(-1, "ArrowUp", 5)).toBe(4);
  });

  it("jumps with Home, End and the page keys", () => {
    expect(pickerMove(2, "Home", 20)).toBe(0);
    expect(pickerMove(2, "End", 20)).toBe(19);
    expect(pickerMove(2, "PageDown", 20)).toBe(10);
    expect(pickerMove(15, "PageDown", 20)).toBe(19);
    expect(pickerMove(5, "PageUp", 20)).toBe(0);
  });

  it("ignores other keys and empty lists", () => {
    expect(pickerMove(1, "a", 5)).toBeNull();
    expect(pickerMove(0, "ArrowDown", 0)).toBeNull();
  });
});
