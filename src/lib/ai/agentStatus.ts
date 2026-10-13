// What an agent is doing, read from its terminal title. Agents animate a spinner in the title while they work
// and show a rest mark when they wait for the next prompt. The rules are a small part of Orca's
// (github.com/stablyai/orca, MIT, src/shared/agent-title-*.ts), for the agents in agents.ts: our agent tabs run
// the agent itself, so every title is the agent's own and no shell titles have to be told apart.

import type { AgentState } from "./projects";

/** What a title says; null when it says nothing (the last state stays). */
export type TitleStatus = "working" | "waiting" | "idle";

const CLAUDE_IDLE = "✳"; // ✳
const GEMINI_WORKING = "✦"; // ✦
const GEMINI_SILENT_WORKING = "⏲"; // ⏲
const GEMINI_IDLE = "◇"; // ◇
const GEMINI_PERMISSION = "✋"; // ✋
/** Braille frames (most agents) and quarter circles (newer Claude Code). */
const SPINNER_RE = /[⠀-⣿◐-◓]/u;
const SPINNER_RE_GLOBAL = /[⠀-⣿◐-◓]/gu;
const MARKS = [CLAUDE_IDLE, GEMINI_WORKING, GEMINI_SILENT_WORKING, GEMINI_IDLE, GEMINI_PERMISSION].join("");
const DECORATION_RE_GLOBAL = new RegExp(`[${MARKS}]`, "gu");

// Whole words only: "~/codex/ready" or "reworking" must not count.
const AGENT_NAMES = "claude|codex|copilot|cursor|gemini|opencode|aider|qwen";
const AGENT_NAME_RE = new RegExp(
  String.raw`(?<![\w./\\-])(${AGENT_NAMES})(?:\.(?:exe|cmd|bat|ps1))?(?![\w./\\-])`,
  "i",
);
const IDLE_WORD_RE = /(?<![\w./\\-])(ready|idle|done)(?![\w-])/i;
const WORKING_WORD_RE = /(?<![\w./\\-])(working|thinking|running)(?![\w-])/i;
/** OpenCode's own titles: "OC | <session summary>"; the summary is subject matter, never status. */
const OPENCODE_TITLE_RE = /^(?:.*\|\s*)?OC \| \S/;

export function statusFromTitle(title: string): TitleStatus | null {
  if (!title.trim()) {
    return null;
  }
  if (OPENCODE_TITLE_RE.test(title)) {
    return SPINNER_RE.test(title) ? "working" : "idle";
  }
  if (title.includes(GEMINI_PERMISSION)) {
    return "waiting";
  }
  if (title.includes(GEMINI_WORKING) || title.includes(GEMINI_SILENT_WORKING)) {
    return "working";
  }
  if (title.includes(GEMINI_IDLE)) {
    return "idle";
  }
  if (title === CLAUDE_IDLE || title.startsWith(`${CLAUDE_IDLE} `)) {
    return "idle";
  }
  if (SPINNER_RE.test(title)) {
    return "working";
  }
  if (!AGENT_NAME_RE.test(title)) {
    return null;
  }
  const lower = title.toLowerCase();
  if (["action required", "permission", "waiting"].some((word) => lower.includes(word))) {
    return "waiting";
  }
  if (IDLE_WORD_RE.test(title)) {
    return "idle";
  }
  if (WORKING_WORD_RE.test(title)) {
    return "working";
  }
  if (title.startsWith(". ")) {
    return "working";
  }
  return "idle";
}

/**
 * A title that only names the agent or its status ("claude - action required", "Codex working", "Claude Code"),
 * not what it works on: the panel keeps showing the last real title instead.
 */
export function isStatusOnlyTitle(title: string): boolean {
  const rest = cleanTitle(title)
    .toLowerCase()
    .replace(new RegExp(AGENT_NAMES, "g"), " ")
    .replace(/\b(code|cli|agent|action required|permission|waiting|ready|idle|done|working|thinking|running)\b/g, " ")
    .replace(/[\s\-:|.()]+/g, "");
  return rest === "";
}

/** The title without spinner frames and status marks, for display: "⠋ Fix login" reads "Fix login". */
export function cleanTitle(title: string): string {
  let cleaned = title.replace(SPINNER_RE_GLOBAL, "").replace(DECORATION_RE_GLOBAL, "");
  cleaned = cleaned.replace(/^\s*[.*]\s+/, "");
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

/**
 * The next state of a running agent after its title changed: a working agent that stops shows "done" until it
 * works again, one that never worked is "ready". An unknown title keeps the state.
 */
export function nextState(current: AgentState, status: TitleStatus | null): AgentState {
  if (status === "working") {
    return "working";
  }
  if (status === "waiting") {
    return "waiting";
  }
  if (status === "idle") {
    return current === "working" || current === "waiting" || current === "done" ? "done" : "ready";
  }
  return current === "starting" ? "ready" : current;
}

/** A change the user would want to hear about while the tab is hidden: the agent finished or needs them. */
export function needsAttention(previous: AgentState, next: AgentState): boolean {
  return previous !== next && previous === "working" && (next === "done" || next === "waiting");
}

export function stateLabel(state: AgentState): string {
  switch (state) {
    case "starting":
      return "Starting";
    case "working":
      return "Working";
    case "waiting":
      return "Needs you";
    case "ready":
      return "Ready";
    case "done":
      return "Done";
    case "exited":
      return "Exited";
  }
}
