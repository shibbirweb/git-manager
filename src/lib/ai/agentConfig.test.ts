import { describe, expect, it } from "vitest";
import { defaultFields, effectiveAgent, joinArguments, withField } from "./agentConfig";
import { agentArguments, agentById, promptArguments } from "./agents";

const claude = agentById("claude")!;
const gemini = agentById("gemini")!;

describe("effectiveAgent", () => {
  it("is the catalog's agent without changes", () => {
    const agent = effectiveAgent(claude, undefined);
    expect([agent.program, agent.baseArgs, agent.fullAutonomyArgs, agent.prompt, agent.customized]).toEqual([
      "claude",
      [],
      ["--dangerously-skip-permissions"],
      { kind: "argument" },
      false,
    ]);
  });

  it("takes a changed command with its own first arguments", () => {
    const agent = effectiveAgent(claude, { command: "npx -y @anthropic-ai/claude-code" });
    expect([agent.program, agent.baseArgs, agent.customized]).toEqual(["npx", ["-y", "@anthropic-ai/claude-code"], true]);
  });

  it("takes renamed full-autonomy flags, and none at all when the field is emptied", () => {
    const renamed = effectiveAgent(claude, { fullAutonomyArgs: "--permission-mode bypassPermissions" });
    expect(agentArguments(renamed, "full", "")).toEqual(["--permission-mode", "bypassPermissions"]);
    expect(agentArguments(effectiveAgent(claude, { fullAutonomyArgs: "" }), "full", "--model opus")).toEqual(["--model", "opus"]);
  });

  it("changes how the first prompt goes", () => {
    const flagged = effectiveAgent(claude, { promptStyle: "flag", promptFlag: "--prompt" });
    expect(promptArguments(flagged, "Fix it")).toEqual({ args: ["--prompt", "Fix it"], typed: null });
    expect(promptArguments(effectiveAgent(claude, { promptStyle: "typed" }), "Fix it")).toEqual({ args: [], typed: "Fix it" });
    expect(promptArguments(effectiveAgent(claude, { promptStyle: "none" }), "Fix it")).toEqual({ args: [], typed: null });
    // A flag style without a flag keeps the agent's own flag, or its own mode.
    expect(effectiveAgent(gemini, { promptStyle: "flag", promptFlag: " " }).prompt).toEqual({ kind: "flag", flag: "--prompt-interactive" });
    expect(effectiveAgent(claude, { promptStyle: "flag" }).prompt).toEqual({ kind: "argument" });
  });

  it("keeps the default command when the field is blank", () => {
    expect(effectiveAgent(claude, { command: "   " }).program).toBe("claude");
  });
});

describe("settings fields", () => {
  it("shows the defaults", () => {
    expect(defaultFields(gemini)).toEqual({
      command: "gemini",
      fullAutonomyArgs: "--yolo",
      promptStyle: "flag",
      promptFlag: "--prompt-interactive",
    });
    expect(joinArguments(["--allow", "*", "two words", 'say "hi"'])).toBe('--allow * "two words" "say \\"hi\\""');
  });

  it("drops a field set back to its default, and the whole entry when nothing is left", () => {
    expect(withField(claude, undefined, "command", "claude-beta")).toEqual({ command: "claude-beta" });
    expect(withField(claude, { command: "claude-beta" }, "command", "claude")).toBeNull();
    expect(withField(claude, { command: "x" }, "command", "  ")).toBeNull();
    expect(withField(claude, { command: "x" }, "promptStyle", "typed")).toEqual({ command: "x", promptStyle: "typed" });
    expect(withField(claude, undefined, "fullAutonomyArgs", "")).toEqual({ fullAutonomyArgs: "" });
  });
});
