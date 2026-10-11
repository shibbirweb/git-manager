<!-- The editor's find and replace bar: a chevron that shows Replace, the find field with its toggles, the match
     counter with previous and next, and close. `problem` (such as a bad regex) tints the field red. -->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import SearchToggles, { type SearchOptions } from "./SearchToggles.svelte";

  interface Props {
    query?: string;
    replacement?: string;
    options?: SearchOptions;
    showReplace?: boolean;
    editable?: boolean;
    current?: number;
    total?: number;
    problem?: string | null;
    onsearch?: (query: string, options: SearchOptions) => void;
    onnext?: () => void;
    onprevious?: () => void;
    onreplace?: () => void;
    onreplaceall?: () => void;
    onclose?: () => void;
  }

  let {
    query = $bindable(""),
    replacement = $bindable(""),
    options = $bindable({ matchCase: false, wholeWords: false, regex: false }),
    showReplace = $bindable(false),
    editable = true,
    current = 0,
    total = 0,
    problem = null,
    onsearch,
    onnext,
    onprevious,
    onreplace,
    onreplaceall,
    onclose,
  }: Props = $props();

  const counter = $derived(problem ?? (query ? (total ? `${current} of ${total}` : "No results") : ""));

  function keydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      (event.shiftKey ? onprevious : onnext)?.();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onclose?.();
    }
  }
</script>

<div class="find-bar" role="search">
  <div class="grid" class:with-chevron={editable}>
    {#if editable}
      <button
        class="icon chevron"
        type="button"
        aria-label="Toggle Replace"
        aria-expanded={showReplace}
        onclick={() => (showReplace = !showReplace)}
      >
        <Icon name={showReplace ? "chevron-down" : "chevron-right"} size={14} />
      </button>
    {/if}
    <div class="field find" class:problem={problem !== null}>
      <span class="magnifier"><Icon name="search" size={13} /></span>
      <input
        bind:value={query}
        placeholder="Find"
        aria-label="Find"
        spellcheck="false"
        oninput={() => onsearch?.(query, options)}
        onkeydown={keydown}
      />
      <SearchToggles bind:options compact onchange={(next) => onsearch?.(query, next)} />
    </div>
    <div class="tools">
      <span class="counter" class:problem={problem !== null}>{counter}</span>
      <button class="icon" type="button" aria-label="Previous match" disabled={!total} onclick={() => onprevious?.()}>
        <Icon name="arrow-up" size={14} />
      </button>
      <button class="icon" type="button" aria-label="Next match" disabled={!total} onclick={() => onnext?.()}>
        <Icon name="arrow-down" size={14} />
      </button>
    </div>
    <button class="icon close" type="button" aria-label="Close" onclick={() => onclose?.()}>
      <Icon name="x" size={14} />
    </button>
    {#if editable && showReplace}
      <div class="field replace">
        <input bind:value={replacement} placeholder="Replace" aria-label="Replace" spellcheck="false" />
      </div>
      <div class="tools replace-tools">
        <button class="text" type="button" disabled={!total} onclick={() => onreplace?.()}>Replace</button>
        <button class="text" type="button" disabled={!total} onclick={() => onreplaceall?.()}>Replace All</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .find-bar {
    align-self: stretch;
    padding: 3px 6px 3px 4px;
    background: var(--panel);
    border-bottom: 1px solid var(--border-strong);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: var(--font-size-small);
  }

  .grid {
    display: grid;
    grid-template-columns: 0 minmax(var(--find-bar-field-min-width), var(--find-bar-field-max-width)) 1fr auto;
    align-items: center;
    gap: 3px 6px;
  }

  .with-chevron {
    grid-template-columns:
      var(--find-bar-button-size) minmax(var(--find-bar-field-min-width), var(--find-bar-field-max-width))
      1fr auto;
  }

  .field {
    grid-column: 2;
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    height: var(--find-bar-field-height);
    padding: 0 2px 0 6px;
    border: 1px solid var(--border-strong);
    border-radius: var(--find-bar-radius);
    background: var(--editor-bg);
  }

  .field:focus-within {
    border-color: var(--accent);
  }

  .field.problem {
    background: color-mix(in srgb, var(--danger) 13%, var(--editor-bg));
    border-color: color-mix(in srgb, var(--danger) 55%, var(--border-strong));
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

  input::placeholder {
    color: var(--text-faint);
  }

  .tools {
    grid-column: 3;
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .counter {
    min-width: 56px;
    padding: 0 6px 0 2px;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .counter.problem {
    color: var(--danger);
  }

  .icon,
  .text {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: var(--find-bar-button-size);
    padding: 0;
    border: none;
    border-radius: var(--find-bar-radius);
    background: transparent;
    color: var(--text-dim);
    font: inherit;
    cursor: pointer;
  }

  .icon {
    width: var(--find-bar-button-size);
  }

  .text {
    padding: 0 6px;
  }

  .icon:hover:not(:disabled),
  .text:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  .icon:disabled,
  .text:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .chevron {
    grid-column: 1;
  }

  .close {
    grid-column: 4;
    grid-row: 1;
  }
</style>
