<!-- A filterable list to pick one item, like Checkout's branch list or the quick pick: type to filter by words,
     arrows move, Enter picks, Esc cancels. Groups get headings; pinned items always show. -->
<script lang="ts" generics="T extends string">
  import { initialPick, pickRows, stepPick, type PickItem } from "../logic/pickModel";
  import Input from "./Input.svelte";
  import ListRow from "./ListRow.svelte";

  interface Props {
    items: PickItem<T>[];
    label: string;
    placeholder?: string;
    emptyText?: string;
    query?: string;
    onpick: (value: T) => void;
    oncancel?: () => void;
  }

  let {
    items,
    label,
    placeholder = "Type to filter",
    emptyText = "Nothing matches",
    query = $bindable(""),
    onpick,
    oncancel,
  }: Props = $props();

  const rows = $derived(pickRows(items, query));
  let highlighted = $state(-1);

  $effect(() => {
    highlighted = initialPick(rows, query);
  });

  function pick(index: number): void {
    const row = rows[index];
    if (row?.kind === "item" && !row.item.disabled) {
      onpick(row.item.value);
    }
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      highlighted = stepPick(rows, highlighted, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(highlighted);
    } else if (event.key === "Escape") {
      event.preventDefault();
      oncancel?.();
    }
  }
</script>

<div class="pick">
  <Input bind:value={query} {placeholder} aria-label={label} autocomplete="off" spellcheck={false} {onkeydown} />
  <div class="list" role="listbox" aria-label={label}>
    {#each rows as row, index (row.kind === "group" ? `group:${row.label}` : `item:${row.item.value}`)}
      {#if row.kind === "group"}
        <div class="group" role="presentation">{row.label}</div>
      {:else}
        <ListRow
          label={row.item.label}
          description={row.item.description}
          disabled={row.item.disabled}
          highlighted={index === highlighted}
          onhover={() => (highlighted = index)}
          onclick={() => pick(index)}
        />
      {/if}
    {:else}
      <div class="empty">{emptyText}</div>
    {/each}
  </div>
</div>

<style>
  .pick {
    display: flex;
    flex-direction: column;
  }

  .pick > :global(input) {
    width: 100%;
  }

  .list {
    max-height: min(var(--pick-list-max-height), 50vh);
    overflow-y: auto;
    margin-top: var(--space-4);
    padding: var(--space-1) 0;
  }

  .group {
    padding: var(--space-4) var(--space-4) var(--pick-list-group-padding-bottom);
    color: var(--text-faint);
    font-size: var(--font-size-xsmall);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .empty {
    padding: var(--space-5) var(--space-4);
    color: var(--text-dim);
  }
</style>
