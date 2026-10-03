<!--
  Find in the terminal, a small bar over its top right corner like VS Code's: the query with Match Case, Words and
  Regex, the match count, previous and next. TerminalView owns the search; this only shows it.
-->
<script lang="ts">
  import Icon from "$lib/ui/Icon.svelte";
  import SearchToggles from "$lib/ui/SearchToggles.svelte";
  import { findBarKey, type TerminalFindOptions } from "./find";

  interface Props {
    query: string;
    options: TerminalFindOptions;
    counter: string;
    /** The counter shows a problem (an invalid regex or no results). */
    problem: boolean;
    onQuery: (query: string) => void;
    onToggle: (option: keyof TerminalFindOptions) => void;
    onPrevious: () => void;
    onNext: () => void;
    onClose: () => void;
  }

  let { query, options, counter, problem, onQuery, onToggle, onPrevious, onNext, onClose }: Props = $props();

  let input = $state<HTMLInputElement | null>(null);

  const searchable = $derived(query !== "");

  export function focus(): void {
    requestAnimationFrame(() => {
      input?.focus();
      input?.select();
    });
  }

  function onKeydown(event: KeyboardEvent): void {
    const action = findBarKey(event);
    if (!action) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (action === "close") {
      onClose();
    } else if (action === "previous") {
      onPrevious();
    } else if (action === "next") {
      onNext();
    } else if (action === "toggleCase") {
      onToggle("matchCase");
    } else if (action === "toggleWords") {
      onToggle("wholeWords");
    } else {
      onToggle("regex");
    }
  }

  /** Buttons never take the focus from the field. */
  function keepFocus(event: MouseEvent): void {
    event.preventDefault();
  }
</script>

<div class="find-bar" role="search" aria-label="Find in terminal">
  <div class="field" class:problem>
    <span class="magnifier"><Icon name="search" size={13} /></span>
    <input
      bind:this={input}
      value={query}
      type="text"
      placeholder="Find"
      aria-label="Find in terminal"
      aria-invalid={problem}
      spellcheck="false"
      autocomplete="off"
      oninput={(event) => onQuery(event.currentTarget.value)}
      onkeydown={onKeydown}
    />
    <SearchToggles {options} {onToggle} compact />
  </div>
  <span class="counter" class:problem aria-live="polite">{counter}</span>
  <button
    type="button"
    class="icon"
    title="Previous Match (Enter)"
    aria-label="Previous Match"
    disabled={!searchable}
    onmousedown={keepFocus}
    onclick={onPrevious}
  >
    <Icon name="arrow-up" size={14} />
  </button>
  <button
    type="button"
    class="icon"
    title="Next Match (Shift+Enter)"
    aria-label="Next Match"
    disabled={!searchable}
    onmousedown={keepFocus}
    onclick={onNext}
  >
    <Icon name="arrow-down" size={14} />
  </button>
  <button type="button" class="icon" title="Close (Esc)" aria-label="Close" onmousedown={keepFocus} onclick={onClose}>
    <Icon name="x" size={14} />
  </button>
</div>

<style>
  .find-bar {
    position: absolute;
    top: 4px;
    right: 14px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 2px;
    max-width: calc(100% - 28px);
    padding: 3px 4px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--panel);
    box-shadow: var(--shadow);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 12px;
    line-height: normal;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 280px;
    min-width: 0;
    flex: 0 1 auto;
    height: 24px;
    padding: 0 2px 0 6px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
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

  .counter {
    min-width: 64px;
    padding: 0 6px;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .counter.problem {
    color: var(--danger);
  }

  .icon {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .icon:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  .icon:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
