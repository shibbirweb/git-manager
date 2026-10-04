<!-- Activity bar on the right edge, mirroring the left one: toggles the Files panel. -->
<script lang="ts">
  import { settings } from "$lib/stores/settings.svelte";
  import Icon from "$lib/ui/Icon.svelte";
</script>

<nav class="activity" aria-label="Right sidebar">
  <button
    class="item"
    class:active={settings.explorerOpen}
    onclick={() => settings.toggleExplorer()}
    title="Files (Cmd+B){settings.explorerOpen ? ', click to hide' : ''}"
    aria-label="Files"
    aria-pressed={settings.explorerOpen}
  >
    <Icon name="list-tree" size={19} strokeWidth={1.8} />
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
