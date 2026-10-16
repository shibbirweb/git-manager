// How the AI panel draws its rows, like Orca's sidebar: a section per project, a card per worktree with its agents
// inside, a filter, the counts in the header and "4m" ages. Pure, so it is tested directly.

import type { AgentSession, AgentState, PanelRow } from "./projects";

type ProjectRow = Extract<PanelRow, { kind: "project" }>;
type WorktreeRow = Extract<PanelRow, { kind: "worktree" }>;
type SessionRow = Extract<PanelRow, { kind: "session" }>;

export interface WorktreeCard {
  row: WorktreeRow;
  sessions: SessionRow[];
  /** What the card's dot shows: its most urgent agent, or null without agents. */
  state: AgentState | null;
}

export interface ProjectSection {
  key: string;
  /** The workspace folder heading drawn above this section, when there are several folders. */
  folder: string | null;
  /** Null for the "Other folders" section of agents outside every project. */
  row: ProjectRow | null;
  cards: WorktreeCard[];
  /** Agents of a folder without a repository, or outside every project. */
  sessions: SessionRow[];
}

/** Most urgent first: an agent that needs the user, then one at work, down to one that exited. */
const URGENCY: readonly AgentState[] = ["waiting", "working", "starting", "done", "ready", "exited"];

export function mostUrgent(states: readonly AgentState[]): AgentState | null {
  return URGENCY.find((state) => states.includes(state)) ?? null;
}

/** The flat rows as sections and cards, in the same order. */
export function groupRows(rows: readonly PanelRow[]): ProjectSection[] {
  const sections: ProjectSection[] = [];
  let folder: string | null = null;
  let section: ProjectSection | null = null;
  let card: WorktreeCard | null = null;
  for (const row of rows) {
    if (row.kind === "folder") {
      folder = row.name;
      if (row.key === "folder:other") {
        section = { key: row.key, folder: row.name, row: null, cards: [], sessions: [] };
        sections.push(section);
        folder = null;
      }
      card = null;
    } else if (row.kind === "project") {
      section = { key: row.key, folder, row, cards: [], sessions: [] };
      sections.push(section);
      folder = null;
      card = null;
    } else if (row.kind === "worktree" && section) {
      card = { row, sessions: [], state: null };
      section.cards.push(card);
    } else if (row.kind === "session" && section) {
      if (card && row.depth === 2) {
        card.sessions.push(row);
      } else {
        section.sessions.push(row);
      }
    }
  }
  for (const each of sections) {
    for (const worktree of each.cards) {
      worktree.state = mostUrgent(worktree.sessions.map((session) => session.session.state));
    }
  }
  return sections;
}

function matches(words: readonly string[], ...texts: string[]): boolean {
  const haystack = texts.join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/**
 * The rows that match `query` (every word, anywhere): a project that matches keeps all its rows, a worktree keeps
 * its agents, and an agent keeps its worktree and project so it is shown in place. Folder headings stay above what
 * is left of them.
 */
export function filterRows(rows: readonly PanelRow[], query: string): PanelRow[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "");
  if (words.length === 0) {
    return [...rows];
  }
  const keep = new Set<string>();
  let folder: PanelRow | null = null;
  let project: PanelRow | null = null;
  let projectMatched = false;
  let worktree: PanelRow | null = null;
  let worktreeMatched = false;
  const keepPath = (...path: (PanelRow | null)[]) => {
    for (const row of path) {
      if (row) {
        keep.add(row.key);
      }
    }
  };
  for (const row of rows) {
    switch (row.kind) {
      case "folder":
        folder = row;
        project = null;
        worktree = null;
        projectMatched = false;
        worktreeMatched = false;
        break;
      case "project":
        project = row;
        worktree = null;
        worktreeMatched = false;
        projectMatched = matches(words, row.project.name);
        if (projectMatched) {
          keepPath(folder, row);
        }
        break;
      case "worktree":
        worktree = row;
        worktreeMatched = projectMatched || matches(words, row.label, row.detail);
        if (worktreeMatched) {
          keepPath(folder, project, row);
        }
        break;
      case "session":
        if (projectMatched || worktreeMatched || matches(words, row.session.name, row.session.title)) {
          keepPath(folder, project, worktree, row);
        }
        break;
    }
  }
  return rows.filter((row) => keep.has(row.key));
}

/** How many agents work and how many need the user, for the header. */
export function attentionCounts(sessions: readonly AgentSession[]): { working: number; waiting: number } {
  return {
    working: sessions.filter((session) => session.state === "working" || session.state === "starting").length,
    waiting: sessions.filter((session) => session.state === "waiting").length,
  };
}

/** A short age like Orca's: "now" under a minute, then "4m", "2h", "3d". */
export function formatAge(elapsedMs: number): string {
  const minutes = Math.floor(Math.max(0, elapsedMs) / 60_000);
  if (minutes < 1) {
    return "now";
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

/** A two-letter mark for an agent, shown in a small badge: "CC" for Claude Code, "Cx" for Codex. */
export function agentMark(agentId: string): string {
  const marks: Record<string, string> = {
    claude: "CC",
    codex: "Cx",
    gemini: "Ge",
    opencode: "OC",
    cursor: "Cu",
    copilot: "Co",
    aider: "Ai",
    amp: "Am",
    qwen: "Qw",
  };
  return marks[agentId] ?? agentId.slice(0, 2).replace(/^./, (first) => first.toUpperCase());
}
