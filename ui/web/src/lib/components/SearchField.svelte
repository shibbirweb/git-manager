<!-- A filter box with a magnifier and a clear button, like Settings' search. Esc clears it, then blurs. -->
<script lang="ts">
  import Icon from "./Icon.svelte";

  interface Props {
    value?: string;
    placeholder?: string;
    label: string;
    autofocus?: boolean;
    element?: HTMLInputElement | null;
    oninput?: (value: string) => void;
    onkeydown?: (event: KeyboardEvent) => void;
  }

  let {
    value = $bindable(""),
    placeholder = "Search",
    label,
    autofocus = false,
    element = $bindable(null),
    oninput,
    onkeydown,
  }: Props = $props();

  function clear(): void {
    value = "";
    oninput?.("");
    element?.focus();
  }

  function keydown(event: KeyboardEvent): void {
    onkeydown?.(event);
    if (event.defaultPrevented || event.key !== "Escape") {
      return;
    }
    if (value) {
      event.preventDefault();
      clear();
    } else {
      element?.blur();
    }
  }
</script>

<div class="search">
  <span class="magnifier"><Icon name="search" size={13} /></span>
  <!-- svelte-ignore a11y_autofocus -->
  <input
    bind:this={element}
    bind:value
    {placeholder}
    {autofocus}
    aria-label={label}
    oninput={() => oninput?.(value)}
    onkeydown={keydown}
  />
  {#if value}
    <button class="clear" type="button" aria-label="Clear" title="Clear" onclick={clear}>
      <Icon name="x" size={12} />
    </button>
  {/if}
</div>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: var(--search-field-gap);
    height: var(--search-field-height);
    padding: 0 var(--search-field-padding-right) 0 var(--search-field-padding-left);
    border: 1px solid var(--border-strong);
    border-radius: var(--search-field-radius);
    background: var(--panel);
  }

  .search:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 var(--input-focus-ring) color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .magnifier {
    flex: none;
    display: flex;
    color: var(--text-faint);
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font: inherit;
  }

  .clear {
    flex: none;
    display: flex;
    padding: 2px;
    border: none;
    border-radius: var(--radius-small);
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .clear:hover {
    background: var(--hover);
  }
</style>
