<!-- One editor tab of a TabStrip: icon, name, hint and the close button (a dot while unsaved). The strip passes its
     layout and focus; the tab draws the active, preview, pinned, dirty and lifted states. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  export interface EditorTabData {
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
    tab: EditorTabData;
    active?: boolean;
    focused?: boolean;
    layout?: "scroll" | "wrap" | "single";
    lifted?: boolean;
    closable?: boolean;
    onselect?: () => void;
    ondblclick?: () => void;
    onclose?: () => void;
    oncontextmenu?: (event: MouseEvent) => void;
    onpointerdown?: (event: PointerEvent) => void;
  }

  let {
    tab,
    active = false,
    focused = true,
    layout = "scroll",
    lifted = false,
    closable = true,
    onselect,
    ondblclick,
    onclose,
    oncontextmenu,
    onpointerdown,
  }: Props = $props();
</script>

<div
  class="tab {layout}"
  class:active
  class:unfocused={!focused}
  class:preview={tab.preview}
  class:pinned={tab.pinned}
  class:dirty={tab.dirty}
  class:lifted
  role="presentation"
  data-tab-id={tab.id}
  oncontextmenu={(event) => oncontextmenu?.(event)}
  onauxclick={(event) => event.button === 1 && onclose?.()}
  {onpointerdown}
>
  <button
    class="tab-main"
    type="button"
    role="tab"
    aria-selected={active}
    title={tab.title ?? tab.label}
    onclick={() => onselect?.()}
    ondblclick={() => ondblclick?.()}
  >
    {#if tab.icon}
      <Icon name={tab.icon} size="medium" />
    {/if}
    <span class="name">{tab.label}</span>
    {#if tab.hint}
      <span class="hint">{tab.hint}</span>
    {/if}
  </button>
  {#if closable}
    <button class="tab-close" type="button" aria-label="Close {tab.label}" onclick={() => onclose?.()}>
      <span class="dot" aria-hidden="true"></span>
      <span class="x"><Icon name={tab.pinned ? "pin" : "x"} size="compact" /></span>
    </button>
  {/if}
</div>

<style>
  .tab {
    flex: none;
    position: relative;
    display: flex;
    align-items: center;
    max-width: var(--tab-strip-tab-max-width);
    padding-right: var(--space-2);
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

  .tab.unfocused.active::before {
    background: var(--border-strong);
  }

  .tab.unfocused.active {
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
    font-size: var(--font-size-compact);
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
    width: var(--editor-tab-dirty-dot);
    height: var(--editor-tab-dirty-dot);
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
  /* Wrap layout: rows of tabs, each with its own bottom line. */
  .tab.wrap {
    height: var(--tab-strip-height);
    max-width: min(var(--tab-strip-tab-max-width), 100%);
    margin-bottom: -1px;
    border-bottom: 1px solid var(--border-strong);
  }

  /* Single layout: the lone tab is a centered name without the tab's frame; the left padding matches the close
     button so the name sits in the middle. */
  .tab.single {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
    padding-left: var(--tab-strip-single-padding-left);
    border-right: none;
    background: transparent;
  }

  .tab.single::before {
    display: none;
  }

  .tab.single .tab-main {
    padding: 0 var(--tab-strip-tab-padding-right);
  }

  .tab.single .name {
    font-weight: var(--font-weight-medium);
  }

  .tab.single .x {
    opacity: 1;
  }

  /* The tab being dragged floats above the others. */
  .tab.lifted {
    z-index: 2;
    background: var(--editor-bg);
    box-shadow: var(--shadow);
  }
</style>
