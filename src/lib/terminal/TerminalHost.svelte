<!--
  Mounts every terminal once, for as long as it lives, whether it is shown in
  the panel or in an editor tab. Each TerminalFrame moves its terminal's
  element into the place that shows it, so moving a terminal never restarts
  its shell or loses its scrollback. Terminals with no place on screen stay
  parked in here, out of sight.
-->
<script lang="ts">
  import TerminalFrame from "./TerminalFrame.svelte";
  import { terminalStore } from "./terminalStore.svelte";
</script>

<div class="terminal-host" aria-hidden="true">
  {#each terminalStore.terminals as terminal (terminal.key)}
    <TerminalFrame {terminal} />
  {/each}
</div>

<style>
  .terminal-host {
    display: none;
  }
</style>
