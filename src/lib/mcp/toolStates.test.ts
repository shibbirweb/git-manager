import { describe, expect, it } from "vitest";
import {
  changedTools,
  filterTools,
  groupTools,
  toolBadge,
  toolCountLabel,
  toolEnabled,
  withDefaultStates,
  withToolStates,
} from "./toolStates";

const status = { name: "git_status", title: "Git Status", description: "Shows the status.", category: "Git", readOnly: true, destructive: false };
const send = { name: "send_terminal_text", title: "Send Text", description: "Types into a terminal.", category: "Terminal", readOnly: false, destructive: true };
const open = { name: "open_file", title: "Open File", description: "Opens a file.", category: "Files", readOnly: true, destructive: false };
const trash = { name: "trash_paths", title: "Move to Trash", description: "Moves files to the Trash.", category: "Files", readOnly: false, destructive: true };
const create = { name: "create_file", title: "Create File", description: "Creates a file.", category: "Files", readOnly: false, destructive: false };
const commit = { name: "git_commit", title: "Commit", description: "Commits.", category: "Git", readOnly: false, destructive: false };

describe("tool switches", () => {
  it("default to on unless destructive", () => {
    expect(toolEnabled(status, {})).toBe(true);
    expect(toolEnabled(send, {})).toBe(false);
    expect(toolEnabled(status, { git_status: false })).toBe(false);
    expect(toolEnabled(send, { send_terminal_text: true })).toBe(true);
    expect(toolEnabled(trash, {})).toBe(false);
    expect(toolEnabled(create, {})).toBe(true);
    expect(withToolStates({}, [trash, create], true)).toEqual({ trash_paths: true });
  });

  it("keep only the choices that differ from the default", () => {
    const off = withToolStates({}, [status], false);
    expect(off).toEqual({ git_status: false });
    expect(withToolStates(off, [status], true)).toEqual({});
    expect(withToolStates({}, [send], true)).toEqual({ send_terminal_text: true });
    expect(withToolStates({ send_terminal_text: true }, [send], false)).toEqual({});
    expect(withToolStates({ other: false }, [status, send], false)).toEqual({ other: false, git_status: false });
  });

  it("restore the defaults of the tools given and keep the rest", () => {
    const states = { git_status: false, send_terminal_text: true, trash_paths: true, git_commit: false };
    expect(changedTools(states, [status, send, open, trash]).map((tool) => tool.name)).toEqual([
      "git_status",
      "send_terminal_text",
      "trash_paths",
    ]);
    expect(changedTools({ git_status: true, send_terminal_text: false }, [status, send])).toEqual([]);
    expect(withDefaultStates(states, [status, send, open])).toEqual({ trash_paths: true, git_commit: false });
    const restored = withDefaultStates(states, [status, send, trash, commit]);
    expect(restored).toEqual({});
    expect([status, send, trash, commit].map((tool) => toolEnabled(tool, restored))).toEqual([true, false, false, true]);
  });
});

describe("the tools list", () => {
  it("filters on every word", () => {
    const tools = [status, send, open, commit];
    expect(filterTools(tools, "")).toEqual(tools);
    expect(filterTools(tools, "git").map((tool) => tool.name)).toEqual(["git_status", "git_commit"]);
    expect(filterTools(tools, "terminal types").map((tool) => tool.name)).toEqual(["send_terminal_text"]);
    expect(filterTools(tools, "nothing")).toEqual([]);
  });

  it("groups by category in the contract's order, sorted by title", () => {
    const groups = groupTools([send, status, open, commit, { ...open, name: "x", title: "X", category: "Later" }]);
    expect(groups.map((group) => group.category)).toEqual(["Git", "Files", "Terminal", "Later"]);
    expect(groups[0].tools.map((tool) => tool.title)).toEqual(["Commit", "Git Status"]);
  });

  it("labels the tools", () => {
    expect(toolBadge(status)).toBe("read only");
    expect(toolBadge(commit)).toBe("can change files");
    expect(toolBadge(send)).toBe("destructive");
    expect(toolBadge(trash)).toBe("destructive");
    expect(toolBadge(create)).toBe("can change files");
    expect(toolCountLabel(31, 58)).toBe("31 of 58 tools on");
    expect(toolCountLabel(1, 1)).toBe("1 of 1 tool on");
  });
});
