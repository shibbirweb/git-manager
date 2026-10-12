import { describe, expect, it } from "vitest";
import { buildTerminalTheme, TERMINAL_THEME_TOKENS } from "./terminalTheme";

describe("buildTerminalTheme", () => {
  it("reads every token into its key", () => {
    const theme = buildTerminalTheme((token) => `value of ${token}`);
    expect(Object.keys(theme)).toHaveLength(Object.keys(TERMINAL_THEME_TOKENS).length);
    expect(theme.background).toBe("value of --term-background");
    expect(theme.cursorAccent).toBe("value of --term-background");
  });

  it("leaves out missing and empty tokens", () => {
    const values: Record<string, string> = { "--term-red": " #cd3131 ", "--term-blue": "" };
    const theme = buildTerminalTheme((token) => values[token]);
    expect(theme).toEqual({ red: "#cd3131" });
  });
});
