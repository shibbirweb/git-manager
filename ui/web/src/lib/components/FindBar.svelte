<!-- The editor's find and replace bar: a chevron that shows Replace, the find field with its toggles, the match
     counter with previous and next, and close. `problem` (such as a bad regex) tints the field red. Buttons never
     take the focus from the fields; callers with their own keys pass `onkeydown`. -->
<script lang="ts">
  import { tick } from "svelte";
  import { FIND_BAR_TITLES, findCounter, findKey, type FindBarProps as Props, type FindField } from "../logic/findBar";
  import { componentTokens } from "../styles/tokens";
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";
  import SearchToggles from "./SearchToggles.svelte";

  let {
    query = $bindable(""),
    replacement = $bindable(""),
    options = $bindable({ matchCase: false, wholeWords: false, regex: false }),
    showReplace = $bindable(false),
    editable = true,
    current = 0,
    total = 0,
    counter = null,
    active = null,
    problem = null,
    label = "Find in file",
    titles = {},
    toggleTitles = {},
    onsearch,
    onreplaceinput,
    ontogglereplace,
    onkeydown,
    onnext,
    onprevious,
    onreplace,
    onreplaceall,
    onselectall,
    onexclude,
    onclose,
  }: Props = $props();

  // Narrow editors (merge panes, split diffs) drop the least used buttons instead of wrapping, then let the counter
  // shrink, then hide it, like the app's find bar.
  let barWidth = $state(0);
  const within = (limit: number) => barWidth > 0 && barWidth <= limit;
  const narrow = $derived(within(componentTokens.findBar.compactBelow));
  const shrink = $derived(within(componentTokens.findBar.shrinkBelow));
  const tiny = $derived(within(componentTokens.findBar.tinyBelow));
  let findInput = $state<HTMLInputElement | null>(null);
  let replaceInput = $state<HTMLInputElement | null>(null);
  const tip = $derived({ ...FIND_BAR_TITLES, ...titles });
  const shownCounter = $derived(counter ?? problem ?? findCounter(query, current, total));
  const enabled = $derived(active ?? total > 0);
  const replaceOpen = $derived(editable && showReplace);

  /** Puts the focus in a field once it is drawn, its text selected when `select`. */
  export function focus(field: FindField, select: boolean): void {
    void tick().then(() => {
      const input = field === "replace" ? replaceInput : findInput;
      input?.focus();
      if (select) {
        input?.select();
      }
    });
  }

  function keydown(event: KeyboardEvent, field: FindField): void {
    const action = onkeydown ? null : findKey(event);
    onkeydown?.(event, field);
    if (action) {
      event.preventDefault();
      ({ next: onnext, previous: onprevious, close: onclose })[action]?.();
    }
  }

  function toggleReplace(): void {
    showReplace = !showReplace;
    ontogglereplace?.(showReplace);
  }
</script>

{#snippet tool(kind: string, title: string, run: () => void, disabled: boolean, name: string, icon?: IconName)}
  <button
    class={kind}
    class:text={!icon}
    type="button"
    aria-label={name}
    {title}
    {disabled}
    onmousedown={(event) => event.preventDefault()}
    onclick={run}
  >
    {#if icon}
      <Icon name={icon} size="normal" />
    {:else}
      {name}
    {/if}
  </button>
{/snippet}

<div class="find-bar" class:narrow class:shrink class:tiny role="search" aria-label={label} bind:clientWidth={barWidth}>
  <div class="grid" class:with-chevron={editable}>
    {#if editable}
      {@const name = replaceOpen ? "Hide Replace Field" : "Show Replace Field"}
      {@const icon = replaceOpen ? "chevron-down" : "chevron-right"}
      {@render tool("", replaceOpen ? name : tip.showReplace, toggleReplace, false, name, icon)}
    {/if}
    <div class="field find" class:problem={problem !== null} title={problem ?? undefined}>
      <span class="magnifier"><Icon name="search" size="medium" /></span>
      <input
        bind:this={findInput}
        bind:value={query}
        placeholder="Find"
        aria-label="Find"
        aria-invalid={problem !== null}
        spellcheck="false"
        autocomplete="off"
        oninput={() => onsearch?.(query, options)}
        onkeydown={(event) => keydown(event, "find")}
      />
      <SearchToggles bind:options compact titles={toggleTitles} onchange={(next) => onsearch?.(query, next)} />
    </div>
    <div class="tools">
      <span class="counter" class:problem={problem !== null} aria-live="polite">{shownCounter}</span>
      {@render tool("", tip.previous, () => onprevious?.(), !enabled, "Previous Occurrence", "arrow-up")}
      {@render tool("", tip.next, () => onnext?.(), !enabled, "Next Occurrence", "arrow-down")}
      {#if onselectall}
        {@render tool("select-all", tip.selectAll, onselectall, !enabled, "Select All Occurrences", "carets")}
      {/if}
    </div>
    {@render tool("close", tip.close, () => onclose?.(), false, "Close", "x")}
    {#if replaceOpen}
      <div class="field replace">
        <input
          bind:this={replaceInput}
          bind:value={replacement}
          placeholder="Replace"
          aria-label="Replace"
          spellcheck="false"
          autocomplete="off"
          oninput={() => onreplaceinput?.(replacement)}
          onkeydown={(event) => keydown(event, "replace")}
        />
      </div>
      <div class="tools replace-tools">
        {@render tool("", tip.replace, () => onreplace?.(), !enabled, "Replace")}
        {@render tool("", tip.replaceAll, () => onreplaceall?.(), !enabled, "Replace All")}
        {#if onexclude}
          {@render tool("exclude", tip.exclude, onexclude, !enabled, "Exclude")}
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
    --first: 0;
    --field-min: var(--find-bar-field-min-width);
    grid-template-columns: var(--first) minmax(var(--field-min), var(--find-bar-field-max-width)) 1fr auto;
    align-items: center;
    gap: var(--find-bar-row-gap) var(--space-3);
  }

  .with-chevron {
    --first: var(--find-bar-button-size);
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

  button {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--find-bar-button-size);
    height: var(--find-bar-button-size);
    padding: 0;
    border: none;
    border-radius: var(--find-bar-radius);
    background: transparent;
    color: var(--text-dim);
    font: inherit;
    cursor: pointer;
  }

  .text {
    padding: 0 var(--space-3);
  }

  button:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .close {
    grid-column: 4;
    grid-row: 1;
  }

  .narrow .select-all,
  .narrow .exclude {
    display: none;
  }

  .shrink .counter {
    min-width: 0;
  }

  .tiny .counter {
    display: none;
  }

  .tiny .grid {
    --field-min: var(--find-bar-tiny-field-min-width);
  }

  .tiny .text {
    padding: 0 var(--find-bar-tiny-text-padding-x);
  }
</style>
