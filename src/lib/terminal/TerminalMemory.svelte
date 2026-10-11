<!-- The Terminals section of the memory details, like Orca's: the sum, then each terminal, agent or run of this
     window with its shell and what it started. Measured only while the details are open; a click shows the
     terminal. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import type { TerminalMemory } from "$lib/types";
  import { formatBytes } from "$lib/ui/formatBytes";
  import Icon from "$lib/ui/Icon.svelte";
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
  <div class="terminals" aria-label="Terminal memory">
    <div class="terminals-head">
      <span>Terminals</span>
      <span class="mono">{formatBytes(total)}</span>
    </div>
    <div class="rows">
      {#each rows as row (row.terminalId)}
        <button class="row" disabled={row.terminalKey === null} title={terminalMemoryTitle(row)} onclick={() => show(row.terminalKey)}>
          <Icon name={icons[row.kind]} size={11} />
          <span class="label">{row.label}</span>
          {#if row.folderName}
            <span class="folder">{row.folderName}</span>
          {/if}
          <span class="mono bytes">{formatBytes(row.bytes)}</span>
        </button>
      {/each}
    </div>
    <p class="hint">Each shell with everything it started, such as an agent. Not counted in the app's memory above.</p>
  </div>
{/if}

<style>
  .terminals {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 9px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }

  .terminals-head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
  }

  .terminals-head .mono {
    color: var(--text);
  }

  .rows {
    display: flex;
    flex-direction: column;
    /* Rows reach 4px past the text on both sides, so their hover fills around the text lined up above. */
    margin: 0 -4px;
    max-height: 160px;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
    width: 100%;
    min-width: 0;
    padding: 3px 4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }

  .row:hover:not(:disabled),
  .row:focus-visible {
    background: var(--hover);
    color: var(--text);
    outline: none;
  }

  .row:disabled {
    cursor: default;
  }

  .label {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text);
  }

  .folder {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }

  .bytes {
    flex: none;
    margin-left: auto;
    color: var(--text);
  }

  .hint {
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--text-dim);
  }
</style>
