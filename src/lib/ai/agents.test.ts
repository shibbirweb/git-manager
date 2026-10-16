import { describe, expect, it } from "vitest";
import { AGENTS, agentArguments, agentById, commandLine, promptArguments, splitArguments } from "./agents";

describe("the agent catalog", () => {
  it("has unique ids and programs, and finds agents by id", () => {
    expect(new Set(AGENTS.map((agent) => agent.id)).size).toBe(AGENTS.length);
    expect(new Set(AGENTS.map((agent) => agent.program)).size).toBe(AGENTS.length);
    expect(agentById("claude")?.label).toBe("Claude Code");
    expect(agentById("nope")).toBeNull();
  });
});

describe("splitArguments", () => {
  it("splits on spaces and keeps quoted words together", () => {
    expect(splitArguments(`--model opus  --name "my agent" 'it''s'`)).toEqual([
      "--model",
      "opus",
      "--name",
      "my agent",
      "its",
    ]);
  });

  it("keeps escaped characters and empty quoted words", () => {
    expect(splitArguments(String.raw`a\ b "say \"hi\"" ''`)).toEqual(["a b", 'say "hi"', ""]);
  });

  it("runs an unclosed quote to the end and ignores blank text", () => {
    expect(splitArguments(`--x "open end`)).toEqual(["--x", "open end"]);
    expect(splitArguments("   \t ")).toEqual([]);
  });
});

describe("agentArguments", () => {
  const claude = agentById("claude")!;
  const qwen = agentById("qwen")!;
  const opencode = agentById("opencode")!;

  it("adds the full-autonomy flags only in full mode, before the extra arguments", () => {
    expect(agentArguments(claude, "normal", "--model opus")).toEqual(["--model", "opus"]);
    expect(agentArguments(claude, "full", "--model opus")).toEqual([
      "--dangerously-skip-permissions",
      "--model",
      "opus",
    ]);
    expect(agentArguments(qwen, "full", "")).toEqual(["--approval-mode", "yolo"]);
  });

  it("does not repeat flags the extra arguments already have, and has none for agents without them", () => {
    expect(agentArguments(claude, "full", "--dangerously-skip-permissions")).toEqual([
      "--dangerously-skip-permissions",
    ]);
    expect(agentArguments(opencode, "full", "")).toEqual([]);
  });
});

describe("commandLine", () => {
  it("quotes words a shell would split or expand", () => {
    expect(commandLine("claude", ["--name", "my agent", "it's", "$HOME", ""])).toBe(
      `claude --name 'my agent' 'it'\\''s' '$HOME' ''`,
    );
  });
});

describe("promptArguments", () => {
  it("passes a first prompt the way each agent takes it", () => {
    expect(promptArguments(agentById("claude")!, " Fix the login race ")).toEqual({
      args: ["Fix the login race"],
      typed: null,
    });
    expect(promptArguments(agentById("gemini")!, "Fix it")).toEqual({
      args: ["--prompt-interactive", "Fix it"],
      typed: null,
    });
    expect(promptArguments(agentById("copilot")!, "Fix it")).toEqual({ args: ["-i", "Fix it"], typed: null });
    expect(promptArguments(agentById("aider")!, "Fix it\n  then test")).toEqual({
      args: [],
      typed: "Fix it then test",
    });
  });

  it("adds nothing for a blank prompt, and every agent has a prompt mode", () => {
    expect(promptArguments(agentById("codex")!, "   ")).toEqual({ args: [], typed: null });
    expect(AGENTS.every((agent) => ["argument", "flag", "typed"].includes(agent.prompt.kind))).toBe(true);
  });
});
