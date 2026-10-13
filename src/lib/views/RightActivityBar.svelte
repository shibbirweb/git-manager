<!-- Activity bar on the right edge, mirroring the left one: shows the Files or the AI panel in the right sidebar. -->
<script lang="ts">
  import { withCommandKeys } from "$lib/commands/commandRuntime";
  import { settings } from "$lib/stores/settings.svelte";
  import { terminalStore } from "$lib/terminal/terminalStore.svelte";
  import Icon from "$lib/ui/Icon.svelte";

  // A hidden agent that finished or needs the user marks the AI icon too, while the panel is not shown.
  const agentBell = $derived(
    !settings.aiPanelShown && terminalStore.terminals.some((terminal) => terminal.agent && terminal.bell),
  );
</script>

<nav class="activity" aria-label="Right sidebar">
  <button
    class="item"
    class:active={settings.filesPanelShown}
    onclick={() => settings.toggleExplorer()}
    title="{withCommandKeys('Files', 'view.filesPanel')}{settings.filesPanelShown ? ', click to hide' : ''}"
    aria-label="Files"
    aria-pressed={settings.filesPanelShown}
  >
    <Icon name="list-tree" size={19} strokeWidth={1.8} />
  </button>
  <button
    class="item"
    class:active={settings.aiPanelShown}
    onclick={() => settings.toggleRightPanel("ai")}
    title="{withCommandKeys('AI Agents', 'view.aiPanel')}{settings.aiPanelShown ? ', click to hide' : ''}"
    aria-label="AI Agents"
    aria-pressed={settings.aiPanelShown}
  >
    <Icon name="bot" size={19} strokeWidth={1.8} />
    {#if agentBell}
      <span class="badge" aria-hidden="true"></span>
    {/if}
  </button>
</nav>

<style>
  .activity {
    flex: none;
    width: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding-top: 6px;
    background: var(--panel-alt);
    border-left: 1px solid var(--border-strong);
  }

  /* Rounded panels: a stripe on the window frame, flush with the window edge. */
  :global(html[data-rounded-panels]) .activity {
    margin-right: calc(-1 * var(--panel-gap));
    background: var(--frame);
    border-left: none;
  }

  .item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .item:hover {
    color: var(--text);
    background: var(--hover);
  }

  .item.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .badge {
    position: absolute;
    top: 7px;
    right: 7px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 2px var(--panel-alt);
  }

  .item.active::after {
    content: "";
    position: absolute;
    right: -4px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    border-radius: 2px;
    background: var(--accent);
  }
</style>
