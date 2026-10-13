<!-- The list that opens under a breadcrumb: a filter field, then the folder's entries (icon, name in its git color,
     a chevron for folders) or a message. Arrow keys move, Enter picks, Escape closes. The caller places it. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface CrumbEntry {
    id: string;
    name: string;
    icon?: IconName;
    tone?: "modified" | "added" | "conflict" | "deleted" | "ignored" | "search";
    folder?: boolean;
  }

  interface Props {
    entries: CrumbEntry[];
    query?: string;
    placeholder?: string;
    message?: string;
    error?: boolean;
    label: string;
    onpick: (entry: CrumbEntry) => void;
    onclose?: () => void;
  }

  let {
    entries,
    query = $bindable(""),
    placeholder = "Filter",
    message = "",
    error = false,
    label,
    onpick,
    onclose,
  }: Props = $props();

  let selected = $state(0);

  function keydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      selected = Math.min(entries.length - 1, Math.max(0, selected + step));
    } else if (event.key === "Enter" && entries[selected]) {
      event.preventDefault();
      onpick(entries[selected]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onclose?.();
    }
  }

  function focus(input: HTMLInputElement): void {
    input.focus();
  }
</script>

<div class="popup" role="dialog" aria-label={label}>
  <div class="field">
    <Icon name="search" size="medium" />
    <input bind:value={query} {placeholder} aria-label={label} spellcheck="false" use:focus onkeydown={keydown} />
  </div>
  <div class="list" role="listbox" aria-label={label}>
    {#each entries as entry, index (entry.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="row {entry.tone ?? ''}"
        class:selected={index === selected}
        role="option"
        tabindex="-1"
        aria-selected={index === selected}
        onmousemove={() => (selected = index)}
        onclick={() => onpick(entry)}
      >
        <span class="icon"
          >{#if entry.icon}<Icon name={entry.icon} size="normal" />{/if}</span
        >
        <span class="name">{entry.name}</span>
        {#if entry.folder}<span class="more"><Icon name="chevron-right" size="small" /></span>{/if}
      </div>
    {:else}
      {#if message}<div class="message" class:error>{message}</div>{/if}
    {/each}
  </div>
</div>

<style>
  .popup {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-control);
    background: var(--panel);
    box-shadow: var(--shadow);
    font-size: var(--font-size-code-small);
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--crumb-popup-gap);
    height: var(--crumb-popup-field-height);
    padding: 0 var(--crumb-popup-field-padding-x);
    border-bottom: 1px solid var(--border-strong);
    color: var(--text-faint);
  }

  .field input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font: inherit;
  }

  .field input::placeholder {
    color: var(--text-faint);
  }

  .list {
    overflow-y: auto;
    padding: var(--crumb-popup-list-padding);
  }

  .row,
  .message {
    display: flex;
    align-items: center;
    gap: var(--crumb-popup-gap);
    height: var(--crumb-popup-row-height);
    padding: 0 var(--crumb-popup-row-padding-x);
    border-radius: var(--radius-small);
    color: var(--text);
  }

  .row {
    cursor: pointer;
  }

  .row.selected {
    background: var(--selected);
  }

  .message {
    color: var(--text-faint);
  }

  .message.error {
    color: var(--danger);
  }

  .icon {
    flex: none;
    display: inline-flex;
    justify-content: center;
    width: var(--crumb-popup-icon-width);
    color: var(--text-dim);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
  }

  .modified .name {
    color: var(--accent);
  }

  .added .name {
    color: var(--success);
  }

  .conflict .name,
  .deleted .name {
    color: var(--danger);
  }

  .ignored .name,
  .ignored .icon {
    color: var(--text-faint);
  }

  .search .name {
    color: var(--text-dim);
  }

  .more {
    flex: none;
    display: inline-flex;
    color: var(--text-faint);
  }
</style>
