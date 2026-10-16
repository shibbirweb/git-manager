<!-- A floating list at the top of the window to find and run something (Go to File, Search Everywhere, commands).
     The caller filters and passes `items`; arrows, Ctrl+N/P and Page keys move, Enter picks, Esc or a click outside
     closes (logic/paletteHighlight.svelte.ts). With `results`, the caller draws its own list driven by `field`. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import type { PaletteItem } from "../logic/palette";
  import { PaletteHighlight } from "../logic/paletteHighlight.svelte";
  import Icon from "./Icon.svelte";
  import PaletteRow from "./PaletteRow.svelte";

  interface Props {
    open?: boolean;
    items?: PaletteItem[];
    query?: string;
    placeholder?: string;
    status?: string;
    statusTone?: "faint" | "warning";
    emptyText?: string;
    fieldIcon?: IconName;
    fieldSize?: "normal" | "compact";
    size?: "normal" | "wide";
    label: string;
    onpick?: (item: PaletteItem, event: KeyboardEvent | MouseEvent) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    onclose?: () => void;
    head?: Snippet;
    scopes?: Snippet;
    fieldStart?: Snippet;
    fieldEnd?: Snippet;
    results?: Snippet;
    preferred?: string | null;
    rowEnd?: Snippet<[PaletteItem]>;
    field?: HTMLInputElement | null;
    replace?: Snippet;
    footer?: Snippet;
  }

  let {
    open = $bindable(true),
    items = [],
    query = $bindable(""),
    placeholder = "Type to search",
    status = "",
    statusTone = "faint",
    emptyText = "Nothing found",
    fieldIcon = "search",
    fieldSize = "normal",
    size = "normal",
    label,
    onpick,
    onkeydown,
    onclose,
    head,
    scopes,
    fieldStart,
    fieldEnd,
    results,
    preferred = null,
    rowEnd,
    field = $bindable(null),
    replace,
    footer,
  }: Props = $props();

  const highlight = new PaletteHighlight(
    () => items,
    () => query,
    () => preferred,
  );

  function close(): void {
    open = false;
    onclose?.();
  }

  // For the caller: move the highlight (the key that opened it, pressed again), read it (a key that removes it).
  export const step = (by: number): void => highlight.step(by);
  export const highlighted = (): PaletteItem | null => items[highlight.index] ?? null;

  function keydown(event: KeyboardEvent): void {
    onkeydown?.(event);
    const action = event.defaultPrevented || event.isComposing ? null : highlight.key(event, results !== undefined);
    if (action) {
      event.preventDefault();
    }
    if (action === "pick") {
      onpick?.(items[highlight.index], event);
    } else if (action === "close") {
      close();
    }
  }

  /** Focus with the caret at the end, so typing goes on after a prefix such as ">". */
  function focusField(input: HTMLInputElement): void {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
</script>

{#if open}
  <div class="backdrop" role="presentation" onmousedown={close}></div>
  <div class="popup {size}" role="dialog" aria-label={label}>
    {#if head}<div class="head">{@render head()}</div>{/if}
    {#if scopes}<div class="scopes">{@render scopes()}</div>{/if}
    <div class="field" class:compact={fieldSize === "compact"}>
      {@render fieldStart?.()}
      <Icon name={fieldIcon} size="normal" />
      <input
        class="query"
        bind:this={field}
        bind:value={query}
        {placeholder}
        aria-label={label}
        use:focusField
        onkeydown={keydown}
      />
      {#if status}<span class="status" class:notice={statusTone === "warning"}>{status}</span>{/if}
      {@render fieldEnd?.()}
    </div>
    {#if replace}<div class="field replace"><span class="indent"></span>{@render replace()}</div>{/if}
    {#if results}
      <div class="results">{@render results()}</div>
    {:else}
      <div class="list" role="listbox" aria-label={label} bind:this={highlight.list}>
        {#each items as item, index (item.id)}
          {#if item.section && item.section !== items[index - 1]?.section}
            <div class="section">{item.section}</div>
          {/if}
          <PaletteRow
            {item}
            selected={index === highlight.index}
            onhover={() => (highlight.index = index)}
            onpick={(event) => onpick?.(item, event)}
            end={rowEnd}
          />
        {:else}
          <div class="message">{emptyText}</div>
        {/each}
      </div>
    {/if}
    {#if footer}<div class="hints">{@render footer()}</div>{/if}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 880;
  }

  .popup {
    position: fixed;
    top: var(--command-palette-top);
    left: 50%;
    transform: translateX(-50%);
    z-index: 885;
    width: min(var(--command-palette-width), calc(100vw - 2 * var(--space-8)));
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: var(--command-palette-radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: var(--command-palette-field-height);
    padding: 0 var(--command-palette-field-padding-x);
    color: var(--text-dim);
    border-bottom: 1px solid var(--border-strong);
  }

  .query {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: var(--font-size-title);
  }

  .query::placeholder {
    color: var(--text-faint);
  }

  .status {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-size-compact);
    color: var(--text-faint);
  }

  .status.notice {
    color: var(--warning);
  }

  .results {
    display: flex;
    flex-direction: column;
    padding: var(--command-palette-list-padding);
  }

  .list {
    max-height: min(var(--command-palette-max-height), 60vh);
    overflow-y: auto;
    padding: var(--command-palette-list-padding);
  }

  .section,
  .message {
    height: var(--command-palette-row-height);
    display: flex;
    align-items: center;
    padding: 0 var(--command-palette-row-padding-x);
    color: var(--text-faint);
  }

  .section {
    justify-content: flex-end;
    font-size: var(--text-section-label-size);
    font-weight: var(--text-section-label-weight);
    text-transform: var(--text-section-label-transform);
    letter-spacing: var(--text-section-label-letter-spacing);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--command-palette-head-gap);
    padding: var(--command-palette-head-padding-y) var(--command-palette-head-padding-right)
      var(--command-palette-head-padding-y) var(--command-palette-head-padding-left);
    border-bottom: 1px solid var(--border-strong);
  }

  /* Find in Files: wider and lower, a taller field, scopes above it and a replace row under it. */
  .wide {
    top: 12vh;
    width: min(var(--command-palette-wide-width), calc(100vw - 2 * var(--space-8)));
    border-radius: var(--radius-dialog);
  }

  .wide .field {
    height: var(--command-palette-wide-field-height);
  }

  .wide .field {
    padding-right: var(--command-palette-wide-field-padding-right);
  }

  .wide .field.replace {
    height: var(--command-palette-replace-field-height);
  }

  .indent {
    flex: none;
    width: var(--command-palette-replace-indent-width);
    margin-left: var(--command-palette-replace-indent);
  }

  .scopes {
    display: flex;
    align-items: center;
    gap: var(--command-palette-scopes-gap);
    padding: var(--command-palette-scopes-padding-top) var(--command-palette-scopes-padding-right) 0
      var(--command-palette-scopes-padding-left);
    border-bottom: 1px solid var(--border-strong);
    color: var(--text-dim);
    font-size: var(--font-size-compact);
  }

  .field.compact {
    height: var(--command-palette-compact-field-height);
  }

  .hints {
    display: flex;
    flex-wrap: wrap;
    gap: var(--command-palette-hints-gap-y) var(--command-palette-hints-gap-x);
    padding: var(--command-palette-hints-padding-y) var(--command-palette-hints-padding-x);
    border-top: 1px solid var(--border-strong);
    font-size: var(--font-size-compact);
    color: var(--text-faint);
  }
</style>
