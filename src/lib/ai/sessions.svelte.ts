// Agent tabs: which agents are installed, starting one in a worktree (asking the permission mode the first time),
// and the panel's view of the running ones. The tabs themselves are terminals (terminalStore.startAgent).

import { api, errorMessage } from "$lib/api";
import { settings } from "$lib/stores/settings.svelte";
import type { AiPermissionMode } from "$lib/stores/settingsData";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import { dialogs } from "$lib/ui/dialog.svelte";
import type { MenuItem } from "$lib/ui/menu.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { effectiveAgent, type EffectiveAgent } from "./agentConfig";
import { AGENTS, type AgentDefinition, agentArguments, agentById, commandLine, promptArguments } from "./agents";
import type { AgentSession } from "./projects";

/** The agent with the user's command, flags and prompt style from Settings > AI. */
export function configuredAgent(agent: AgentDefinition): EffectiveAgent {
  return effectiveAgent(agent, settings.aiAgentCommands[agent.id]);
}

class AgentPrograms {
  /** Installed agents' files by agent id; null until the first look. */
  found = $state.raw<Record<string, string> | null>(null);
  loading = $state(false);
  private request: Promise<void> | null = null;

  /**
   * Looks for each agent's command (as Settings has it) on the login shell's PATH. `fresh` reads the shell's
   * environment again; `again` looks again with the same environment (a command changed in Settings).
   */
  load(fresh = false, again = false): Promise<void> {
    if (this.request && !fresh && !again) {
      return this.request;
    }
    this.loading = true;
    const programs = AGENTS.map((agent) => configuredAgent(agent).program);
    const request = api
      .findAgentPrograms([...new Set(programs)], fresh)
      .then((found) => {
        const byProgram = new Map(found.map((program) => [program.program, program.path]));
        this.found = Object.fromEntries(
          AGENTS.flatMap((agent, index) => {
            const path = byProgram.get(programs[index]);
            return path ? [[agent.id, path]] : [];
          }),
        );
      })
      .catch((error) => {
        this.found = this.found ?? {};
        toast.error("Could not look for AI agents", errorMessage(error));
      })
      .finally(() => {
        this.loading = false;
      });
    this.request = request;
    return request;
  }

  installed(): AgentDefinition[] {
    const found = this.found ?? {};
    return AGENTS.filter((agent) => agent.id in found);
  }
}

export const agentPrograms = new AgentPrograms();

/** An agent's title beside its name, unless it only repeats the name ("Claude Code" in a "Claude Code" tab). */
export function titleWorthShowing(title: string, name: string, agentId: string): string {
  const plain = title.trim().toLowerCase();
  const names = [name, agentById(agentId)?.label ?? "", agentById(agentId)?.program ?? ""].map((text) => text.toLowerCase());
  return plain === "" || names.includes(plain) ? "" : title.trim();
}

/** The agent tabs, as the AI panel lists them. */
export function agentSessions(): AgentSession[] {
  const sessions: AgentSession[] = [];
  for (const terminal of terminalStore.terminals) {
    if (terminal.agent) {
      sessions.push({
        terminalKey: terminal.key,
        name: terminal.name,
        folderPath: terminal.agent.folderPath,
        state: terminal.exited ? "exited" : terminal.agent.state,
        title: titleWorthShowing(terminal.agent.title, terminal.name, terminal.agent.agentId),
        agentId: terminal.agent.agentId,
        changedAt: terminal.agent.changedAt,
      });
    }
  }
  return sessions;
}

export function focusSession(terminalKey: number): void {
  terminalStore.showTerminal(terminalKey);
}

export function sessionMenu(terminalKey: number): MenuItem[] {
  return terminalStore.agentMenuItems(terminalKey);
}

/** The permission mode to start with; "ask" asks once and remembers the answer. Null when the user cancels. */
async function permissionMode(agent: AgentDefinition): Promise<Exclude<AiPermissionMode, "ask"> | null> {
  if (settings.aiPermissionMode !== "ask") {
    return settings.aiPermissionMode;
  }
  const flag = configuredAgent(agent).fullAutonomyArgs.join(" ");
  const choice = await dialogs.choose<"normal" | "full">({
    title: "How Should AI Agents Work?",
    message:
      "Agents edit files and run commands in the folder you start them in. You can change this later in Settings > AI.",
    options: [
      {
        value: "normal",
        label: "Ask before acting",
        description: "The agent asks you before it edits files or runs commands.",
      },
      {
        value: "full",
        label: "Full autonomy",
        description: flag
          ? `The agent acts without asking (for ${agent.label}: ${flag}). Best in a worktree of its own.`
          : "The agent acts without asking. Best in a worktree of its own.",
        danger: true,
      },
    ],
  });
  if (choice) {
    settings.setPreference("aiPermissionMode", choice);
  }
  return choice;
}

/**
 * Starts `agentId` in a new editor tab in `folderPath`, with an optional first prompt. False when the user cancelled
 * the permission question or the agent is unknown.
 */
export async function startAgent(agentId: string, folderPath: string, prompt = ""): Promise<boolean> {
  const agent = agentById(agentId);
  if (!agent) {
    return false;
  }
  const mode = await permissionMode(agent);
  if (!mode) {
    return false;
  }
  // The command, flags and prompt style come from Settings > AI, so a renamed flag needs no new app.
  const configured = configuredAgent(agent);
  const first = promptArguments(configured, prompt);
  const args = [
    ...configured.baseArgs,
    ...agentArguments(configured, mode, settings.aiAgentArgs[agent.id] ?? ""),
    ...first.args,
  ];
  terminalStore.startAgent({
    agentId: agent.id,
    label: agent.label,
    // The file that was found, so the agent that runs is the one Settings shows.
    program: agentPrograms.found?.[agent.id] || configured.program,
    args,
    folderPath,
    description: commandLine(configured.program, args),
    typedPrompt: first.typed,
  });
  if (settings.aiDefaultAgent !== agent.id) {
    settings.setPreference("aiDefaultAgent", agent.id);
  }
  return true;
}

/** New Agent... (View menu, Command Palette): picks an installed agent, or a plain terminal, for `folderPath`. */
export async function pickAndStartAgent(folderPath: string): Promise<void> {
  await agentPrograms.load();
  const installed = agentPrograms.installed();
  const choice = await dialogs.pick<string>({
    title: `New Agent in ${folderPath.slice(folderPath.lastIndexOf("/") + 1)}`,
    placeholder: "Choose an agent",
    items: [
      ...installed.map((agent) => ({ value: agent.id, label: agent.label, group: "Agents" })),
      { value: "", label: "Blank Terminal", description: "a shell, no agent", pinned: true },
    ],
    emptyText: "No AI agents found on your PATH",
  });
  if (choice === null) {
    return;
  }
  if (choice === "") {
    await terminalStore.create({ folderPath, location: "editor" });
  } else {
    await startAgent(choice, folderPath);
  }
}

/** The Start Agent menu of a worktree or folder: the installed agents, then a plain terminal. */
export function startMenu(folderPath: string): MenuItem[] {
  const installed = agentPrograms.installed();
  const items: MenuItem[] = installed.map((agent) => ({
    label: agent.label,
    action: () => void startAgent(agent.id, folderPath),
  }));
  if (agentPrograms.found === null) {
    items.push({ label: "Looking for agents...", disabled: true, action: () => undefined });
  } else if (installed.length === 0) {
    items.push({ label: "No AI agents found", disabled: true, action: () => undefined });
  }
  items.push(
    { separator: true },
    { label: "Blank Terminal", action: () => void terminalStore.create({ folderPath, location: "editor" }) },
    { label: "Look for Agents Again", action: () => void agentPrograms.load(true) },
  );
  return items;
}
