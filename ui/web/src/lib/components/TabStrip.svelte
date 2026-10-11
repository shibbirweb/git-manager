<!-- The editor's tab strip: tabs with an icon, name, optional hint and a close button that shows on hover (a dot
     while there are unsaved changes). The active tab has the editor color and an accent line, gray when the
     group does not have the focus. Preview tabs are italic until edited or pinned. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface EditorTab {
    id: string;
    label: string;
    icon?: IconName;
    hint?: string;
    title?: string;
    preview?: boolean;
    dirty?: boolean;
    pinned?: boolean;
  }

  interface Props {
    tabs: EditorTab[];
    active?: string | null;
    label: string;
    focused?: boolean;
    onselect?: (id: string) => void;
    onclose?: (id: string) => void;
    oncontextmenu?: (id: string, event: MouseEvent) => void;
    trailing?: Snippet;
  }

  let {
    tabs,
    active = $bindable(null),
    label,
    focused = true,
    onselect,
    onclose,
    oncontextmenu,
    trailing,
  }: Props = $props();

  function select(id: string): void {
    active = id;
    onselect?.(id);
  }
</script>

<div class="tab-strip" class:unfocused={!focused} role="tablist" aria-label={label}>
  {#each tabs as tab (tab.id)}
    <div
      class="tab"
      class:active={tab.id === active}
      class:preview={tab.preview}
      class:pinned={tab.pinned}
      class:dirty={tab.dirty}
      role="presentation"
      oncontextmenu={(event) => oncontextmenu?.(tab.id, event)}
      onauxclick={(event) => event.button === 1 && onclose?.(tab.id)}
    >
      <button
        class="tab-main"
        type="button"
        role="tab"
        aria-selected={tab.id === active}
        title={tab.title ?? tab.label}
        onclick={() => select(tab.id)}
      >
        {#if tab.icon}
          <Icon name={tab.icon} size={13} />
        {/if}
        <span class="name">{tab.label}</span>
        {#if tab.hint}
          <span class="hint">{tab.hint}</span>
        {/if}
      </button>
      {#if onclose}
        <button class="tab-close" type="button" aria-label="Close {tab.label}" onclick={() => onclose?.(tab.id)}>
          <span class="dot" aria-hidden="true"></span>
          <span class="x"><Icon name={tab.pinned ? "pin" : "x"} size={12} /></span>
        </button>
      {/if}
    </div>
  {/each}
  {@render trailing?.()}
</div>

<style>
  .tab-strip {
    flex: none;
    position: relative;
    display: flex;
    align-items: stretch;
    height: var(--tab-strip-height);
    overflow-x: auto;
    overflow-y: hidden;
    background: var(--panel-alt);
    border-bottom: 1px solid var(--border-strong);
    scrollbar-width: none;
    user-select: none;
  }

  .tab-strip::-webkit-scrollbar {
    display: none;
  }

  .tab {
    flex: none;
    position: relative;
    display: flex;
    align-items: center;
    max-width: var(--tab-strip-tab-max-width);
    padding-right: 4px;
    border-right: 1px solid var(--border-strong);
    color: var(--text-dim);
  }

  .tab:hover {
    background: var(--hover);
  }

  .tab.active {
    background: var(--editor-bg);
    color: var(--text);
  }

  .tab.active::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: var(--tab-strip-indicator);
    background: var(--accent);
  }

  .unfocused .tab.active::before {
    background: var(--border-strong);
  }

  .unfocused .tab.active {
    color: var(--text-dim);
  }

  .tab-main {
    display: flex;
    align-items: center;
    gap: var(--tab-strip-gap);
    min-width: 0;
    height: 100%;
    padding: 0 var(--tab-strip-tab-padding-right) 0 var(--tab-strip-tab-padding-left);
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .tab-main > :global(svg) {
    flex: none;
    opacity: 0.8;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview .name {
    font-style: italic;
  }

  .hint {
    flex: none;
    font-size: 11.5px;
    color: var(--text-faint);
  }

  .tab-close {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--tab-strip-close-size);
    height: var(--tab-strip-close-size);
    padding: 0;
    border: none;
    border-radius: var(--radius-small);
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .tab-close:hover {
    background: var(--border-strong);
    color: var(--text);
  }

  .x {
    display: flex;
    opacity: 0;
  }

  .tab:hover .x,
  .tab.active .x,
  .tab.pinned .x {
    opacity: 1;
  }

  /* Unsaved changes: a dot in place of the x until the close button itself is hovered. */
  .dot {
    display: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-dim);
  }

  .tab.dirty .dot {
    display: block;
  }

  .tab.dirty .x {
    display: none;
  }

  .tab.dirty .tab-close:hover .dot {
    display: none;
  }

  .tab.dirty .tab-close:hover .x {
    display: flex;
    opacity: 1;
  }
</style>
