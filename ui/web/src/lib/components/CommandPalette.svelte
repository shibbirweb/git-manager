<!-- A floating list at the top of the window to find and run something: Go to File, Recent Files, Search
     Everywhere, Run Command. Type to filter (the caller filters and passes `items`), arrows move, Enter picks, Esc
     or a click outside closes. Rows show an icon, the title with its matches, a dim detail, a folder and keys. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import type { PaletteItem } from "../logic/palette";
  import Icon from "./Icon.svelte";
  import PaletteRow from "./PaletteRow.svelte";

  interface Props {
    open?: boolean;
    items: PaletteItem[];
    query?: string;
    placeholder?: string;
    status?: string;
    statusTone?: "faint" | "warning";
    emptyText?: string;
    fieldIcon?: IconName;
    fieldSize?: "normal" | "compact";
    size?: "normal" | "wide";
    label: string;
    onpick: (item: PaletteItem) => void;
    onclose?: () => void;
    head?: Snippet;
    scopes?: Snippet;
    fieldEnd?: Snippet;
    replace?: Snippet;
    footer?: Snippet;
  }

  let {
    open = $bindable(true),
    items,
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
    onclose,
    head,
    scopes,
    fieldEnd,
    replace,
    footer,
  }: Props = $props();

  let highlighted = $state(0);
  const pickable = $derived(items.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0));

  $effect(() => {
    void items;
    highlighted = pickable[0] ?? -1;
  });

  function close(): void {
    open = false;
    onclose?.();
  }

  function step(direction: 1 | -1): void {
    const at = pickable.indexOf(highlighted);
    highlighted = pickable[Math.min(pickable.length - 1, Math.max(0, at + direction))] ?? -1;
  }

  function keydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      step(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && highlighted >= 0) {
      event.preventDefault();
      onpick(items[highlighted]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function focusField(input: HTMLInputElement): void {
    input.focus();
  }
</script>

{#if open}
  <div class="backdrop" role="presentation" onmousedown={close}></div>
  <div class="popup {size}" role="dialog" aria-label={label}>
    {#if head}<div class="head">{@render head()}</div>{/if}
    {#if scopes}<div class="scopes">{@render scopes()}</div>{/if}
    <div class="field" class:compact={fieldSize === "compact"}>
      <Icon name={fieldIcon} size="normal" />
      <!-- svelte-ignore a11y_autofocus -->
      <input class="query" bind:value={query} {placeholder} aria-label={label} use:focusField onkeydown={keydown} />
      {#if status}<span class="status" class:notice={statusTone === "warning"}>{status}</span>{/if}
      {@render fieldEnd?.()}
    </div>
    {#if replace}<div class="field replace"><span class="indent"></span>{@render replace()}</div>{/if}
    <div class="list" role="listbox" aria-label={label}>
      {#each items as item, index (item.id)}
        {#if item.section && item.section !== items[index - 1]?.section}
          <div class="section">{item.section}</div>
        {/if}
        <PaletteRow
          {item}
          selected={index === highlighted}
          onhover={() => (highlighted = index)}
          onpick={() => onpick(item)}
        />
      {:else}
        <div class="message">{emptyText}</div>
      {/each}
    </div>
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
