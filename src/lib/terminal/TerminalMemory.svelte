<!-- The Terminals section of the memory details, like Orca's: the sum, then each terminal, agent or run of this
     window with its shell and what it started. Measured only while the details are open; a click shows the
     terminal. -->
<script lang="ts">
  import Icon from "@git-manager/ui/components/Icon.svelte";
  import Row from "@git-manager/ui/components/Row.svelte";
  import Spacer from "@git-manager/ui/components/Spacer.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import type { TerminalMemory } from "$lib/types";
  import { formatBytes } from "$lib/ui/formatBytes";
  import { terminalMemoryRows, terminalMemoryTitle, terminalMemoryTotal } from "./terminalMemory";
  import { terminalStore } from "./terminalStore.svelte";

  const POLL_MS = 5000;

  let { onShow }: { onShow: () => void } = $props();

  let measured = $state.raw<TerminalMemory[]>([]);
  const rows = $derived(terminalMemoryRows(measured, terminalStore.terminals));
  const total = $derived(terminalMemoryTotal(rows));
  const icons = { agent: "bot", run: "play", terminal: "terminal" } as const;

  async function poll(): Promise<void> {
    try {
      measured = await api.terminalMemory();
    } catch {
      measured = [];
    }
  }

  function show(terminalKey: number | null): void {
    if (terminalKey === null) {
      return;
    }
    terminalStore.showTerminal(terminalKey);
    onShow();
  }

  onMount(() => {
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  });
</script>

{#if rows.length > 0}
  <Stack gap="xxs" line="top" paddingY="sm" label="Terminal memory">
    <Stack direction="row" justify="between">
      <Text size="xsmall" weight="semibold" tone="dim">Terminals</Text>
      <Text size="xsmall" weight="semibold" tone="dim" mono>{formatBytes(total)}</Text>
    </Stack>
    {#each rows as row (row.terminalId)}
      <Row
        size="tree"
        disabled={row.terminalKey === null}
        title={terminalMemoryTitle(row)}
        onclick={() => show(row.terminalKey)}
      >
        <Icon name={icons[row.kind]} size="small" tone="dim" />
        <Text size="small" truncate>{row.label}</Text>
        {#if row.folderName}
          <Text size="xsmall" tone="dim" truncate giveWay>{row.folderName}</Text>
        {/if}
        <Spacer />
        <Text size="small" tone="dim" mono>{formatBytes(row.bytes)}</Text>
      </Row>
    {/each}
    <Text size="xsmall" tone="dim" element="p">
      Each shell with everything it started, such as an agent. Not counted in the app's memory above.
    </Text>
  </Stack>
{/if}
