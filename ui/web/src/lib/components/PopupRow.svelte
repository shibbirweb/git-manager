<!-- A row of a picker popup, like the branches popup: an action (an icon and its words) or an item in a grid of an
     icon, a name (bold when current), a dim hint and a chevron. The highlighted row takes the selection color. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    label: string;
    variant?: "action" | "item";
    icon?: IconName | null;
    hint?: string;
    current?: boolean;
    chevron?: boolean;
    highlighted?: boolean;
    disabled?: boolean;
    onclick?: () => void;
    onhover?: () => void;
  }

  let {
    label,
    variant = "item",
    icon = null,
    hint = "",
    current = false,
    chevron = false,
    highlighted = false,
    disabled = false,
    onclick,
    onhover,
  }: Props = $props();
</script>

<button
  class="row {variant}"
  class:highlighted
  type="button"
  role="option"
  aria-selected={highlighted}
  {disabled}
  onclick={() => onclick?.()}
  onmousemove={() => onhover?.()}
>
  <span class="icon">{#if icon}<Icon name={icon} size="normal" />{/if}</span>
  <span class="name" class:current>{label}</span>
  {#if variant === "item"}
    <span class="hint">{hint}</span>
    <span class="chevron">{#if chevron}<Icon name="chevron-right" size="compact" />{/if}</span>
  {/if}
</button>

<style>
  .row {
    width: 100%;
    gap: var(--popup-row-gap);
    padding: var(--popup-row-padding-y) var(--popup-row-padding-x);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .action {
    display: flex;
    align-items: center;
  }

  .action:hover:not(:disabled) {
    background: var(--hover);
  }

  .action:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .action .icon:empty {
    display: none;
  }

  .item {
    display: grid;
    grid-template-columns:
      var(--popup-row-icon-column) minmax(0, 1fr) minmax(0, auto)
      var(--popup-row-chevron-column);
    align-items: center;
  }

  .highlighted {
    background: var(--selected);
  }

  .icon,
  .chevron {
    display: inline-flex;
  }

  .name,
  .hint {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .current {
    font-weight: var(--font-weight-semibold);
  }

  .hint {
    max-width: var(--popup-row-hint-max-width);
    color: var(--text-faint);
    font-size: var(--font-size-small);
  }
</style>
