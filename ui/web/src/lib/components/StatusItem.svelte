<!-- One status bar item: an icon and short text, a button when it does something. `open` keeps it highlighted
     while its popover shows. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    text?: string;
    icon?: IconName | null;
    label?: string;
    title?: string;
    tone?: "default" | "accent" | "warning" | "danger";
    open?: boolean;
    onclick?: (event: MouseEvent) => void;
  }

  let { text = "", icon = null, label, title, tone = "default", open = false, onclick }: Props = $props();
</script>

{#if onclick}
  <button
    class="item {tone}"
    class:open
    class:icon-only={!text}
    type="button"
    aria-label={label ?? (text || title)}
    {title}
    {onclick}
  >
    {#if icon}<Icon name={icon} size={13} />{/if}
    {#if text}<span>{text}</span>{/if}
  </button>
{:else}
  <span class="item {tone}" class:icon-only={!text} {title} aria-label={label}>
    {#if icon}<Icon name={icon} size={13} />{/if}
    {#if text}<span>{text}</span>{/if}
  </span>
{/if}

<style>
  .item {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: var(--status-bar-item-gap);
    height: var(--status-bar-item-height);
    padding: 0 var(--status-bar-item-padding-x);
    border: none;
    border-radius: var(--radius-small);
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--font-size-small);
    white-space: nowrap;
  }

  button.item {
    cursor: pointer;
  }

  button.item:hover:not(:disabled),
  .open {
    background: var(--hover);
    color: var(--text);
  }

  .icon-only {
    padding: 0 5px;
  }

  .accent {
    color: var(--accent);
    font-weight: var(--font-weight-semibold);
  }

  .warning {
    color: var(--warning);
  }

  .danger {
    color: var(--danger);
  }
</style>
