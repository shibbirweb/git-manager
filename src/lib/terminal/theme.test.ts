import { describe, expect, it } from "vitest";
import { buildTerminalTheme, THEME_TOKENS } from "./theme";

describe("buildTerminalTheme", () => {
  it("reads every color from a CSS token", () => {
    const tokens: Record<string, string> = {
      "--term-background": " #1e1f22 ",
      "--term-foreground": "#dfe1e5",
      "--term-cursor": "#dfe1e5",
      "--term-red": "#cd3131",
    };
    const theme = buildTerminalTheme((token) => tokens[token] ?? "");
    expect(theme.background).toBe("#1e1f22");
    expect(theme.foreground).toBe("#dfe1e5");
    expect(theme.cursor).toBe("#dfe1e5");
    expect(theme.red).toBe("#cd3131");
  });

  it("leaves out missing tokens so xterm keeps its default", () => {
    const theme = buildTerminalTheme(() => "");
    expect(theme).toEqual({});
  });

  it("covers the 16 ANSI colors", () => {
    const ansi = Object.keys(THEME_TOKENS).filter((key) => /^(bright)?(black|red|green|yellow|blue|magenta|cyan|white)$/i.test(key));
    expect(ansi).toHaveLength(16);
  });
});
