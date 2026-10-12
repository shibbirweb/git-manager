<!-- A borderless button with an icon (and optional text after it). `label` is its accessible name and tooltip. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import type { IconName } from "../icons";
  import type { IconSize } from "../logic/presets";
  import Icon from "./Icon.svelte";

  type IconButtonSize =
    | "large"
    | "normal"
    | "header"
    | "compact"
    | "small"
    | "chevron"
    | "inline"
    | "mini"
    | "micro"
    | "tool"
    | "row";

  interface Props extends Omit<HTMLButtonAttributes, "children" | "class" | "style"> {
    icon: IconName;
    label: string;
    iconSize?: IconSize;
    size?: IconButtonSize;
    tone?: "default" | "dim" | "faint" | "dim-danger" | "success" | "danger";
    active?: boolean;
    /** The icon turns, such as Refresh while it runs. */
    spinning?: boolean;
    /** Short text after the icon, such as a row's sync counts (2↓ 1↑). */
    count?: string;
    element?: HTMLButtonElement | null;
    children?: Snippet;
  }

  let {
    icon,
    label,
    iconSize = "large",
    size = "normal",
    tone = "default",
    active = false,
    spinning = false,
    count = "",
    type = "button",
    title,
    element = $bindable(null),
    children,
    ...rest
  }: Props = $props();
</script>

<button
  bind:this={element}
  {type}
  class="icon-button"
  class:small={size === "small"}
  class:header={size === "header"}
  class:large={size === "large"}
  class:compact={size === "compact"}
  class:tool={size === "tool"}
  class:row={size === "row"}
  class:dim={tone === "dim" || tone === "dim-danger"}
  class:dim-danger={tone === "dim-danger"}
  class:mini={size === "mini"}
  class:micro={size === "micro"}
  class:inline={size === "inline"}
  class:faint={tone === "faint"}
  class:success={tone === "success"}
  class:danger={tone === "danger"}
  class:chevron={size === "chevron"}
  class:active
  aria-label={label}
  aria-pressed={active ? true : undefined}
  title={title ?? label}
  {...rest}
>
  {#if spinning}
    <span class="spin"><Icon name={icon} size={iconSize} /></span>
  {:else}
    <Icon name={icon} size={iconSize} />
  {/if}
  {#if count}<span class="count">{count}</span>{/if}
  {@render children?.()}
</button>

<style>
  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--icon-button-gap);
    height: var(--icon-button-size);
    min-width: var(--icon-button-size);
    padding: 0 var(--icon-button-padding-x);
    border: none;
    border-radius: var(--icon-button-radius);
    background: transparent;
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }

  .icon-button:hover:not(:disabled),
  .active {
    background: var(--hover);
  }

  .icon-button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* A sidebar's foot, like the welcome screen's Settings. */
  .large {
    width: var(--icon-button-size-large);
    height: var(--icon-button-size-large);
  }

  /* The window header's Back and Forward. */
  .header {
    height: var(--icon-button-size-header);
    min-width: var(--icon-button-size-header);
  }

  .compact {
    height: var(--icon-button-size-compact);
    min-width: var(--icon-button-size-compact);
  }

  /* A file bar's tool: a narrow dim button. */
  .tool {
    width: var(--icon-button-tool-width);
    height: var(--icon-button-tool-height);
    min-width: 0;
    gap: normal;
    padding: 0;
    border-radius: var(--radius-small);
    color: var(--text-dim);
  }

  .tool:hover:not(:disabled) {
    color: var(--text);
  }

  /* A dim button that brightens on hover, such as the commit message's tools. */
  .dim {
    color: var(--text-dim);
  }

  .dim:hover:not(:disabled) {
    color: var(--text);
  }

  /* A repository row's action: 20 px, its hover a step darker than a row's. */
  .row {
    gap: var(--icon-button-row-gap);
    height: var(--icon-button-row-size);
    min-width: var(--icon-button-row-size);
    padding: 0 var(--icon-button-row-padding-x);
    border-radius: var(--radius-small);
    color: var(--text-dim);
  }

  .row:hover:not(:disabled) {
    background: var(--border-strong);
    color: var(--text);
  }

  .spin {
    display: inline-flex;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .count {
    font-size: var(--icon-button-count-font-size);
    font-variant-numeric: tabular-nums;
  }

  .small {
    height: var(--icon-button-size-small);
    min-width: var(--icon-button-size-small);
    padding: 0 var(--icon-button-padding-x-small);
  }

  /* The narrow menu half of a pair, like New Terminal's shell picker. */
  .chevron {
    height: var(--icon-button-size-compact);
    min-width: var(--icon-button-chevron-width);
    padding: 0 var(--icon-button-chevron-padding-x);
  }

  /* A row's small button, like a stash's Apply and Drop in the sidebar. */
  .mini {
    height: var(--icon-button-mini-size);
    min-width: var(--icon-button-mini-size);
    padding: 0 var(--icon-button-mini-padding-x);
  }

  /* A square action inside a list row, like the AI panel's New Agent: 22px, no side padding. */
  .inline {
    width: var(--icon-button-size-small);
    height: var(--icon-button-size-small);
    min-width: var(--icon-button-size-small);
    padding: 0;
  }

  /* The smallest: a list row's Remove, shown while the row is hovered. */
  .micro {
    width: var(--icon-button-micro-size);
    height: var(--icon-button-micro-size);
    min-width: 0;
    padding: 0;
    border-radius: var(--icon-button-micro-radius);
  }

  .micro:hover:not(:disabled) {
    background: var(--border-strong);
  }

  .faint {
    color: var(--text-faint);
  }

  .faint:hover:not(:disabled) {
    color: var(--text);
  }

  /* Dim, red under the pointer: a row's destructive action. */
  .dim-danger:hover:not(:disabled) {
    color: var(--danger);
  }

  /* Run and stop actions, like the Run panel's Rerun and Stop. */
  .success:not(:disabled) {
    color: var(--success);
  }

  .danger:not(:disabled) {
    color: var(--danger);
  }
</style>
