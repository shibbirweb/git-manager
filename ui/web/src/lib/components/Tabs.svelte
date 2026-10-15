<!-- Panel tabs in small capitals with an accent underline, like the bottom panel's Terminal / Run / Git Console.
     Arrow keys move between them. -->
<script lang="ts" generics="T extends string">
  import { isRovingKey, nextIndex } from "../logic/roving";

  interface PanelTab<V extends string> {
    value: V;
    label: string;
    title?: string;
  }

  interface Props {
    tabs: PanelTab<T>[];
    value: T;
    label: string;
    variant?: "panel" | "underline";
    /** Pressing a tab leaves the focus where it was (tabs over a search field); the tabs take no focus. */
    keepFocus?: boolean;
    onchange?: (value: T) => void;
  }

  let { tabs, value = $bindable(), label, variant = "panel", keepFocus = false, onchange }: Props = $props();
  let buttons: HTMLButtonElement[] = $state([]);

  function choose(next: T): void {
    if (next !== value) {
      value = next;
      onchange?.(next);
    }
  }

  function onkeydown(event: KeyboardEvent): void {
    if (!isRovingKey(event.key)) {
      return;
    }
    event.preventDefault();
    const index = nextIndex(
      Math.max(
        0,
        tabs.findIndex((tab) => tab.value === value),
      ),
      tabs.length,
      event.key,
    );
    if (index >= 0) {
      choose(tabs[index].value);
      if (!keepFocus) {
        buttons[index]?.focus();
      }
    }
  }
</script>

<div class="tabs {variant}" role="tablist" aria-label={label} tabindex="-1" {onkeydown}>
  {#each tabs as tab, index (tab.value)}
    <button
      bind:this={buttons[index]}
      class="tab"
      class:selected={tab.value === value}
      type="button"
      role="tab"
      aria-selected={tab.value === value}
      title={tab.title}
      tabindex={tab.value === value && !keepFocus ? 0 : -1}
      onmousedown={(event) => keepFocus && event.preventDefault()}
      onclick={() => choose(tab.value)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .tabs {
    flex: none;
    display: flex;
    align-items: stretch;
    gap: var(--panel-tabs-gap);
    height: var(--panel-tabs-height);
  }

  .tab {
    position: relative;
    padding: 0;
    border: none;
    background: transparent;
    font: inherit;
    font-size: var(--font-size-xsmall);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    cursor: pointer;
  }

  .tab:hover,
  .selected {
    color: var(--text);
  }

  .selected::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--panel-tabs-indicator);
    border-radius: var(--radius-tiny);
    background: var(--accent);
  }

  /* Search Everywhere's scopes: normal case, a thick accent line under the chosen one. */
  .underline {
    gap: var(--tabs-underline-gap);
    height: auto;
  }

  .underline .tab {
    padding: var(--tabs-underline-padding-top) var(--tabs-underline-padding-x) var(--tabs-underline-padding-bottom);
    border-bottom: var(--tabs-underline-indicator) solid transparent;
    font-size: var(--font-size-code-small);
    font-weight: var(--font-weight-regular);
    text-transform: none;
    letter-spacing: normal;
    white-space: nowrap;
  }

  .underline .selected {
    font-weight: var(--font-weight-semibold);
    border-bottom-color: var(--accent);
  }

  .underline .selected::after {
    display: none;
  }

  .tab:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: var(--space-1);
  }
</style>
