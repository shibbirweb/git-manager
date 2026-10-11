<!-- Settings > AI > Agents: each agent, whether its command was found, and everything that starts it: the command,
     the full-autonomy flags, how it takes a first prompt and extra arguments, with a preview and Reset. A provider
     that renames a command or a flag needs only a change here (ai/agentConfig.ts). -->
<script lang="ts">
  import { onMount } from "svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { settings } from "$lib/stores/settings.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { type AgentOverride, defaultFields, PROMPT_STYLES, withField } from "./agentConfig";
  import { AGENTS, type AgentDefinition, agentArguments, commandLine, promptArguments } from "./agents";
  import { agentPrograms, configuredAgent } from "./sessions.svelte";

  let open = $state<string | null>(null);

  onMount(() => {
    void agentPrograms.load();
  });

  function setArgs(agentId: string, value: string): void {
    const next = { ...settings.aiAgentArgs };
    if (value.trim() === "") {
      delete next[agentId];
    } else {
      next[agentId] = value;
    }
    settings.setPreference("aiAgentArgs", next);
  }

  function setField(agent: AgentDefinition, field: keyof AgentOverride, value: string): void {
    const next = { ...settings.aiAgentCommands };
    const entry = withField(agent, next[agent.id], field, value);
    if (entry) {
      next[agent.id] = entry;
    } else {
      delete next[agent.id];
    }
    settings.setPreference("aiAgentCommands", next);
    if (field === "command") {
      void agentPrograms.load(false, true);
    }
  }

  function reset(agent: AgentDefinition): void {
    const commands = { ...settings.aiAgentCommands };
    delete commands[agent.id];
    settings.setPreference("aiAgentCommands", commands);
    setArgs(agent.id, "");
    void agentPrograms.load(false, true);
  }

  /** The command line each mode runs, with a sample prompt, so a change can be checked before an agent starts. */
  function preview(agent: AgentDefinition, mode: "normal" | "full"): string {
    const configured = configuredAgent(agent);
    const first = promptArguments(configured, "<first prompt>");
    const args = [...configured.baseArgs, ...agentArguments(configured, mode, settings.aiAgentArgs[agent.id] ?? ""), ...first.args];
    return `${commandLine(configured.program, args)}${first.typed ? "   (then types the first prompt)" : ""}`;
  }
</script>

<div class="agents">
  <div class="agents-head">
    <span class="hint">
      {#if agentPrograms.found === null}
        Looking for agents...
      {:else}
        {agentPrograms.installed().length} of {AGENTS.length} found on your PATH.
      {/if}
    </span>
    <button class="btn small" onclick={() => void agentPrograms.load(true)} disabled={agentPrograms.loading}>
      <Icon name="refresh" size={12} />
      Look Again
    </button>
  </div>
  {#each AGENTS as agent (agent.id)}
    {@const path = agentPrograms.found?.[agent.id] ?? null}
    {@const configured = configuredAgent(agent)}
    {@const override = settings.aiAgentCommands[agent.id]}
    {@const defaults = defaultFields(agent)}
    {@const expanded = open === agent.id}
    {@const changed = configured.customized || (settings.aiAgentArgs[agent.id] ?? "") !== ""}
    <div class="agent" class:expanded>
      <button class="agent-head" aria-expanded={expanded} onclick={() => (open = expanded ? null : agent.id)}>
        <Icon name={expanded ? "chevron-down" : "chevron-right"} size={12} />
        <span class="name">{agent.label}</span>
        {#if changed}
          <span class="tag">changed</span>
        {/if}
        {#if path}
          <span class="found truncate" title={path}>{path}</span>
        {:else if agentPrograms.found !== null}
          <span class="missing">Not found: {configured.program}</span>
        {/if}
      </button>
      {#if expanded}
        <div class="fields">
          <label class="field">
            <span>Command</span>
            <input
              class="input mono"
              type="text"
              spellcheck="false"
              placeholder={defaults.command}
              value={override?.command ?? ""}
              onchange={(event) => setField(agent, "command", event.currentTarget.value)}
              aria-label="{agent.label} command"
            />
            <span class="hint">The program and any first arguments, or a full path. Empty uses {defaults.command}.</span>
          </label>
          <label class="field">
            <span>Full-autonomy flags</span>
            <input
              class="input mono"
              type="text"
              spellcheck="false"
              placeholder="none"
              value={override?.fullAutonomyArgs ?? defaults.fullAutonomyArgs}
              onchange={(event) => setField(agent, "fullAutonomyArgs", event.currentTarget.value)}
              aria-label="{agent.label} full-autonomy flags"
            />
            <span class="hint">Added when agents work with full autonomy (Agent permissions above).</span>
          </label>
          <div class="field">
            <span>First prompt</span>
            <div class="row">
              <select
                class="input select"
                value={configured.prompt.kind}
                onchange={(event) => setField(agent, "promptStyle", event.currentTarget.value)}
                aria-label="{agent.label} first prompt"
              >
                {#each PROMPT_STYLES as style (style.value)}
                  <option value={style.value}>{style.label}</option>
                {/each}
              </select>
              {#if configured.prompt.kind === "flag"}
                <input
                  class="input mono flag"
                  type="text"
                  spellcheck="false"
                  placeholder={defaults.promptFlag || "--prompt"}
                  value={override?.promptFlag ?? defaults.promptFlag}
                  onchange={(event) => setField(agent, "promptFlag", event.currentTarget.value)}
                  aria-label="{agent.label} prompt flag"
                />
              {/if}
            </div>
            <span class="hint">How New Task hands the agent its first prompt.</span>
          </div>
          <label class="field">
            <span>Extra arguments</span>
            <input
              class="input mono"
              type="text"
              spellcheck="false"
              placeholder="such as --model ..."
              value={settings.aiAgentArgs[agent.id] ?? ""}
              onchange={(event) => setArgs(agent.id, event.currentTarget.value)}
              aria-label="{agent.label} extra arguments"
            />
          </label>
          <div class="preview">
            <div><span class="dim">Ask before acting:</span> <code>{preview(agent, "normal")}</code></div>
            <div><span class="dim">Full autonomy:</span> <code>{preview(agent, "full")}</code></div>
          </div>
          <div class="actions">
            {#if !path && agentPrograms.found !== null}
              <button class="btn small" onclick={() => void openUrl(agent.homepage)}>Get {agent.label}</button>
            {/if}
            <span class="spacer"></span>
            <button class="btn small" disabled={!changed} onclick={() => reset(agent)}>Reset to Default</button>
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .agents {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .agents-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 4px;
  }

  .hint {
    font-size: 12px;
    color: var(--text-dim);
  }

  .agent {
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .agent.expanded {
    border-color: var(--border-strong);
  }

  .agent-head {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
    padding: 7px 10px;
    border: none;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .name {
    flex: none;
    font-weight: 500;
  }

  .tag {
    flex: none;
    padding: 0 5px;
    border-radius: 4px;
    font-size: 10px;
    line-height: 16px;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .found {
    flex: 1;
    min-width: 0;
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-dim);
    text-align: right;
  }

  .missing {
    flex: 1;
    font-size: 12px;
    color: var(--text-dim);
    text-align: right;
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px 12px 12px 28px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field > span:first-child {
    font-size: 12px;
    font-weight: 500;
  }

  .mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .row {
    display: flex;
    gap: 8px;
  }

  .flag {
    flex: 1;
    min-width: 0;
  }

  .preview {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--panel-alt);
    font-size: 11px;
    overflow-wrap: anywhere;
  }

  .preview code {
    font-family: var(--font-mono);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .spacer {
    flex: 1;
  }
</style>
