import { describe, expect, it } from "vitest";
import { titleWorthShowing } from "./sessions.svelte";

describe("titleWorthShowing", () => {
  it("hides a title that only repeats the agent's name", () => {
    expect(titleWorthShowing("Claude Code", "Claude Code", "claude")).toBe("");
    expect(titleWorthShowing("claude", "Claude Code 2", "claude")).toBe("");
    expect(titleWorthShowing("Claude Code", "My agent", "claude")).toBe("");
    expect(titleWorthShowing("  ", "Codex", "codex")).toBe("");
  });

  it("keeps a title that says what the agent does", () => {
    expect(titleWorthShowing(" Fix the login race ", "Claude Code", "claude")).toBe("Fix the login race");
  });
});
