<!-- The editor's find and replace bar: a chevron that shows Replace, the find field with its toggles, the match
     counter with previous and next, and close. `problem` (such as a bad regex) tints the field red. -->
<script lang="ts">
  import { componentTokens } from "../styles/tokens";
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
    onselectall?: () => void;
    onexclude?: () => void;
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
    onselectall,
    onexclude,
    onclose,
  }: Props = $props();

  // Narrow editors (merge panes, split diffs) drop the least used buttons instead of wrapping.
  let barWidth = $state(0);
  const narrow = $derived(barWidth > 0 && barWidth <= componentTokens.findBar.compactBelow);

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

<div class="find-bar" class:narrow role="search" bind:clientWidth={barWidth}>
  <div class="grid" class:with-chevron={editable}>
    {#if editable}
      <button
        class="icon chevron"
        type="button"
        aria-label="Toggle Replace"
        aria-expanded={showReplace}
        onclick={() => (showReplace = !showReplace)}
      >
        <Icon name={showReplace ? "chevron-down" : "chevron-right"} size="normal" />
      </button>
    {/if}
    <div class="field find" class:problem={problem !== null}>
      <span class="magnifier"><Icon name="search" size="medium" /></span>
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
        <Icon name="arrow-up" size="normal" />
      </button>
      <button class="icon" type="button" aria-label="Next match" disabled={!total} onclick={() => onnext?.()}>
        <Icon name="arrow-down" size="normal" />
      </button>
      {#if onselectall}
        <button
          class="icon select-all"
          type="button"
          aria-label="Select All Occurrences"
          title="Select All Occurrences"
          disabled={!total}
          onclick={() => onselectall()}
        >
          <Icon name="carets" size="normal" />
        </button>
      {/if}
    </div>
    <button class="icon close" type="button" aria-label="Close" onclick={() => onclose?.()}>
      <Icon name="x" size="normal" />
    </button>
    {#if editable && showReplace}
      <div class="field replace">
        <input bind:value={replacement} placeholder="Replace" aria-label="Replace" spellcheck="false" />
      </div>
      <div class="tools replace-tools">
        <button class="text" type="button" disabled={!total} onclick={() => onreplace?.()}>Replace</button>
        <button class="text" type="button" disabled={!total} onclick={() => onreplaceall?.()}>Replace All</button>
        {#if onexclude}
          <button
            class="text exclude"
            type="button"
            title="Exclude: skip this match and go to the next"
            disabled={!total}
            onclick={() => onexclude()}>Exclude</button
          >
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .find-bar {
    align-self: stretch;
    padding: var(--find-bar-padding-y) var(--space-3) var(--find-bar-padding-y) var(--space-2);
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
    gap: var(--find-bar-row-gap) var(--space-3);
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
    gap: var(--space-2);
    min-width: 0;
    height: var(--find-bar-field-height);
    padding: 0 var(--space-1) 0 var(--space-3);
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

  .replace-tools {
    grid-column: 3 / span 2;
    grid-row: 2;
    gap: var(--space-1);
  }

  .counter {
    min-width: var(--find-bar-counter-min-width);
    padding: 0 var(--space-3) 0 var(--space-1);
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
    padding: 0 var(--space-3);
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

  .narrow .select-all,
  .narrow .exclude {
    display: none;
  }
</style>
