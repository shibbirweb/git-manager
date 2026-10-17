<!-- Settings > Automation, last part: the command line tool and the memory log. -->
<script lang="ts">
  import { errorMessage } from "$lib/api";
  import { memoryLog } from "$lib/debug/memoryLog.svelte";
  import { cliExamples, cliPrefix, LOCAL_BIN_PATH_LINE } from "$lib/mcp/connect";
  import { mcpStore } from "$lib/mcp/mcpStore.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { platformName } from "$lib/update/releases";
  import { revealLabel } from "$lib/views/files/reveal";
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import Button from "@git-manager/ui/components/Button.svelte";
  import CodeBlock from "@git-manager/ui/components/CodeBlock.svelte";
  import Segmented from "@git-manager/ui/components/Segmented.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Switch from "@git-manager/ui/components/Switch.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import SettingsGroup from "./SettingsGroup.svelte";
  import SettingsRow from "./SettingsRow.svelte";
  import { copyToClipboard, numberChoices, onMac, set } from "./settingsShared";

  const mcpStatus = $derived(mcpStore.status);
  const commandPrefix = $derived(mcpStatus ? cliPrefix(mcpStatus) : "nibtree cli");
  /** Where Install puts the command, as the hint names it: ~/.local/bin, or WindowsApps on Windows. */
  const cliFolderLabel = onMac ? "~/.local/bin" : "WindowsApps (on your PATH)";

  async function revealMemoryLog(): Promise<void> {
    const logPath = memoryLog.status?.path;
    if (!logPath) {
      return;
    }
    try {
      await revealItemInDir(logPath);
    } catch (error) {
      toast.info("The log file is not there yet", errorMessage(error));
    }
  }
</script>

{#snippet command(text: string)}
  <Stack direction="row" gap="sm" align="start">
    <Stack grow><CodeBlock variant="command" {text} /></Stack>
    <Button size="small" onclick={() => void copyToClipboard(text)}>Copy</Button>
  </Stack>
{/snippet}

<SettingsGroup title="Command line tool">
  <SettingsRow
    title="Command line tool"
    toggle
    hint={"Lets scripts and AI agents in a terminal use the same tools, for example `nibtree cli " +
      "tools` or `nibtree cli call git_status repoPath=...`. Nibtree must be running."}
  >
    <Switch label="Command line tool" checked={settings.cliEnabled} onchange={(on) => set("cliEnabled", on)} />
  </SettingsRow>
  {#if mcpStatus}
    <SettingsRow title="Install">
      {#snippet hintContent()}
        <Text size="small" tone="dim" selectable>
          {mcpStatus.cliInstalledPath
            ? `Installed at ${mcpStatus.cliInstalledPath}.`
            : `Adds nibtree to ${cliFolderLabel}, so you can type it in any folder.`}
        </Text>
      {/snippet}
      {#if mcpStatus.cliInstalledPath}
        <Button size="small" onclick={() => void mcpStore.uninstallCli()} disabled={mcpStore.working}>Remove</Button>
      {:else}
        <Button size="small" onclick={() => void mcpStore.installCli()} disabled={mcpStore.working}>
          {onMac ? "Install in ~/.local/bin" : "Install"}
        </Button>
      {/if}
    </SettingsRow>
    {#if !mcpStatus.cliOnPath && onMac}
      <SettingsRow
        title="~/.local/bin is not on your PATH"
        stacked
        hint={"Add this line to `~/.zshrc`, then open a new terminal, to type `nibtree` anywhere."}
      >
        {@render command(LOCAL_BIN_PATH_LINE)}
      </SettingsRow>
    {:else if !mcpStatus.cliOnPath}
      <SettingsRow
        title="The folder is not on your PATH"
        stacked
        hint={"Windows keeps it there for every user unless it was removed. Add it back under Edit " +
          "environment variables for your account (Path), then open a new terminal, to type " +
          "`nibtree` anywhere."}
      >
        {@render command(mcpStatus.cliFolder ?? "")}
      </SettingsRow>
    {/if}
    <SettingsRow title="Examples" hint="The tool switches in Help &gt; Available MCP Tools apply here too." stacked>
      <Stack gap="sm">
        {#each cliExamples(commandPrefix) as example (example.command)}
          <Stack direction="row" gap="sm" align="start">
            <Stack grow gap="xxs">
              <CodeBlock variant="command" text={example.command} />
              <Text size="small" tone="dim">{example.hint}</Text>
            </Stack>
            <Button size="small" onclick={() => void copyToClipboard(example.command)}>Copy</Button>
          </Stack>
        {/each}
      </Stack>
    </SettingsRow>
  {/if}
</SettingsGroup>
<SettingsGroup title="Memory log">
  <SettingsRow
    title="Log memory changes"
    toggle
    hint={"For finding what uses memory: writes a line whenever the app's memory changes, next to what was " +
      "on screen and when scrolling started and stopped. AI tools can read it with `read_memory_log`."}
  >
    <Switch
      label="Log memory changes"
      checked={settings.memoryLogEnabled}
      onchange={(on) => set("memoryLogEnabled", on)}
    />
  </SettingsRow>
  <SettingsRow title="Read memory every">
    <Segmented
      label="Memory log interval"
      options={numberChoices([250, 500, 1000, 2000], (ms) => (ms < 1000 ? `${ms} ms` : `${ms / 1000} s`))}
      value={String(settings.memoryLogIntervalMs)}
      onchange={(ms) => set("memoryLogIntervalMs", Number(ms))}
    />
  </SettingsRow>
  <SettingsRow title="Write a line when it changes by" hint="0 MB writes every reading.">
    <Segmented
      label="Memory log threshold"
      options={numberChoices([0, 1, 5, 20], (mb) => `${mb} MB`)}
      value={String(settings.memoryLogThresholdMb)}
      onchange={(mb) => set("memoryLogThresholdMb", Number(mb))}
    />
  </SettingsRow>
  {#if memoryLog.status}
    <SettingsRow title="Log file">
      {#snippet hintContent()}
        <CodeBlock variant="value" text={memoryLog.status?.path ?? ""} />
      {/snippet}
      <Button size="small" onclick={() => void revealMemoryLog()}
        >{revealLabel(platformName(navigator.userAgent))}</Button
      >
    </SettingsRow>
  {/if}
</SettingsGroup>
