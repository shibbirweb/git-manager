<!-- A filter box with a magnifier and a clear button, like Settings' search. Esc clears it, then blurs. -->
<script lang="ts">
  import { controlWidth, type ControlWidth } from "../logic/presets";
  import Icon from "./Icon.svelte";

  interface Props {
    value?: string;
    placeholder?: string;
    label: string;
    autofocus?: boolean;
    size?: "normal" | "large" | "compact" | "small";
    width?: ControlWidth;
    element?: HTMLInputElement | null;
    oninput?: (value: string) => void;
    onkeydown?: (event: KeyboardEvent) => void;
  }

  let {
    value = $bindable(""),
    placeholder = "Search",
    label,
    autofocus = false,
    size = "normal",
    width = "auto",
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

<div class="search {size}" style:width={width === "auto" ? null : controlWidth(width)}>
  <span class="magnifier"><Icon name="search" size="medium" /></span>
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
      <Icon name="x" size="compact" />
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

  /* A panel's filter (Branches, AI, Scripts): 26 px with a 20 px clear button at the end. */
  .compact {
    gap: var(--search-field-compact-gap);
    height: var(--search-field-compact-height);
    padding-right: var(--search-field-compact-padding-right);
  }

  .compact .magnifier,
  .small .magnifier {
    color: var(--text-dim);
  }

  .compact .clear,
  .small .clear {
    align-items: center;
    justify-content: center;
    width: var(--search-field-clear-size);
    height: var(--search-field-clear-size);
    padding: 0;
  }

  /* The Git Console's filter: a 24 px field of a set width, smaller text. */
  .small {
    width: var(--search-field-small-width);
    max-width: 50%;
    height: var(--search-field-small-height);
    padding-right: var(--search-field-small-padding-right);
    color: var(--text-dim);
  }

  .small input {
    font-size: var(--font-size-small);
  }

  /* The Welcome page's search: taller, on the editor background. */
  .large {
    gap: var(--search-field-large-gap);
    height: var(--search-field-large-height);
    padding: 0 var(--search-field-large-padding-x);
    background: var(--editor-bg);
    color: var(--text-dim);
  }

  .large .magnifier {
    color: var(--text-dim);
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
    padding: var(--space-1);
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
