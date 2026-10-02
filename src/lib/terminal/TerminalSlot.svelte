<!-- The area of a terminal editor tab. It stays empty: TerminalHost moves the terminal's element in here. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { terminalStore } from "./terminalStore.svelte";

  let { terminalKey }: { terminalKey: number } = $props();

  let slot = $state<HTMLDivElement | null>(null);

  $effect(() => {
    const element = slot;
    const key = terminalKey;
    if (!element) {
      return;
    }
    untrack(() => terminalStore.setEditorSlot(key, element));
    return () => untrack(() => terminalStore.clearEditorSlot(key, element));
  });
</script>

<div class="terminal-slot" bind:this={slot}></div>

<style>
  .terminal-slot {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: var(--editor-bg);
  }
</style>
