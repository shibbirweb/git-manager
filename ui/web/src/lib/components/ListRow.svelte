<!-- A row of a pick or command list: a label with a dim description after it. The highlighted row (keyboard or
     pointer) is filled with the accent color, like quick pick rows. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    label: string;
    description?: string;
    icon?: IconName | null;
    highlighted?: boolean;
    disabled?: boolean;
    onclick?: () => void;
    onhover?: () => void;
    trailing?: Snippet;
  }

  let {
    label,
    description = "",
    icon = null,
    highlighted = false,
    disabled = false,
    onclick,
    onhover,
    trailing,
  }: Props = $props();
</script>

<button
  class="row"
  class:highlighted
  type="button"
  role="option"
  aria-selected={highlighted}
  {disabled}
  onclick={() => onclick?.()}
  onmousemove={() => onhover?.()}
>
  {#if icon}
    <Icon name={icon} size="normal" />
  {/if}
  <span class="label">{label}</span>
  {#if description}
    <span class="description">{description}</span>
  {/if}
  {#if trailing}
    <span class="trailing">{@render trailing()}</span>
  {/if}
</button>

<style>
  .row {
    display: flex;
    align-items: baseline;
    gap: var(--list-row-gap);
    width: 100%;
    min-width: 0;
    padding: var(--list-row-padding-y) var(--list-row-padding-x);
    border: none;
    border-radius: var(--list-row-radius);
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .row > :global(svg) {
    align-self: center;
  }

  .highlighted {
    background: var(--accent);
    color: var(--accent-text);
  }

  .row:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .label,
  .description {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .description {
    color: var(--text-faint);
    font-size: var(--font-size-small);
  }

  .highlighted .description {
    color: inherit;
    opacity: 0.8;
  }

  .trailing {
    flex: none;
    margin-left: auto;
  }
</style>
