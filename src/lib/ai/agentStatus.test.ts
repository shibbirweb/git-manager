import { describe, expect, it } from "vitest";
import { cleanTitle, isStatusOnlyTitle, needsAttention, nextState, stateLabel, statusFromTitle } from "./agentStatus";

describe("statusFromTitle", () => {
  it.each([
    // Claude Code: a spinner while it works (braille, or quarter circles in newer versions), ✳ at rest.
    ["⠐ Fixing the login race", "working"],
    ["◑ Fixing the login race", "working"],
    ["✳ Fixing the login race", "idle"],
    ["✳", "idle"],
    ["Claude Code", "idle"],
    ["claude - action required", "waiting"],
    // Gemini CLI marks.
    ["✦ Gemini CLI", "working"],
    ["⏲ Working (my-repo)", "working"],
    ["◇ Ready (my-repo)", "idle"],
    ["✋ Action Required (my-repo)", "waiting"],
    // Words next to an agent's name.
    ["codex working", "working"],
    ["codex.exe ready", "idle"],
    ["Copilot thinking", "working"],
    ["aider waiting for permission", "waiting"],
    // OpenCode's own titles carry the session summary, which is never status.
    ["OC | waiting on the flaky test", "idle"],
    ["OC | ⠋ ask claude about this", "working"],
  ] as const)("%s is %s", (title, status) => {
    expect(statusFromTitle(title)).toBe(status);
  });

  it.each([
    "",
    "   ",
    "~/codex/ready",
    "reworking the parser",
    "timestamp ready",
    "zsh",
    "/work/opencode-blinker",
    "OC |",
  ])("%j says nothing", (title) => {
    expect(statusFromTitle(title)).toBeNull();
  });
});

describe("cleanTitle", () => {
  it("drops spinner frames and status marks", () => {
    expect(cleanTitle("⠐ Fixing the login race")).toBe("Fixing the login race");
    expect(cleanTitle("✳ Fixing the login race")).toBe("Fixing the login race");
    expect(cleanTitle("◇  Ready (my-repo)")).toBe("Ready (my-repo)");
    expect(cleanTitle(". working")).toBe("working");
    expect(cleanTitle("✳")).toBe("");
  });
});

describe("isStatusOnlyTitle", () => {
  it.each(["claude - action required", "Codex working", "Claude Code", "\u2733 Claude Code", "gemini (ready)", "  "])(
    "%j only says the state",
    (title) => {
      expect(isStatusOnlyTitle(title)).toBe(true);
    },
  );

  it.each(["\u2810 Fixing the login race", "Update the tax rates", "claude: review the parser"])(
    "%j says the task",
    (title) => {
      expect(isStatusOnlyTitle(title)).toBe(false);
    },
  );
});

describe("nextState", () => {
  it("is ready before any work and done after it", () => {
    expect(nextState("starting", "idle")).toBe("ready");
    expect(nextState("ready", "working")).toBe("working");
    expect(nextState("working", "idle")).toBe("done");
    expect(nextState("waiting", "idle")).toBe("done");
    expect(nextState("done", "idle")).toBe("done");
    expect(nextState("working", "waiting")).toBe("waiting");
  });

  it("keeps the state for a title that says nothing, except that a started agent is ready", () => {
    expect(nextState("working", null)).toBe("working");
    expect(nextState("starting", null)).toBe("ready");
  });
});

describe("needsAttention", () => {
  it("is true when work ends or the agent asks", () => {
    expect(needsAttention("working", "done")).toBe(true);
    expect(needsAttention("working", "waiting")).toBe(true);
    expect(needsAttention("ready", "working")).toBe(false);
    expect(needsAttention("done", "done")).toBe(false);
    expect(needsAttention("starting", "ready")).toBe(false);
  });
});

describe("stateLabel", () => {
  it("names every state", () => {
    expect(
      ["starting", "working", "waiting", "ready", "done", "exited"].map((state) => stateLabel(state as never)),
    ).toEqual(["Starting", "Working", "Needs you", "Ready", "Done", "Exited"]);
  });
});
