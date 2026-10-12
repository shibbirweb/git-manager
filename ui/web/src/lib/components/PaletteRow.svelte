<!-- One row of a CommandPalette: an icon, file icon, symbol badge or help prefix, the title with its matches bold
     (and a command's category, an outline's indent), then a check, a reason, a container, a detail, a dirty dot,
     the folder and the shortcut. CommandPalette draws these; use it alone only in a custom list. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { PaletteItem } from "../logic/palette";
  import { componentTokens } from "../styles/tokens";
  import FileIcon from "./FileIcon.svelte";
  import HighlightText from "./HighlightText.svelte";
  import Icon from "./Icon.svelte";
  import SymbolBadge from "./SymbolBadge.svelte";

  interface Props {
    item: PaletteItem;
    selected?: boolean;
    onhover?: () => void;
    onpick?: () => void;
    /** Buttons at the row's end, such as Remove; they show while the row is hovered or selected. */
    end?: Snippet;
  }

  let { item, selected = false, onhover, onpick, end }: Props = $props();

  const indent = $derived((item.depth ?? 0) * componentTokens.commandPalette.indent);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="row {item.tone ?? ''}"
  class:selected
  class:disabled={item.disabled}
  role="option"
  tabindex="-1"
  aria-selected={selected}
  aria-disabled={item.disabled}
  title={item.disabled ? item.reason : undefined}
  onmousemove={() => !item.disabled && onhover?.()}
  onmousedown={(event) => event.preventDefault()}
  onclick={() => !item.disabled && onpick?.()}
>
  {#if indent}<span class="indent" style:width="{indent}px"></span>{/if}
  {#if item.prefix !== undefined}
    <kbd class="prefix">{item.prefix || "..."}</kbd>
  {:else if item.badge}
    <SymbolBadge letter={item.badge.letter} tone={item.badge.tone} title={item.badge.title} />
  {:else if item.fileIcon !== undefined}
    <FileIcon view={item.fileIcon} />
  {:else if item.icon}
    <Icon name={item.icon} size="normal" />
  {/if}
  <span class="title">
    {#if item.category}<span class="category">{item.category}:</span>{" "}{/if}<HighlightText
      text={item.title}
      ranges={item.ranges ?? []}
    />
  </span>
  {#if item.checked}<span class="check" title="On"><Icon name="check" size="medium" /></span>{/if}
  {#if item.disabled && item.reason}<span class="reason">{item.reason}</span>{/if}
  {#if item.container}<span class="container">in {item.container}</span>{/if}
  {#if item.dirty}<span class="dirty" title="Unsaved changes"></span>{/if}
  {#if item.detail}<span class="detail">{item.detail}</span>{/if}
  {#if item.folder}<span class="folder">{item.folder}</span>{/if}
  {#if item.keys}<kbd>{item.keys}</kbd>{/if}
  {#if end}<span class="end">{@render end()}</span>{/if}
</div>

<style>
  .row {
    height: var(--command-palette-row-height);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: 0 var(--command-palette-row-padding-x);
    border-radius: var(--radius-small);
    color: var(--text-dim);
    cursor: pointer;
  }

  .selected {
    background: var(--selected);
  }

  .disabled {
    cursor: default;
    color: var(--text-faint);
  }

  .disabled .title,
  .disabled kbd {
    color: var(--text-faint);
  }

  .indent {
    flex: none;
  }

  .title,
  .detail,
  .folder,
  .container,
  .reason {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
  }

  .title {
    flex: 1;
    color: var(--text);
  }

  .modified .title {
    color: var(--accent);
  }

  .added .title {
    color: var(--success);
  }

  .conflict .title,
  .deleted .title {
    color: var(--danger);
  }

  .category {
    color: var(--text-dim);
  }

  .check {
    flex: none;
    display: inline-flex;
    color: var(--accent);
  }

  .detail,
  .folder,
  .container,
  .reason {
    flex: 0 1 auto;
    font-size: var(--font-size-small);
    color: var(--text-faint);
  }

  .reason {
    font-style: italic;
  }

  .folder {
    flex: 1;
    text-align: right;
  }

  .dirty {
    flex: none;
    width: var(--status-dot-small-size);
    height: var(--status-dot-small-size);
    border-radius: 50%;
    background: var(--text-dim);
  }

  kbd {
    flex: none;
    padding: 0 var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-small);
    background: var(--panel-alt);
    color: var(--text-dim);
    font-family: var(--font-ui);
    font-size: var(--font-size-compact);
    line-height: var(--command-palette-kbd-line-height);
    white-space: nowrap;
  }

  /* Quick Open's mode prefix, such as > for commands. */
  .prefix {
    min-width: var(--command-palette-prefix-min-width);
    font-family: var(--font-mono);
    text-align: center;
  }

  .end {
    flex: none;
    display: inline-flex;
    visibility: hidden;
  }

  .row:hover .end,
  .row.selected .end {
    visibility: visible;
  }
</style>
