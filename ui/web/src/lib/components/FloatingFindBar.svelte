<!-- A find bar floating over the top right of a view that is not an editor, like the terminal's: the field with its
     toggles, the match counter, previous, next and close. `problem` (no match, a bad regex) tints it red. -->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import SearchToggles, { type SearchOptions } from "./SearchToggles.svelte";

  interface Props {
    query?: string;
    options?: SearchOptions;
    counter?: string;
    problem?: boolean;
    label?: string;
    element?: HTMLInputElement | null;
    onsearch?: (query: string, options: SearchOptions) => void;
    onnext?: () => void;
    onprevious?: () => void;
    onclose?: () => void;
  }

  let {
    query = $bindable(""),
    options = $bindable({ matchCase: false, wholeWords: false, regex: false }),
    counter = "",
    problem = false,
    label = "Find",
    element = $bindable(null),
    onsearch,
    onnext,
    onprevious,
    onclose,
  }: Props = $props();

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

<div class="find-bar" role="search" aria-label={label}>
  <div class="field" class:problem>
    <span class="magnifier"><Icon name="search" size="medium" /></span>
    <input
      bind:this={element}
      bind:value={query}
      placeholder="Find"
      aria-label={label}
      aria-invalid={problem}
      spellcheck="false"
      autocomplete="off"
      oninput={() => onsearch?.(query, options)}
      onkeydown={keydown}
    />
    <SearchToggles bind:options compact onchange={(next) => onsearch?.(query, next)} />
  </div>
  <span class="counter" class:problem aria-live="polite">{counter}</span>
  <button class="icon" type="button" aria-label="Previous Match" disabled={!query} onclick={() => onprevious?.()}>
    <Icon name="arrow-up" size="normal" />
  </button>
  <button class="icon" type="button" aria-label="Next Match" disabled={!query} onclick={() => onnext?.()}>
    <Icon name="arrow-down" size="normal" />
  </button>
  <button class="icon" type="button" aria-label="Close" onclick={() => onclose?.()}>
    <Icon name="x" size="normal" />
  </button>
</div>

<style>
  .find-bar {
    position: absolute;
    top: var(--floating-find-bar-top);
    right: var(--floating-find-bar-right);
    z-index: 2;
    display: flex;
    align-items: center;
    gap: var(--floating-find-bar-gap);
    max-width: calc(100% - 2 * var(--floating-find-bar-right));
    padding: var(--floating-find-bar-padding-y) var(--floating-find-bar-padding-x);
    border: 1px solid var(--border-strong);
    border-radius: var(--floating-find-bar-radius);
    background: var(--panel);
    box-shadow: var(--shadow);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: var(--font-size-small);
    line-height: normal;
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--floating-find-bar-field-gap);
    flex: 0 1 auto;
    width: var(--floating-find-bar-field-width);
    min-width: 0;
    height: var(--floating-find-bar-field-height);
    padding: 0 var(--floating-find-bar-field-padding-right) 0 var(--floating-find-bar-field-padding-left);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-small);
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
    min-width: var(--floating-find-bar-counter-min-width);
    padding: 0 var(--space-3);
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
    width: var(--floating-find-bar-button-size);
    height: var(--floating-find-bar-button-size);
    padding: 0;
    border: none;
    border-radius: var(--radius-small);
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
