// The AI agents the AI panel can start: terminal programs found on the login shell's PATH. The full-autonomy
// arguments come from Orca (github.com/stablyai/orca, MIT, src/shared/tui-agent-permissions.ts). Kept free of Svelte
// so it can be tested directly.

import type { AiPermissionMode } from "$lib/stores/settingsData";

export type AgentId = "claude" | "codex" | "gemini" | "opencode" | "cursor" | "copilot" | "aider" | "amp" | "qwen";

export interface AgentDefinition {
  id: AgentId;
  label: string;
  /** Looked up on the login shell's PATH. */
  program: string;
  /** Added in full-autonomy mode: the agent stops asking before it edits files or runs commands. */
  fullAutonomyArgs: string[];
  /** Where to get it, shown when it is not installed. */
  homepage: string;
  /**
   * How it takes a first prompt (Orca's promptInjectionMode): as its last argument, after a flag, or typed into it
   * once it has started.
   */
  prompt: PromptMode;
}

/** How an agent takes its first prompt; "none" means it gets none (it starts empty). */
export type PromptMode = { kind: "argument" } | { kind: "flag"; flag: string } | { kind: "typed" } | { kind: "none" };

export const AGENTS: readonly AgentDefinition[] = [
  {
    id: "claude",
    label: "Claude Code",
    program: "claude",
    fullAutonomyArgs: ["--dangerously-skip-permissions"],
    homepage: "https://docs.anthropic.com/en/docs/claude-code",
    prompt: { kind: "argument" },
  },
  {
    id: "codex",
    label: "Codex",
    program: "codex",
    fullAutonomyArgs: ["--dangerously-bypass-approvals-and-sandbox"],
    homepage: "https://github.com/openai/codex",
    prompt: { kind: "argument" },
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    program: "gemini",
    fullAutonomyArgs: ["--yolo"],
    homepage: "https://github.com/google-gemini/gemini-cli",
    prompt: { kind: "flag", flag: "--prompt-interactive" },
  },
  {
    id: "opencode",
    label: "OpenCode",
    program: "opencode",
    fullAutonomyArgs: [],
    homepage: "https://opencode.ai",
    prompt: { kind: "flag", flag: "--prompt" },
  },
  {
    id: "cursor",
    label: "Cursor CLI",
    program: "cursor-agent",
    fullAutonomyArgs: ["--yolo"],
    homepage: "https://cursor.com/cli",
    prompt: { kind: "argument" },
  },
  {
    id: "copilot",
    label: "GitHub Copilot CLI",
    program: "copilot",
    fullAutonomyArgs: ["--yolo"],
    homepage: "https://github.com/github/copilot-cli",
    prompt: { kind: "flag", flag: "-i" },
  },
  {
    id: "aider",
    label: "Aider",
    program: "aider",
    fullAutonomyArgs: ["--yes-always"],
    homepage: "https://aider.chat",
    prompt: { kind: "typed" },
  },
  {
    id: "amp",
    label: "Amp",
    program: "amp",
    fullAutonomyArgs: ["--dangerously-allow-all"],
    homepage: "https://ampcode.com",
    prompt: { kind: "typed" },
  },
  {
    id: "qwen",
    label: "Qwen Code",
    program: "qwen",
    fullAutonomyArgs: ["--approval-mode", "yolo"],
    homepage: "https://github.com/QwenLM/qwen-code",
    prompt: { kind: "typed" },
  },
];

export function agentById(agentId: string): AgentDefinition | null {
  return AGENTS.find((agent) => agent.id === agentId) ?? null;
}

/**
 * Splits extra arguments like a shell would, without expanding anything: spaces separate words, single and double
 * quotes group them, and a backslash keeps the next character. An unclosed quote runs to the end.
 */
export function splitArguments(text: string): string[] {
  const words: string[] = [];
  let word = "";
  let inWord = false;
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === "\\" && quote === '"' && index + 1 < text.length) {
        word += text[++index];
      } else {
        word += char;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
      inWord = true;
    } else if (char === "\\" && index + 1 < text.length) {
      word += text[++index];
      inWord = true;
    } else if (/\s/.test(char)) {
      if (inWord) {
        words.push(word);
        word = "";
        inWord = false;
      }
    } else {
      word += char;
      inWord = true;
    }
  }
  if (inWord) {
    words.push(word);
  }
  return words;
}

/** The agent's arguments: its full-autonomy flags in full mode (unless already given), then the extra ones. */
export function agentArguments(
  agent: Pick<AgentDefinition, "fullAutonomyArgs">,
  mode: Exclude<AiPermissionMode, "ask">,
  extra: string,
): string[] {
  const extraWords = splitArguments(extra);
  const flags = mode === "full" ? agent.fullAutonomyArgs : [];
  const present = flags.length > 0 && flags.every((flag) => extraWords.includes(flag));
  return present ? extraWords : [...flags, ...extraWords];
}

/**
 * A first prompt for the agent: the arguments that carry it, or the text to type once it runs. Typed text is one
 * line, since a newline would send it early.
 */
export function promptArguments(
  agent: Pick<AgentDefinition, "prompt">,
  prompt: string,
): { args: string[]; typed: string | null } {
  const text = prompt.trim();
  if (text === "" || agent.prompt.kind === "none") {
    return { args: [], typed: null };
  }
  switch (agent.prompt.kind) {
    case "argument":
      return { args: [text], typed: null };
    case "flag":
      return { args: [agent.prompt.flag, text], typed: null };
    case "typed":
      return { args: [], typed: text.replace(/\s*\n\s*/g, " ") };
  }
}

/** The command line shown above the agent's output, quoting words with spaces. */
export function commandLine(program: string, args: readonly string[]): string {
  return [program, ...args].map(quoteWord).join(" ");
}

function quoteWord(word: string): string {
  return word === "" || /[\s"'\\$`]/.test(word) ? `'${word.replace(/'/g, "'\\''")}'` : word;
}
