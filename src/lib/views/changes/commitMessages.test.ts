import { describe, expect, it } from "vitest";
import {
  cleanMessage,
  historyLabel,
  MAX_HISTORY_REPOS,
  MAX_MESSAGE_HISTORY,
  MAX_MESSAGE_LENGTH,
  mergeHistory,
  parseMessageHistory,
  pruneRepos,
  rememberInHistory,
  rememberMessage,
} from "./commitMessages";

describe("commit message history", () => {
  it("cleans messages like git", () => {
    expect(cleanMessage("\n  \nfeat: x\n\nbody  \n\n")).toBe("feat: x\n\nbody");
    expect(cleanMessage("  indented subject")).toBe("  indented subject");
    expect(cleanMessage(" \n\t\n")).toBe("");
  });

  it("puts a remembered message first, once, and caps the list", () => {
    let entries = rememberMessage([], "one", 1);
    entries = rememberMessage(entries, "two\n", 2);
    entries = rememberMessage(entries, "one", 3);
    expect(entries).toEqual([
      { message: "one", time: 3 },
      { message: "two", time: 2 },
    ]);
    const blank = rememberMessage(entries, "  \n", 4);
    expect(blank).toBe(entries);
    expect(rememberMessage(entries, "x".repeat(MAX_MESSAGE_LENGTH + 1), 5)).toBe(entries);
    let many = entries;
    for (let index = 0; index < 40; index++) {
      many = rememberMessage(many, `message ${index}`, 10 + index);
    }
    expect(many).toHaveLength(MAX_MESSAGE_HISTORY);
    expect(many[0].message).toBe("message 39");
  });

  it("merges saved and committed messages newest first, each once", () => {
    const saved = [
      { message: "typed, not committed", time: 500 },
      { message: "fix: both", time: 100 },
    ];
    const fromLog = [
      { message: "fix: both", time: 300 },
      { message: "older commit", time: 50 },
      { message: "   ", time: 900 },
    ];
    expect(mergeHistory(saved, fromLog)).toEqual([
      { message: "typed, not committed", time: 500 },
      { message: "fix: both", time: 300 },
      { message: "older commit", time: 50 },
    ]);
    expect(mergeHistory(saved, fromLog, 1)).toHaveLength(1);
  });

  it("keeps the most recently used repositories", () => {
    const history: Record<string, { message: string; time: number }[]> = {};
    for (let index = 0; index < MAX_HISTORY_REPOS + 5; index++) {
      history[`/repo/${index}`] = [{ message: "m", time: index }];
    }
    const pruned = pruneRepos(history);
    expect(Object.keys(pruned)).toHaveLength(MAX_HISTORY_REPOS);
    expect(pruned["/repo/0"]).toBeUndefined();
    expect(pruned[`/repo/${MAX_HISTORY_REPOS + 4}`]).toBeDefined();
  });

  it("remembers per repository and returns the same object when nothing changes", () => {
    const empty = {};
    expect(rememberInHistory(empty, "/a", "  ", 1)).toBe(empty);
    const one = rememberInHistory(empty, "/a", "feat: a", 1);
    expect(one).toEqual({ "/a": [{ message: "feat: a", time: 1 }] });
    const two = rememberInHistory(one, "/b", "feat: b", 2);
    expect(Object.keys(two)).toEqual(["/a", "/b"]);
    expect(one).toEqual({ "/a": [{ message: "feat: a", time: 1 }] });
  });

  it("validates what state.json holds", () => {
    expect(parseMessageHistory(null)).toEqual({});
    expect(parseMessageHistory([])).toEqual({});
    expect(parseMessageHistory({ "/a": "nope", "": [{ message: "x", time: 1 }] })).toEqual({});
    const parsed = parseMessageHistory({
      "/a": [
        { message: "good\n", time: 2 },
        { message: "good", time: 1 },
        { message: 5, time: 1 },
        { message: "no time" },
        { message: "infinite", time: Number.POSITIVE_INFINITY },
        null,
        { message: "  ", time: 3 },
      ],
      "/b": [],
    });
    expect(parsed).toEqual({ "/a": [{ message: "good", time: 2 }] });
    const long = Array.from({ length: 40 }, (_, index) => ({ message: `m${index}`, time: index }));
    expect(parseMessageHistory({ "/a": long })["/a"]).toHaveLength(MAX_MESSAGE_HISTORY);
  });

  it("labels a message by its first line", () => {
    expect(historyLabel("feat: x\n\nbody")).toBe("feat: x");
    expect(historyLabel("\nsubject")).toBe("subject");
    expect(historyLabel("a".repeat(100), 10)).toBe("aaaaaaa...");
    expect(historyLabel("")).toBe("(empty first line)");
  });
});
