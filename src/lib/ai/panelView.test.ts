import { describe, expect, it } from "vitest";
import type { RepoInfo, WorktreeInfo } from "$lib/types";
import { agentMark, attentionCounts, filterRows, formatAge, groupRows, mostUrgent } from "./panelView";
import { type AgentSession, type AgentState, panelRows, type ProjectFolder, workspaceProjects } from "./projects";

function repo(root: string): RepoInfo {
  return { root, name: root.slice(root.lastIndexOf("/") + 1), relativePath: "" };
}

function worktree(path: string, branch: string, isMain = false): WorktreeInfo {
  return {
    path,
    head: "0123456789abcdef0123456789abcdef01234567",
    branch,
    detached: false,
    bare: false,
    locked: false,
    lockReason: null,
    prunable: false,
    prunableReason: null,
    isMain,
    isCurrent: isMain,
  };
}

function session(terminalKey: number, folderPath: string, state: AgentState, title = ""): AgentSession {
  return { terminalKey, name: `Agent ${terminalKey}`, folderPath, state, title, agentId: "claude", changedAt: 0 };
}

const folders: ProjectFolder[] = [
  { root: "/work/app", name: "app", repoRoots: ["/work/app"] },
  { root: "/work/notes", name: "notes", repoRoots: [] },
];
const projects = workspaceProjects(folders, [repo("/work/app")]);
const worktrees = {
  "/work/app": [worktree("/work/app", "main", true), worktree("/work/app-login", "fix/login")],
};
const sessions = [
  session(1, "/work/app-login", "working", "Fixing the login race"),
  session(2, "/work/app-login", "waiting"),
  session(3, "/work/notes", "done", "Wrote the summary"),
  session(4, "/elsewhere", "exited"),
];
const rows = panelRows(projects, worktrees, sessions, new Set());

describe("groupRows", () => {
  it("makes a section per project with a card per worktree and its agents", () => {
    const sections = groupRows(rows);
    expect(sections.map((section) => [section.folder, section.row?.project.name ?? null])).toEqual([
      [null, "app"],
      [null, "notes"],
      ["Other folders", null],
    ]);
    const app = sections[0];
    expect(app.cards.map((card) => [card.row.label, card.sessions.map((row) => row.session.terminalKey), card.state])).toEqual([
      ["main", [], null],
      ["fix/login", [1, 2], "waiting"],
    ]);
    expect(sections[1].sessions.map((row) => row.session.terminalKey)).toEqual([3]);
    expect(sections[2].sessions.map((row) => row.session.terminalKey)).toEqual([4]);
  });

  it("is empty for no rows", () => {
    expect(groupRows([])).toEqual([]);
  });
});

describe("filterRows", () => {
  const keys = (query: string) => filterRows(rows, query).map((row) => row.key);

  it("keeps everything for a blank filter", () => {
    expect(keys("  ")).toEqual(rows.map((row) => row.key));
  });

  it("keeps an agent with its worktree and project", () => {
    expect(keys("login race")).toEqual(["project:/work/app", "worktree:/work/app-login", "session:1"]);
  });

  it("keeps a matching worktree with all its agents", () => {
    expect(keys("FIX/LOGIN")).toEqual([
      "project:/work/app",
      "worktree:/work/app-login",
      "session:1",
      "session:2",
    ]);
  });

  it("keeps a matching project whole", () => {
    expect(keys("notes")).toEqual(["project:/work/notes", "session:3"]);
  });

  it("keeps nothing when nothing matches", () => {
    expect(keys("zzz")).toEqual([]);
  });
});

describe("mostUrgent and attentionCounts", () => {
  it("puts an agent that needs the user first", () => {
    expect(mostUrgent(["done", "working", "waiting"])).toBe("waiting");
    expect(mostUrgent(["ready", "exited"])).toBe("ready");
    expect(mostUrgent([])).toBeNull();
  });

  it("counts working (starting too) and waiting agents", () => {
    expect(attentionCounts([...sessions, session(5, "/work/app", "starting")])).toEqual({ working: 2, waiting: 1 });
  });
});

describe("formatAge", () => {
  it("reads like Orca's ages", () => {
    expect(formatAge(-5)).toBe("now");
    expect(formatAge(59_999)).toBe("now");
    expect(formatAge(60_000)).toBe("1m");
    expect(formatAge(59 * 60_000)).toBe("59m");
    expect(formatAge(60 * 60_000)).toBe("1h");
    expect(formatAge(49 * 3_600_000)).toBe("2d");
  });
});

describe("agentMark", () => {
  it("has a mark for every known agent and a fallback", () => {
    expect(agentMark("claude")).toBe("CC");
    expect(agentMark("codex")).toBe("Cx");
    expect(agentMark("goose")).toBe("Go");
  });
});
