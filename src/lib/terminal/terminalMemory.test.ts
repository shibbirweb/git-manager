import { describe, expect, it } from "vitest";
import { formatBytes } from "$lib/ui/formatBytes";
import { terminalMemoryRows, terminalMemoryTitle, terminalMemoryTotal } from "./terminalMemory";

const MB = 1024 * 1024;

const entries = [
  { key: 1, terminalId: 11, name: "zsh", cwd: "/work/app/", location: "panel" as const, agent: null },
  {
    key: 2,
    terminalId: 12,
    name: "Claude",
    cwd: null,
    location: "editor" as const,
    agent: {
      agentId: "claude",
      folderPath: "/work/app-fix",
      title: "Fix login",
      state: "working" as const,
      changedAt: 0,
    },
  },
  { key: 3, terminalId: 13, name: "test", cwd: "/work/app", location: "run" as const },
  { key: 4, terminalId: null, name: "not started", cwd: null, location: "panel" as const },
];

describe("terminalMemoryRows", () => {
  it("names each terminal, agent and run, biggest first", () => {
    const rows = terminalMemoryRows(
      [
        { terminalId: 11, bytes: 5 * MB, processes: 1 },
        { terminalId: 12, bytes: 300 * MB, processes: 4 },
        { terminalId: 13, bytes: 40 * MB, processes: 2 },
      ],
      entries,
    );
    expect(rows.map((row) => [row.terminalKey, row.kind, row.label, row.folderName])).toEqual([
      [2, "agent", "Fix login", "app-fix"],
      [3, "run", "test", "app"],
      [1, "terminal", "zsh", "app"],
    ]);
    expect(terminalMemoryTotal(rows)).toBe(345 * MB);
  });

  it("keeps a terminal this window no longer lists, without a target", () => {
    const rows = terminalMemoryRows([{ terminalId: 99, bytes: MB, processes: 1 }], entries);
    expect(rows).toEqual([
      {
        terminalId: 99,
        terminalKey: null,
        kind: "terminal",
        label: "Terminal",
        folderName: "",
        bytes: MB,
        processes: 1,
      },
    ]);
  });

  it("falls back to the tab name before the agent has a title, and sorts ties by name", () => {
    const untitled = [{ ...entries[1], agent: { ...entries[1].agent!, title: "" } }, entries[0]];
    const rows = terminalMemoryRows(
      [
        { terminalId: 11, bytes: MB, processes: 1 },
        { terminalId: 12, bytes: MB, processes: 1 },
      ],
      untitled,
    );
    expect(rows.map((row) => row.label)).toEqual(["Claude", "zsh"]);
  });

  it("is empty without terminals", () => {
    expect(terminalMemoryRows([], entries)).toEqual([]);
    expect(terminalMemoryTotal([])).toBe(0);
  });
});

describe("terminalMemoryTitle", () => {
  it("says what the row counts", () => {
    const [agent, run] = terminalMemoryRows(
      [
        { terminalId: 12, bytes: 2 * MB, processes: 3 },
        { terminalId: 13, bytes: MB, processes: 1 },
      ],
      entries,
    );
    expect(terminalMemoryTitle(agent)).toBe("Agent in app-fix: the shell and what it started, 3 processes");
    expect(terminalMemoryTitle(run)).toBe("Run in app: the shell and what it started, 1 process");
  });
});

describe("formatBytes", () => {
  it("uses KB, MB and GB like the status bar", () => {
    expect(formatBytes(512 * 1024)).toBe("512 KB");
    expect(formatBytes(1.5 * MB)).toBe("1.5 MB");
    expect(formatBytes(250 * MB)).toBe("250 MB");
    expect(formatBytes(3 * 1024 * MB)).toBe("3.00 GB");
  });
});
