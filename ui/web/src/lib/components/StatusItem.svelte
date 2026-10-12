<!-- One status bar item: an icon and short text, a button when it does something. `open` keeps it highlighted
     while its popover shows. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    text?: string;
    icon?: IconName | null;
    label?: string;
    title?: string;
    tone?: "default" | "accent" | "warning" | "danger";
    open?: boolean;
    spin?: boolean;
    /** Quiet: smaller dim words, like Keep Awake; `active` brightens them. */
    variant?: "default" | "quiet";
    active?: boolean;
    disabled?: boolean;
    limit?: "none" | "branch" | "operation";
    onclick?: (event: MouseEvent) => void;
    leading?: Snippet;
    trailing?: Snippet;
  }

  let {
    text = "",
    icon = null,
    label,
    title,
    tone = "default",
    open = false,
    spin = false,
    variant = "default",
    active = false,
    disabled = false,
    limit = "none",
    onclick,
    leading,
    trailing,
  }: Props = $props();

  const iconOnly = $derived(!text && !leading && !trailing);
  const iconSize = $derived(variant === "quiet" ? "compact" : "medium");
</script>

{#if onclick}
  <button
    class="item {tone} {variant}"
    class:open
    class:active
    class:icon-only={iconOnly}
    type="button"
    {disabled}
    aria-label={label ?? (text || title)}
    {title}
    {onclick}
  >
    {@render leading?.()}
    {#if icon}<span class="icon" class:spin><Icon name={icon} size={iconSize} /></span>{/if}
    {#if text}<span class="text {limit}">{text}</span>{/if}
    {@render trailing?.()}
  </button>
{:else}
  <span class="item {tone} {variant}" class:active class:icon-only={iconOnly} {title} aria-label={label}>
    {@render leading?.()}
    {#if icon}<span class="icon" class:spin><Icon name={icon} size={iconSize} /></span>{/if}
    {#if text}<span class="text {limit}">{text}</span>{/if}
    {@render trailing?.()}
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

  /* While work runs the item waits; a turning icon stays bright. */
  button.item:disabled {
    cursor: default;
  }

  button.item:disabled:not(:has(.spin)) {
    opacity: 0.6;
  }

  button.item:hover:not(:disabled),
  .open {
    background: var(--hover);
    color: var(--text);
  }

  .icon-only {
    padding: 0 var(--status-bar-icon-only-padding-x);
  }

  .icon {
    display: inline-flex;
  }

  /* Work in progress, such as a fetch: the icon turns. */
  .spin {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .text.branch,
  .text.operation {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .text.branch {
    max-width: var(--status-bar-branch-max-width);
  }

  .text.operation {
    max-width: var(--status-bar-operation-max-width);
  }

  /* Smaller dim words that brighten when on, like Keep Awake. */
  .quiet {
    gap: var(--status-bar-quiet-gap);
    padding: 0 var(--status-bar-quiet-padding-x);
    color: var(--text-dim);
    font-size: var(--font-size-xsmall);
    font-weight: var(--font-weight-medium);
  }

  .quiet.active {
    color: var(--text);
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
