<!-- A text button: Default, Primary (the main action), Danger (red text) or Danger primary (a red, filled
     destructive confirm). Small fits toolbars and rows. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props extends Omit<HTMLButtonAttributes, "children" | "class" | "style"> {
    variant?: "default" | "primary" | "danger" | "danger-primary";
    size?: "normal" | "small";
    icon?: IconName | null;
    element?: HTMLButtonElement | null;
    children?: Snippet;
  }

  let {
    variant = "default",
    size = "normal",
    icon = null,
    type = "button",
    element = $bindable(null),
    children,
    ...rest
  }: Props = $props();
</script>

<button
  bind:this={element}
  {type}
  class="button {variant}"
  class:small={size === "small"}
  {...rest}
>
  {#if icon}
    <Icon name={icon} size={size === "small" ? 12 : 14} />
  {/if}
  {@render children?.()}
</button>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    gap: var(--button-gap);
    height: var(--button-height);
    padding: 0 var(--button-padding-x);
    border: 1px solid var(--border-strong);
    border-radius: var(--button-radius);
    background: var(--panel);
    color: var(--text);
    font: inherit;
    cursor: pointer;
    white-space: nowrap;
  }

  .button:hover:not(:disabled) {
    background: var(--hover);
  }

  .button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
  }

  .primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .danger {
    color: var(--danger);
  }

  .danger-primary,
  .danger-primary:hover:not(:disabled) {
    background: var(--danger);
    border-color: var(--danger);
    color: var(--accent-text);
  }

  .small {
    height: var(--button-height-small);
    padding: 0 var(--button-padding-x-small);
    font-size: var(--button-font-size-small);
  }
</style>
