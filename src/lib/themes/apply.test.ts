import { describe, expect, it } from "vitest";
import { needsCatalog, themeAttributes } from "./apply";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from "./themeIndex";

describe("themeAttributes", () => {
  it("names the mode, the theme and high contrast", () => {
    expect(themeAttributes("dark", "dracula")).toEqual({ theme: "dark", colorTheme: "dracula", contrast: null, islands: false });
    expect(themeAttributes("light", "high-contrast-light")).toEqual({
      theme: "light",
      colorTheme: "high-contrast-light",
      contrast: "high",
      islands: false,
    });
  });

  it("asks for the islands layout only for the Islands themes", () => {
    expect(themeAttributes("dark", "islands-dark").islands).toBe(true);
    expect(themeAttributes("light", "islands-light").islands).toBe(true);
    expect(themeAttributes("light", "islands-dark").islands).toBe(false);
    expect(themeAttributes("dark", DEFAULT_DARK_THEME).islands).toBe(false);
  });

  it("falls back to the mode's default for ids of the other mode or unknown ones", () => {
    expect(themeAttributes("light", "dracula").colorTheme).toBe(DEFAULT_LIGHT_THEME);
    expect(themeAttributes("dark", "nope").colorTheme).toBe(DEFAULT_DARK_THEME);
  });
});

describe("needsCatalog", () => {
  it("is false only for the built-in themes, which live in app.css", () => {
    expect(needsCatalog("light", DEFAULT_LIGHT_THEME)).toBe(false);
    expect(needsCatalog("dark", DEFAULT_DARK_THEME)).toBe(false);
    expect(needsCatalog("dark", "unknown")).toBe(false);
    expect(needsCatalog("dark", "nord")).toBe(true);
    expect(needsCatalog("light", "github-light-high-contrast")).toBe(true);
  });
});
