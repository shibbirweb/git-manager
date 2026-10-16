<!-- Settings > AI > Agents: each agent, whether its command was found, and everything that starts it: the command,
     the full-autonomy flags, how it takes a first prompt and extra arguments, with a preview and Reset. A provider
     that renames a command or a flag needs only a change here (ai/agentConfig.ts). -->
<script lang="ts">
  import Button from "@git-manager/ui/components/Button.svelte";
  import Card from "@git-manager/ui/components/Card.svelte";
  import Field from "@git-manager/ui/components/Field.svelte";
  import Input from "@git-manager/ui/components/Input.svelte";
  import Row from "@git-manager/ui/components/Row.svelte";
  import Select from "@git-manager/ui/components/Select.svelte";
  import Spacer from "@git-manager/ui/components/Spacer.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Tag from "@git-manager/ui/components/Tag.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { onMount } from "svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { settings } from "$lib/stores/settings.svelte";
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
    const args = [
      ...configured.baseArgs,
      ...agentArguments(configured, mode, settings.aiAgentArgs[agent.id] ?? ""),
      ...first.args,
    ];
    return `${commandLine(configured.program, args)}${first.typed ? "   (then types the first prompt)" : ""}`;
  }
</script>

<Stack gap="sm">
  <Stack direction="row" align="center" justify="between" gap="lg">
    <Text size="small" tone="dim">
      {#if agentPrograms.found === null}
        Looking for agents...
      {:else}
        {agentPrograms.installed().length} of {AGENTS.length} found on your PATH.
      {/if}
    </Text>
    <Button size="small" icon="refresh" disabled={agentPrograms.loading} onclick={() => void agentPrograms.load(true)}>
      Look Again
    </Button>
  </Stack>
  {#each AGENTS as agent (agent.id)}
    {@const path = agentPrograms.found?.[agent.id] ?? null}
    {@const configured = configuredAgent(agent)}
    {@const override = settings.aiAgentCommands[agent.id]}
    {@const defaults = defaultFields(agent)}
    {@const expanded = open === agent.id}
    {@const changed = configured.customized || (settings.aiAgentArgs[agent.id] ?? "") !== ""}
    <Card label={agent.label}>
      <Row size="entry" {expanded} onclick={() => (open = expanded ? null : agent.id)}>
        <Text weight="medium">{agent.label}</Text>
        {#if changed}
          <Tag tone="accent" size="small">changed</Tag>
        {/if}
        <Spacer />
        {#if path}
          <Text size="xsmall" tone="dim" mono truncate title={path}>{path}</Text>
        {:else if agentPrograms.found !== null}
          <Text size="small" tone="dim">Not found: {configured.program}</Text>
        {/if}
      </Row>
      {#if expanded}
        <Stack gap="mdPlus" paddingLeft="xxl" padding="lg">
          <Field
            label="Command"
            hint="The program and any first arguments, or a full path. Empty uses {defaults.command}."
          >
            <Input
              mono
              width="fill"
              spellcheck="false"
              placeholder={defaults.command}
              value={override?.command ?? ""}
              onchange={(event) => setField(agent, "command", event.currentTarget.value)}
              aria-label="{agent.label} command"
            />
          </Field>
          <Field
            label="Full-autonomy flags"
            hint="Added when agents work with full autonomy (Agent permissions above)."
          >
            <Input
              mono
              width="fill"
              spellcheck="false"
              placeholder="none"
              value={override?.fullAutonomyArgs ?? defaults.fullAutonomyArgs}
              onchange={(event) => setField(agent, "fullAutonomyArgs", event.currentTarget.value)}
              aria-label="{agent.label} full-autonomy flags"
            />
          </Field>
          <Field label="First prompt" hint="How New Task hands the agent its first prompt.">
            <Stack direction="row" gap="md">
              <Select
                options={[...PROMPT_STYLES]}
                value={configured.prompt.kind}
                label="{agent.label} first prompt"
                onchange={(value) => setField(agent, "promptStyle", value)}
              />
              {#if configured.prompt.kind === "flag"}
                <Stack grow>
                  <Input
                    mono
                    width="fill"
                    spellcheck="false"
                    placeholder={defaults.promptFlag || "--prompt"}
                    value={override?.promptFlag ?? defaults.promptFlag}
                    onchange={(event) => setField(agent, "promptFlag", event.currentTarget.value)}
                    aria-label="{agent.label} prompt flag"
                  />
                </Stack>
              {/if}
            </Stack>
          </Field>
          <Field label="Extra arguments">
            <Input
              mono
              width="fill"
              spellcheck="false"
              placeholder="such as --model ..."
              value={settings.aiAgentArgs[agent.id] ?? ""}
              onchange={(event) => setArgs(agent.id, event.currentTarget.value)}
              aria-label="{agent.label} extra arguments"
            />
          </Field>
          <Stack gap="xxs" padding="md" surface="alt" label="Command preview">
            <Text size="xsmall" wrap="anywhere">
              <Text tone="dim">Ask before acting:</Text>
              <Text mono>{preview(agent, "normal")}</Text>
            </Text>
            <Text size="xsmall" wrap="anywhere">
              <Text tone="dim">Full autonomy:</Text>
              <Text mono>{preview(agent, "full")}</Text>
            </Text>
          </Stack>
          <Stack direction="row" align="center" gap="md">
            {#if !path && agentPrograms.found !== null}
              <Button size="small" onclick={() => void openUrl(agent.homepage)}>Get {agent.label}</Button>
            {/if}
            <Spacer />
            <Button size="small" disabled={!changed} onclick={() => reset(agent)}>Reset to Default</Button>
          </Stack>
        </Stack>
      {/if}
    </Card>
  {/each}
</Stack>
