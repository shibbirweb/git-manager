<!-- A small rounded button with a word or two: `filter` chips sum up a list and filter it (the AI panel's "2
     waiting"), `pick` chips offer a value to use (font names in Settings, each shown in its own font family). -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";
  import StatusIcon from "./StatusIcon.svelte";

  type Status = "starting" | "working" | "waiting" | "done" | "exited" | "idle";

  interface Props {
    text: string;
    variant?: "filter" | "pick" | "badge";
    tone?: "neutral" | "warning";
    icon?: IconName | null;
    /** A status mark before the words in place of `icon`, such as the AI panel's "2 need you". */
    status?: Status | null;
    fontFamily?: string;
    title?: string;
    onclick?: () => void;
  }

  let {
    text,
    variant = "filter",
    tone = "neutral",
    icon = null,
    status = null,
    fontFamily,
    title,
    onclick,
  }: Props = $props();
</script>

{#if onclick}
  <button class="chip {variant} {tone}" type="button" {title} style:font-family={fontFamily} {onclick}>
    {#if status}<StatusIcon state={status} label={text} />{:else if icon}<Icon name={icon} size="small" />{/if}{text}
  </button>
{:else}
  <span class="chip {variant} {tone}" {title} style:font-family={fontFamily}>
    {#if status}<StatusIcon state={status} label={text} />{:else if icon}<Icon name={icon} size="small" />{/if}{text}
  </span>
{/if}

<style>
  .chip {
    flex: none;
    display: inline-flex;
    align-items: center;
  }

  button.chip {
    cursor: pointer;
  }

  .filter {
    gap: var(--chip-gap);
    height: var(--chip-height);
    padding: 0 var(--chip-padding-right) 0 var(--chip-padding-left);
    border: 1px solid var(--border);
    border-radius: var(--chip-radius);
    background: transparent;
    color: var(--text-dim);
    font-size: var(--font-size-xsmall);
  }

  .filter.warning {
    border-color: color-mix(in srgb, var(--warning) 45%, transparent);
    background: color-mix(in srgb, var(--warning) 10%, transparent);
    color: var(--text);
  }

  .pick {
    padding: var(--chip-pick-padding-y) var(--chip-pick-padding-x);
    border: 1px solid var(--border-strong);
    border-radius: var(--chip-pick-radius);
    background: var(--panel);
    color: var(--text);
    font-size: var(--font-size-small);
  }

  /* A small bordered fact that can be pressed, such as a package's Node version. */
  .badge {
    height: var(--chip-badge-height);
    padding: 0 var(--chip-badge-padding-x);
    border: 1px solid var(--border);
    border-radius: var(--radius-small);
    background: transparent;
    color: var(--text-dim);
    font-size: var(--font-size-xsmall);
  }

  button.badge:hover {
    background: var(--hover);
    color: var(--text);
  }

  .badge.warning {
    border-color: color-mix(in srgb, var(--warning) 50%, transparent);
    color: var(--warning);
  }

  .pick:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
