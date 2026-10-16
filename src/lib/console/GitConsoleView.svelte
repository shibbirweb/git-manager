<!--
  The Git Console: every git command the app ran, newest last.
  Mounted only while it is on screen: it loads the backend's list, then follows the "git-command" events.
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { api, errorMessage, onGitCommand } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { GitCommandEntry } from "$lib/types";
  import Button from "@git-manager/ui/components/Button.svelte";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import List from "@git-manager/ui/components/List.svelte";
  import Row from "@git-manager/ui/components/Row.svelte";
  import SearchField from "@git-manager/ui/components/SearchField.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import StatusDot from "@git-manager/ui/components/StatusDot.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import Toolbar from "@git-manager/ui/components/Toolbar.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import {
    commandText,
    formatDuration,
    formatTime,
    matchesFilter,
    mergeEntries,
    outputBlocks,
    repoName,
    statusOf,
    upsertEntry,
  } from "./consoleModel";

  let entries = $state.raw<GitCommandEntry[]>([]);
  let openIds = $state.raw<Set<number>>(new Set());
  let filter = $state("");
  let loadError = $state<string | null>(null);
  let loaded = false;
  let early: GitCommandEntry[] = [];
  let unlisten: (() => void) | null = null;
  let destroyed = false;

  const filtered = $derived(filter.trim() ? entries.filter((entry) => matchesFilter(entry, filter)) : entries);

  onMount(() => {
    void start();
  });

  onDestroy(() => {
    destroyed = true;
    unlisten?.();
  });

  async function start(): Promise<void> {
    try {
      const stop = await onGitCommand((entry) => received(entry));
      if (destroyed) {
        stop();
        return;
      }
      unlisten = stop;
      const list = await api.gitConsoleEntries();
      entries = mergeEntries(list ?? [], early);
      early = [];
      loaded = true;
      loadError = null;
    } catch (error) {
      loadError = errorMessage(error);
    }
  }

  function received(entry: GitCommandEntry): void {
    if (!loaded) {
      early.push(entry);
      return;
    }
    entries = upsertEntry(entries, entry);
  }

  function toggle(entryId: number): void {
    const next = new Set(openIds);
    if (next.has(entryId)) {
      next.delete(entryId);
    } else {
      next.add(entryId);
    }
    openIds = next;
  }

  async function clear(): Promise<void> {
    try {
      await api.gitConsoleClear();
      entries = [];
      openIds = new Set();
    } catch (error) {
      toast.error("Could not clear the console", errorMessage(error));
    }
  }

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  function outputText(entry: GitCommandEntry): string {
    return [entry.stdout, entry.stderr, entry.error ?? ""]
      .map((text) => (text ?? "").replace(/\s+$/, ""))
      .filter(Boolean)
      .join("\n");
  }

  function openMenu(event: MouseEvent, entry: GitCommandEntry): void {
    const output = outputText(entry);
    contextMenu.open(event, [
      { label: "Copy Command", action: () => void copy(commandText(entry)) },
      { label: "Copy Output", disabled: output === "", action: () => void copy(output) },
      { separator: true },
      { label: openIds.has(entry.id) ? "Hide Output" : "Show Output", action: () => toggle(entry.id) },
    ]);
  }

  function repoLabel(repoPath: string): string {
    return repoStore.repos.find((repo) => repo.root === repoPath)?.name ?? repoName(repoPath);
  }

  const BLOCK_TONES = { stdout: "default", stderr: "dim", error: "danger", note: "faint" } as const;
  const STATUS_TONES = { running: "neutral", success: "success", failed: "danger" } as const;

  function statusTitle(entry: GitCommandEntry): string {
    const status = statusOf(entry);
    if (status === "running") {
      return "Running";
    }
    if (entry.error) {
      return `Failed: ${entry.error}`;
    }
    return status === "success" ? "Exit code 0" : `Failed, exit code ${entry.exitCode ?? "unknown"}`;
  }
</script>

<Stack gap="none" grow surface="editor">
  <Toolbar variant="panel" label="Git Console">
    <SearchField size="small" label="Filter commands" placeholder="Filter commands" bind:value={filter} />
    <Text size="small" tone="dim" tabular>
      {filter.trim() ? `${filtered.length} of ${entries.length}` : entries.length}
      {entries.length === 1 ? "command" : "commands"}
    </Text>
    {#snippet end()}
      <Button size="small" disabled={entries.length === 0} title="Clear the console" onclick={() => void clear()}>
        Clear
      </Button>
    {/snippet}
  </Toolbar>
  {#if loadError}
    <EmptyState title="Could not load the Git Console: {loadError}" titleTone="dim" />
  {:else}
    <List
      items={filtered}
      itemKey={(entry) => String(entry.id)}
      label="Git commands"
      role="list"
      height="fill"
      virtual="normal"
      measure
      follow
    >
      {#snippet row(entry)}
        {@const open = openIds.has(entry.id)}
        {@const status = statusOf(entry)}
        <Stack gap="none">
          <Row
            expanded={open}
            title={commandText(entry)}
            onclick={() => toggle(entry.id)}
            oncontextmenu={(event) => openMenu(event, entry)}
          >
            <Text size="small" tone="dim" tabular>{formatTime(entry.startedAt)}</Text>
            <Text size="small" tone="dim" truncate>{repoLabel(entry.repoPath)}</Text>
            <Stack grow><Text mono size="code" truncate>{commandText(entry)}</Text></Stack>
            <Text size="small" tone="dim" tabular>{formatDuration(entry.durationMs)}</Text>
            <StatusDot tone={STATUS_TONES[status]} pulse={status === "running"} label={statusTitle(entry)} />
          </Row>
          {#if open}
            <Stack paddingLeft="xxl" paddingY="xxs">
              <Stack surface="alt" padding="sm" scroll="y" maxHeight="medium">
                {#each outputBlocks(entry) as block, blockIndex (blockIndex)}
                  <Text mono size="small" wrap="pre" selectable tone={BLOCK_TONES[block.kind]} element="p">
                    {block.text}
                  </Text>
                {/each}
              </Stack>
            </Stack>
          {/if}
        </Stack>
      {/snippet}
      {#snippet empty()}
        <EmptyState
          title={entries.length === 0 ? "Git commands the app runs show up here." : "No commands match the filter."}
          titleTone="dim"
        />
      {/snippet}
    </List>
  {/if}
</Stack>
