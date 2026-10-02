<!--
  The editor find and replace bar (JetBrains style), mounted as a CodeMirror panel by
  findPanel.svelte.ts, which owns the state and the actions.
-->
<script lang="ts">
  import Icon from "$lib/ui/Icon.svelte";
  import SearchToggles from "$lib/ui/SearchToggles.svelte";
  import { type FindBarActions, type FindBarState, type FindField, focusLater } from "./findPanel.svelte";

  let { bar, actions }: { bar: FindBarState; actions: FindBarActions } = $props();

  let findInput = $state<HTMLInputElement | null>(null);
  let replaceInput = $state<HTMLInputElement | null>(null);

  const editable = $derived(!bar.readOnly);
  const showReplace = $derived(bar.replaceOpen && editable);
  const counterText = $derived(bar.notice ?? bar.counter.text);
  const problem = $derived(bar.notice === null && bar.counter.problem);
  const searchable = $derived(bar.search !== "" && bar.error === null);

  export function focus(field: FindField, select: boolean): void {
    focusLater(() => (field === "replace" ? replaceInput : findInput), select);
  }

  /** Buttons never take the focus from the fields. */
  function keepFocus(event: MouseEvent): void {
    event.preventDefault();
  }
</script>

<div class="find-bar" role="search" aria-label="Find in file">
  <div class="grid" class:with-chevron={editable}>
    {#if editable}
      <button
        type="button"
        class="icon chevron"
        title={showReplace ? "Hide Replace Field" : "Show Replace Field"}
        aria-label={showReplace ? "Hide Replace Field" : "Show Replace Field"}
        aria-expanded={showReplace}
        onmousedown={keepFocus}
        onclick={() => actions.toggleReplace()}
      >
        <Icon name={showReplace ? "chevron-down" : "chevron-right"} size={14} />
      </button>
    {/if}

    <div class="field find" class:problem title={bar.error ?? undefined}>
      <span class="magnifier"><Icon name="search" size={13} /></span>
      <input
        bind:this={findInput}
        value={bar.search}
        type="text"
        placeholder="Find"
        aria-label="Find"
        aria-invalid={problem}
        spellcheck="false"
        autocomplete="off"
        oninput={(event) => actions.setSearch(event.currentTarget.value)}
        onkeydown={(event) => actions.keydown(event, "find")}
      />
      <SearchToggles options={bar.options} onToggle={(option) => actions.toggle(option)} compact />
    </div>

    <div class="tools">
      <span class="counter" class:problem aria-live="polite">{counterText}</span>
      <button
        type="button"
        class="icon"
        title="Previous Occurrence (Shift+Enter)"
        aria-label="Previous Occurrence"
        disabled={!searchable}
        onmousedown={keepFocus}
        onclick={() => actions.previous()}
      >
        <Icon name="arrow-up" size={14} />
      </button>
      <button
        type="button"
        class="icon"
        title="Next Occurrence (Enter)"
        aria-label="Next Occurrence"
        disabled={!searchable}
        onmousedown={keepFocus}
        onclick={() => actions.next()}
      >
        <Icon name="arrow-down" size={14} />
      </button>
      <button
        type="button"
        class="icon select-all"
        title="Select All Occurrences (Ctrl+Cmd+G)"
        aria-label="Select All Occurrences"
        disabled={!searchable}
        onmousedown={keepFocus}
        onclick={() => actions.selectAll()}
      >
        <Icon name="carets" size={14} />
      </button>
    </div>

    <button
      type="button"
      class="icon close"
      title="Close (Esc)"
      aria-label="Close"
      onmousedown={keepFocus}
      onclick={() => actions.close()}
    >
      <Icon name="x" size={14} />
    </button>

    {#if showReplace}
      <div class="field replace">
        <input
          bind:this={replaceInput}
          value={bar.replace}
          type="text"
          placeholder="Replace"
          aria-label="Replace"
          spellcheck="false"
          autocomplete="off"
          oninput={(event) => actions.setReplace(event.currentTarget.value)}
          onkeydown={(event) => actions.keydown(event, "replace")}
        />
      </div>
      <div class="replace-actions">
        <button
          type="button"
          class="text"
          title="Replace (Enter)"
          disabled={!searchable}
          onmousedown={keepFocus}
          onclick={() => actions.replaceOne()}>Replace</button
        >
        <button
          type="button"
          class="text"
          title="Replace All (Shift+Cmd+Enter)"
          disabled={!searchable}
          onmousedown={keepFocus}
          onclick={() => actions.replaceAll()}>Replace All</button
        >
        <button
          type="button"
          class="text exclude"
          title="Exclude: skip this match and go to the next"
          disabled={!searchable}
          onmousedown={keepFocus}
          onclick={() => actions.exclude()}>Exclude</button
        >
      </div>
    {/if}
  </div>
</div>

<style>
  .find-bar {
    container-type: inline-size;
    padding: 3px 6px 3px 4px;
    background: var(--panel);
    border-bottom: 1px solid var(--border-strong);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 12px;
    line-height: normal;
  }

  /*
   * chevron | field | counter and arrows (or the Replace buttons) | close. The field grows to
   * 360px when there is room and is the first to shrink; the buttons keep their size.
   */
  .grid {
    display: grid;
    grid-template-columns: 24px minmax(90px, 360px) 1fr auto;
    align-items: center;
    gap: 3px 6px;
  }

  /* Read-only editors have no Replace row, so no chevron. */
  .grid:not(.with-chevron) {
    grid-template-columns: 0 minmax(90px, 360px) 1fr auto;
  }

  .chevron {
    grid-column: 1;
    grid-row: 1;
  }

  .field {
    grid-column: 2;
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    height: 24px;
    padding: 0 2px 0 6px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--editor-bg);
  }

  .field.find {
    grid-row: 1;
  }

  .field.replace {
    grid-row: 2;
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
    grid-row: 1;
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

  .icon:disabled,
  .text:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .close {
    grid-column: 4;
    grid-row: 1;
  }

  .replace-actions {
    grid-column: 3 / span 2;
    grid-row: 2;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .text {
    flex: none;
    height: 24px;
    padding: 0 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text);
    font: inherit;
    white-space: nowrap;
    cursor: pointer;
  }

  .text:hover:not(:disabled) {
    background: var(--hover);
  }

  /* Narrow editors (merge panes, split diffs) drop the least used buttons instead of wrapping. */
  @container (max-width: 480px) {
    .select-all,
    .exclude {
      display: none;
    }
  }

  @container (max-width: 380px) {
    .counter {
      min-width: 0;
    }
  }

  @container (max-width: 300px) {
    .counter {
      display: none;
    }

    .grid.with-chevron {
      grid-template-columns: 24px minmax(60px, 360px) 1fr auto;
    }

    .text {
      padding: 0 5px;
    }
  }
</style>
