<!-- A button that looks like a link, for a small action inside text or under a list, such as "Open settings" or
     "Show older releases". `dim` is a quiet disclosure, with an optional icon before the words; `expanded` shows
     a fold chevron for a toggle such as Earlier versions. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    tone?: "accent" | "dim";
    size?: "inherit" | "small";
    /** Code-like words, such as a parent commit's hash. */
    mono?: boolean;
    icon?: IconName | null;
    expanded?: boolean | null;
    disabled?: boolean;
    title?: string;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  }

  let {
    tone = "accent",
    size = "inherit",
    mono = false,
    icon = null,
    expanded = null,
    disabled = false,
    title,
    onclick,
    children,
  }: Props = $props();
</script>

<button
  class="link {tone} {size}"
  class:mono
  class:has-icon={!!icon || expanded !== null}
  type="button"
  aria-expanded={expanded ?? undefined}
  {disabled}
  {title}
  {onclick}
>
  {#if expanded !== null}
    <Icon name={expanded ? "chevron-down" : "chevron-right"} size="compact" />
  {:else if icon}
    <Icon name={icon} size="compact" />
  {/if}
  {@render children()}
</button>

<style>
  .link {
    display: inline-flex;
    align-items: center;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    cursor: pointer;
  }

  .has-icon {
    gap: var(--space-3);
  }

  .accent {
    color: var(--accent);
  }

  .accent:hover:not(:disabled) {
    text-decoration: underline;
  }

  .dim {
    color: var(--text-dim);
  }

  .dim:hover:not(:disabled) {
    color: var(--text);
  }

  .small {
    font-size: var(--font-size-small);
  }

  .link:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .mono {
    font-family: var(--font-mono);
  }
</style>
