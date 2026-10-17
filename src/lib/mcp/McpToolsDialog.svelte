<!-- Help > Available MCP Tools: every tool AI agents can use, with a switch each, and the recent
     calls. Lazy-loaded by App.svelte and mounted only while open. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import type { McpToolInfo } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Button from "@nibtree/ui/components/Button.svelte";
  import Dialog from "@nibtree/ui/components/Dialog.svelte";
  import Link from "@nibtree/ui/components/Link.svelte";
  import ListBox from "@nibtree/ui/components/ListBox.svelte";
  import Notice from "@nibtree/ui/components/Notice.svelte";
  import Row from "@nibtree/ui/components/Row.svelte";
  import SearchField from "@nibtree/ui/components/SearchField.svelte";
  import SectionTitle from "@nibtree/ui/components/SectionTitle.svelte";
  import SettingRow from "@nibtree/ui/components/SettingRow.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Switch from "@nibtree/ui/components/Switch.svelte";
  import Tag from "@nibtree/ui/components/Tag.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import Toolbar from "@nibtree/ui/components/Toolbar.svelte";
  import { mcpStore } from "./mcpStore.svelte";
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

  let filter = $state("");

  const tools = $derived(mcpStore.tools);
  const shown = $derived(filterTools(tools, filter));
  const groups = $derived(groupTools(shown));
  const enabledCount = $derived(tools.filter((tool) => toolEnabled(tool, settings.mcpTools)).length);
  const changedShown = $derived(changedTools(settings.mcpTools, shown));
  const recent = $derived([...mcpStore.activity].reverse());
  const status = $derived(mcpStore.status);
  const statusLine = $derived.by(() => {
    if (mcpStore.statusError) {
      return "The server is not available in this build.";
    }
    if (!status) {
      return "Checking...";
    }
    if (status.error) {
      return status.error;
    }
    if (status.running) {
      return `Running at ${status.url}`;
    }
    return "Off. Turn it on in Settings > Automation.";
  });
  // The title's icon tile shows the server's state, like a status light.
  const statusTone = $derived.by(() => {
    if (mcpStore.statusError || status?.error) {
      return "danger";
    }
    return status?.running ? "success" : "accent";
  });

  onMount(() => {
    void mcpStore.refreshStatus();
    void mcpStore.loadTools();
    void mcpStore.loadActivity();
    return mcpStore.followActivity();
  });

  function close(): void {
    mcpStore.toolsDialogOpen = false;
  }

  function openSettings(): void {
    close();
    settings.openDialog("automation");
  }

  /** Turning on destructive tools in bulk asks first: they run commands or change files without asking. */
  async function setMany(list: McpToolInfo[], enabled: boolean): Promise<void> {
    const risky = enabled ? list.filter((tool) => tool.destructive && !toolEnabled(tool, settings.mcpTools)) : [];
    if (risky.length > 0) {
      const names = risky.map((tool) => tool.title).join(", ");
      const ok = await dialogs.confirm({
        title: "Turn On Destructive Tools",
        message:
          `This turns on ${countOf(risky.length, "destructive tool")} (${names}). ` +
          "Agents can then use them without asking you.",
        confirmLabel: "Turn On",
        danger: true,
      });
      if (!ok) {
        return;
      }
    }
    settings.setPreference("mcpTools", withToolStates(settings.mcpTools, list, enabled));
  }

  /** Destructive tools go back off and the rest back on, for the tools the filter shows. */
  async function restoreDefaults(): Promise<void> {
    const count = changedShown.length;
    const ok = await dialogs.confirm({
      title: "Restore Defaults",
      message:
        `This puts ${countOf(count, "tool")} back to the default: ` + "destructive tools off, every other tool on.",
      confirmLabel: "Restore",
    });
    if (ok) {
      settings.setPreference("mcpTools", withDefaultStates(settings.mcpTools, shown));
    }
  }

  function setOne(tool: McpToolInfo, enabled: boolean): void {
    settings.setPreference("mcpTools", withToolStates(settings.mcpTools, [tool], enabled));
  }

  function badgeTone(tool: McpToolInfo): "danger" | "warning" | "success" {
    const badge = toolBadge(tool);
    if (badge === "destructive") {
      return "danger";
    }
    return badge === "can change files" ? "warning" : "success";
  }

  function countOf(count: number, noun: string): string {
    return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
  }

  function timeOf(at: number): string {
    return new Date(at).toLocaleTimeString();
  }
</script>

<Dialog
  open
  variant="panel"
  width="xlarge"
  title="Available MCP Tools"
  subtitle={statusLine}
  icon="bot"
  iconTone={statusTone}
  onclose={close}
>
  {#snippet toolbar()}
    <Toolbar variant="dialog" label="MCP tools">
      <SearchField size="compact" label="Filter tools" placeholder="Filter tools" bind:value={filter} autofocus />
      <Button size="small" onclick={() => void setMany(shown, true)} disabled={shown.length === 0}>Turn All On</Button>
      <Button size="small" onclick={() => void setMany(shown, false)} disabled={shown.length === 0}>
        Turn All Off
      </Button>
      <Button
        size="small"
        onclick={() => void restoreDefaults()}
        disabled={changedShown.length === 0}
        title="Destructive tools off, every other tool on"
      >
        Restore Defaults
      </Button>
      <Button size="small" onclick={openSettings}>Settings...</Button>
    </Toolbar>
  {/snippet}
  <Stack gap="sm">
    <Stack direction="row" gap="md" align="center" justify="between" paddingY="xs">
      <Text tone="dim" size="small">
        These switches apply to MCP clients and to the command line tool. Destructive tools start off.
      </Text>
      <Text tone="dim" size="small" tabular>{toolCountLabel(enabledCount, tools.length)}</Text>
    </Stack>
    {#if mcpStore.toolsError}
      <Notice tone="warning">Only the app window's tools are listed: {mcpStore.toolsError}</Notice>
    {/if}
    {#each groups as group (group.category)}
      {@const onCount = group.tools.filter((tool) => toolEnabled(tool, settings.mcpTools)).length}
      <Stack element="section" gap="none">
        <SectionTitle variant="group" title={group.category} heading={3}>
          {#snippet actions()}
            <Stack direction="row" gap="md" align="center">
              <Text tone="dim" size="small" tabular>{onCount} of {group.tools.length}</Text>
              <Link size="small" onclick={() => void setMany(group.tools, true)}>Turn All On</Link>
              <Link size="small" onclick={() => void setMany(group.tools, false)}>Turn All Off</Link>
            </Stack>
          {/snippet}
        </SectionTitle>
        {#each group.tools as tool (tool.name)}
          <SettingRow title={tool.title} hint={tool.description} toggle>
            {#snippet mark()}
              <Text mono size="codeSmall" tone="dim" selectable>{tool.name}</Text>
              <Tag size="small" tone={badgeTone(tool)}>{toolBadge(tool)}</Tag>
            {/snippet}
            <Switch
              label="Use {tool.title}"
              checked={toolEnabled(tool, settings.mcpTools)}
              onchange={(enabled) => setOne(tool, enabled)}
            />
          </SettingRow>
        {/each}
      </Stack>
    {:else}
      <Text tone="dim" element="p">{tools.length === 0 ? "Loading tools..." : "No tool matches the filter."}</Text>
    {/each}

    <Stack element="section" gap="xs">
      <SectionTitle variant="group" title="Recent calls" heading={3} />
      {#if recent.length === 0}
        <Text tone="dim" element="p">No calls yet.</Text>
      {:else}
        <ListBox label="Recent calls">
          {#each recent as call, index (`${call.at}-${call.tool}-${index}`)}
            <Row size="entry" line title={call.error ?? ""}>
              <Stack width="xxsmall">
                <Text size="small" tone={call.ok ? "success" : "danger"}>{call.ok ? "ok" : "error"}</Text>
              </Stack>
              <Text mono size="codeSmall" selectable>{call.tool}</Text>
              <Tag size="small">{call.client === "cli" ? "CLI" : "MCP"}</Tag>
              <Text tone="dim" size="small" tabular>{timeOf(call.at)}</Text>
              <Text tone="dim" size="small" tabular>{call.durationMs} ms</Text>
              {#if call.error}
                <Text tone="danger" size="small" truncate>{call.error}</Text>
              {/if}
            </Row>
          {/each}
        </ListBox>
      {/if}
    </Stack>
  </Stack>
</Dialog>
