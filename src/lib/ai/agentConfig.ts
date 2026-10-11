// Each agent's command as Settings > AI has it: the command that starts it, its full-autonomy flags and how it takes
// a first prompt. The catalog (agents.ts) gives the defaults; a provider that renames a command or a flag needs only
// a settings change, never a new app. Pure, so it is tested directly.

import { type AgentDefinition, type PromptMode, splitArguments } from "./agents";

export type PromptStyle = PromptMode["kind"];

/** What the user changed for one agent; a missing or blank field keeps the default. */
export interface AgentOverride {
  /** The program and any first arguments, such as `claude` or `npx -y @openai/codex`. */
  command?: string;
  fullAutonomyArgs?: string;
  promptStyle?: PromptStyle;
  /** The flag before the prompt, for the "flag" style. */
  promptFlag?: string;
}

export const PROMPT_STYLES: readonly { value: PromptStyle; label: string }[] = [
  { value: "argument", label: "As the last argument" },
  { value: "flag", label: "After a flag" },
  { value: "typed", label: "Typed once it starts" },
  { value: "none", label: "No first prompt" },
];

/** The agent as it starts: its program and first arguments, flags and prompt mode, with the user's changes. */
export interface EffectiveAgent extends AgentDefinition {
  /** Arguments of the command itself, before everything else (`-y @openai/codex` of `npx -y @openai/codex`). */
  baseArgs: string[];
  /** The user changed something, so Settings offers Reset. */
  customized: boolean;
}

/** Arguments as one line, quoting words with spaces: how the settings fields show them. */
export function joinArguments(args: readonly string[]): string {
  return args.map((word) => (word === "" || /[\s"'\\]/.test(word) ? `"${word.replace(/(["\\])/g, "\\$1")}"` : word)).join(" ");
}

function nonBlank(text: string | undefined): string | null {
  return text !== undefined && text.trim() !== "" ? text : null;
}

export function effectiveAgent(agent: AgentDefinition, override: AgentOverride | undefined): EffectiveAgent {
  const command = nonBlank(override?.command);
  const words = command ? splitArguments(command) : [];
  const program = words[0] ?? agent.program;
  const autonomy = override?.fullAutonomyArgs;
  const style = override?.promptStyle;
  let prompt: PromptMode = agent.prompt;
  if (style === "flag") {
    const flag = nonBlank(override?.promptFlag)?.trim() ?? (agent.prompt.kind === "flag" ? agent.prompt.flag : null);
    prompt = flag ? { kind: "flag", flag } : agent.prompt;
  } else if (style) {
    prompt = { kind: style } as PromptMode;
  }
  return {
    ...agent,
    program,
    baseArgs: words.slice(1),
    // An empty field is a choice too: no full-autonomy flags at all.
    fullAutonomyArgs: autonomy !== undefined ? splitArguments(autonomy) : agent.fullAutonomyArgs,
    prompt,
    customized: command !== null || autonomy !== undefined || style !== undefined,
  };
}

/** The fields' defaults, shown as placeholders and restored by Reset. */
export function defaultFields(agent: AgentDefinition): Required<AgentOverride> {
  return {
    command: agent.program,
    fullAutonomyArgs: joinArguments(agent.fullAutonomyArgs),
    promptStyle: agent.prompt.kind,
    promptFlag: agent.prompt.kind === "flag" ? agent.prompt.flag : "",
  };
}

/** The settings entry after one field changed: a field set back to its default is dropped, and so is an empty entry. */
export function withField(
  agent: AgentDefinition,
  current: AgentOverride | undefined,
  field: keyof AgentOverride,
  value: string,
): AgentOverride | null {
  const next: AgentOverride = { ...current };
  const defaults = defaultFields(agent);
  if (value.trim() === defaults[field].trim() || (field === "command" && value.trim() === "")) {
    delete next[field];
  } else if (field === "promptStyle") {
    next.promptStyle = value as PromptStyle;
  } else {
    next[field] = value;
  }
  return Object.keys(next).length > 0 ? next : null;
}
