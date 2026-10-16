<!-- A row of formatting buttons above a text, like the Markdown toolbar: icon buttons in groups split by thin
     lines. `null` in `items` starts a new group. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  export interface FormatTool {
    id: string;
    icon: IconName;
    label: string;
    disabled?: boolean;
    menu?: boolean;
  }

  interface Props {
    items: (FormatTool | null)[];
    label: string;
    onaction: (id: string, element: HTMLElement) => void;
  }

  let { items, label, onaction }: Props = $props();
</script>

<div class="toolbar" role="toolbar" aria-label={label}>
  <div class="format">
    {#each items as item, index (item?.id ?? `divider-${index}`)}
      {#if item === null}
        <span class="divider" aria-hidden="true"></span>
      {:else}
        <button
          class="tool"
          type="button"
          title={item.label}
          aria-label={item.label}
          aria-haspopup={item.menu ? "menu" : undefined}
          disabled={item.disabled}
          onmousedown={(event) => event.preventDefault()}
          onclick={(event) => onaction(item.id, event.currentTarget)}
        >
          <Icon name={item.icon} size="normal" />
          {#if item.menu}<Icon name="chevron-down" size="xsmall" />{/if}
        </button>
      {/if}
    {/each}
  </div>
</div>

<style>
  .toolbar {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--format-toolbar-group-gap);
    min-height: var(--format-toolbar-min-height);
    padding: var(--format-toolbar-padding-y) var(--format-toolbar-padding-right) var(--format-toolbar-padding-y)
      var(--format-toolbar-padding-left);
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }

  .format {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1px;
    min-width: 0;
  }

  .tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 1px;
    height: var(--format-toolbar-tool-height);
    min-width: var(--format-toolbar-tool-min-width);
    padding: 0 var(--format-toolbar-tool-padding-x);
    border: none;
    border-radius: var(--radius-small);
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .tool:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  .tool:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .divider {
    width: 1px;
    height: var(--format-toolbar-divider-height);
    margin: 0 var(--space-2);
    background: var(--border-strong);
  }
</style>
