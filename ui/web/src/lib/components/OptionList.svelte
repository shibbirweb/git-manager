<!-- A bordered, scrolling list to pick one option from, in groups, like Settings' color themes: a group's label in
     small capitals, then its options (drawn in `option`, such as a ThemeSwatch and a name). Arrow keys, Home, End
     and the page keys move. -->
<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import { optionMove } from "../logic/optionMove";

  interface OptionGroup<V> {
    label: string;
    options: V[];
  }

  interface Props {
    groups: OptionGroup<T>[];
    optionKey: (option: T) => string;
    value?: string | null;
    label: string;
    option: Snippet<[T]>;
    onpick?: (option: T) => void;
  }

  let { groups, optionKey, value = $bindable(null), label, option, onpick }: Props = $props();

  const uid = $props.id();
  const flat = $derived(groups.flatMap((group) => group.options));
  let listEl = $state<HTMLDivElement | null>(null);

  function optionId(key: string): string {
    return `${uid}-${key}`;
  }

  function pick(entry: T): void {
    value = optionKey(entry);
    onpick?.(entry);
  }

  function keydown(event: KeyboardEvent): void {
    const at = flat.findIndex((entry) => optionKey(entry) === value);
    const next = optionMove(at, event.key, flat.length);
    if (next === null) {
      return;
    }
    event.preventDefault();
    pick(flat[next]);
  }

  // The picked option stays in view: at the start (a theme far down the list) and after the keys move it.
  $effect(() => {
    if (listEl && value !== null) {
      document.getElementById(optionId(value))?.scrollIntoView({ block: "nearest" });
    }
  });
</script>

<div
  bind:this={listEl}
  class="list"
  role="listbox"
  aria-label={label}
  aria-activedescendant={value === null ? undefined : optionId(value)}
  tabindex="0"
  onkeydown={keydown}
>
  {#each groups as group (group.label)}
    <div class="group-label" role="presentation">{group.label}</div>
    {#each group.options as entry (optionKey(entry))}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        id={optionId(optionKey(entry))}
        class="option"
        class:selected={optionKey(entry) === value}
        role="option"
        tabindex="-1"
        aria-selected={optionKey(entry) === value}
        onclick={() => pick(entry)}
      >
        {@render option(entry)}
      </div>
    {/each}
  {/each}
</div>

<style>
  .list {
    height: var(--option-list-height);
    overflow-y: auto;
    padding: var(--option-list-padding);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-control);
    background: var(--panel);
    outline: none;
  }

  .list:focus-visible {
    border-color: var(--accent);
    box-shadow: 0 0 0 var(--input-focus-ring) color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .group-label {
    padding: var(--option-list-group-padding-top) var(--option-list-group-padding-x)
      var(--option-list-group-padding-bottom);
    color: var(--text-dim);
    font-size: var(--font-size-xsmall);
    font-weight: var(--font-weight-semibold);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .option {
    display: flex;
    align-items: center;
    gap: var(--option-list-option-gap);
    padding: var(--option-list-option-padding-y) var(--option-list-option-padding-x);
    border-radius: var(--radius-segment);
    cursor: pointer;
  }

  .option:hover {
    background: var(--hover);
  }

  .option.selected {
    background: var(--selected-inactive);
  }

  .list:focus .option.selected {
    background: var(--selected);
  }
</style>
