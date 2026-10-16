<!-- Settings > Automation, first part: the MCP server, its port and token, and how to connect clients. -->
<script lang="ts">
  import { claudeAddCommand, maskToken, mcpJsonConfig } from "$lib/mcp/connect";
  import { mcpStore } from "$lib/mcp/mcpStore.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { MCP_PORT_RANGE, parseMcpPort } from "$lib/stores/settingsData";
  import Button from "@git-manager/ui/components/Button.svelte";
  import CodeBlock from "@git-manager/ui/components/CodeBlock.svelte";
  import Input from "@git-manager/ui/components/Input.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Switch from "@git-manager/ui/components/Switch.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import SettingsGroup from "./SettingsGroup.svelte";
  import SettingsRow from "./SettingsRow.svelte";
  import { copyToClipboard, set } from "./settingsShared";

  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  let showToken = $state(false);
  let portDraft = $state(String(settings.mcpPort));
  let portError = $state<string | null>(null);
  $effect(() => {
    void mcpStore.refreshStatus();
  });
  $effect(() => {
    portDraft = String(settings.mcpPort);
  });
  const mcpStatus = $derived(mcpStore.status);
  const mcpToken = $derived(mcpStatus?.token ?? null);
  const mcpUrl = $derived(mcpStatus?.url || `http://127.0.0.1:${settings.mcpPort}/mcp`);
  const serverWanted = $derived(settings.mcpEnabled || settings.cliEnabled);
  const statusLine = $derived.by(() => {
    if (mcpStore.statusError) {
      return `Not available in this build: ${mcpStore.statusError}`;
    }
    if (!mcpStatus) {
      return serverWanted ? "Starting..." : "Off";
    }
    if (mcpStatus.error) {
      return mcpStatus.error;
    }
    return mcpStatus.running ? `Running at ${mcpUrl}` : "Off";
  });
  const statusFailed = $derived(!!mcpStore.statusError || !!mcpStatus?.error);
  const shownToken = $derived(mcpToken && (showToken ? mcpToken : maskToken(mcpToken)));

  function applyPort(): void {
    const port = parseMcpPort(portDraft);
    if (port === null) {
      portError = `Use a whole number from ${MCP_PORT_RANGE[0]} to ${MCP_PORT_RANGE[1]}.`;
      return;
    }
    portError = null;
    portDraft = String(port);
    if (port !== settings.mcpPort) {
      set("mcpPort", port);
    }
  }

  function showMcpTools(): void {
    onclose();
    mcpStore.openToolsDialog();
  }
</script>

{#snippet command(shown: string, copied: string)}
  <Stack direction="row" gap="sm" align="start">
    <Stack grow><CodeBlock variant="command" text={shown} /></Stack>
    <Button size="small" onclick={() => void copyToClipboard(copied)}>Copy</Button>
  </Stack>
{/snippet}

<SettingsGroup title="MCP server">
  <SettingsRow title="MCP server" toggle>
    {#snippet hintContent()}
      MCP (Model Context Protocol) lets AI tools such as Claude Code or Cursor use Git Manager: read what it shows, run
      its features and measure its performance. Off by default. When on, it only listens on this Mac and every request
      needs the secret token below.
    {/snippet}
    <Switch label="MCP server" checked={settings.mcpEnabled} onchange={(on) => set("mcpEnabled", on)} />
  </SettingsRow>
  <SettingsRow title="Status">
    {#snippet hintContent()}
      <Text size="small" tone={statusFailed ? "danger" : "dim"} selectable>{statusLine}</Text>
    {/snippet}
    <Button size="small" onclick={showMcpTools}>Available MCP Tools...</Button>
  </SettingsRow>
  <SettingsRow title="Port">
    {#snippet hintContent()}
      <Text size="small" tone={portError ? "danger" : "dim"}>
        {portError ?? "On 127.0.0.1, shared with the command line tool. A change restarts the server."}
      </Text>
    {/snippet}
    <Input
      mono
      width="number"
      inputmode="numeric"
      invalid={portError !== null}
      bind:value={portDraft}
      onchange={applyPort}
      onkeydown={(event) => {
        if (event.key === "Enter") {
          applyPort();
        }
      }}
      aria-label="MCP server port"
    />
  </SettingsRow>
  {#if mcpToken && shownToken}
    <SettingsRow title="Secret token" hint="Connected tools send it with every request. Keep it private." stacked>
      <Stack direction="row" gap="sm" align="center">
        <CodeBlock variant="value" text={shownToken} />
        <Button size="small" onclick={() => (showToken = !showToken)}>{showToken ? "Hide" : "Show"}</Button>
        <Button size="small" onclick={() => void copyToClipboard(mcpToken)}>Copy</Button>
        <Button
          size="small"
          variant="danger"
          onclick={() => void mcpStore.regenerateToken()}
          disabled={mcpStore.working}
        >
          New Token
        </Button>
      </Stack>
    </SettingsRow>
    <SettingsRow title="Connect Claude Code" hint="Run this once in a terminal." stacked>
      {@render command(claudeAddCommand(mcpUrl, shownToken), claudeAddCommand(mcpUrl, mcpToken))}
    </SettingsRow>
    <SettingsRow title="Other MCP clients" hint="Most MCP clients read a config like this one." stacked>
      {@render command(mcpJsonConfig(mcpUrl, shownToken), mcpJsonConfig(mcpUrl, mcpToken))}
    </SettingsRow>
  {:else if serverWanted}
    <SettingsRow title="Secret token" hint="Made when the server first starts.">{""}</SettingsRow>
  {/if}
</SettingsGroup>
