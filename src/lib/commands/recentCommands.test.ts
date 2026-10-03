import { describe, expect, it } from "vitest";
import { MAX_RECENT_COMMANDS, pickRecentCommands, pushRecentCommand, recentRanks } from "./recentCommands";

describe("recent commands", () => {
  it("moves a used command to the front without duplicates", () => {
    expect(pushRecentCommand([], "git.push")).toEqual(["git.push"]);
    expect(pushRecentCommand(["git.pull", "git.push"], "git.push")).toEqual(["git.push", "git.pull"]);
    expect(pushRecentCommand(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });

  it("keeps at most the limit", () => {
    let recent: string[] = [];
    for (let index = 0; index < 50; index++) {
      recent = pushRecentCommand(recent, `command.${index}`);
    }
    expect(recent).toHaveLength(MAX_RECENT_COMMANDS);
    expect(recent[0]).toBe("command.49");
  });

  it("validates a saved list", () => {
    expect(pickRecentCommands(undefined)).toEqual([]);
    expect(pickRecentCommands("git.push")).toEqual([]);
    expect(pickRecentCommands(["git.push", 3, "", null, "git.push", "x".repeat(101), "view.log"])).toEqual(["git.push", "view.log"]);
    const long = Array.from({ length: 40 }, (_, index) => `command.${index}`);
    expect(pickRecentCommands(long)).toEqual(long.slice(0, MAX_RECENT_COMMANDS));
    // Ids this version does not know are kept for a later one.
    expect(pickRecentCommands(["future.command"])).toEqual(["future.command"]);
  });

  it("ranks by position", () => {
    const ranks = recentRanks(["b", "a"]);
    expect(ranks.get("b")).toBe(0);
    expect(ranks.get("a")).toBe(1);
    expect(ranks.has("c")).toBe(false);
  });
});
