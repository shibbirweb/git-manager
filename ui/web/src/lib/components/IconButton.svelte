<!-- A borderless button with an icon (and optional text after it). `label` is its accessible name and tooltip. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props extends Omit<HTMLButtonAttributes, "children" | "class" | "style"> {
    icon: IconName;
    label: string;
    iconSize?: number;
    size?: "normal" | "small";
    active?: boolean;
    element?: HTMLButtonElement | null;
    children?: Snippet;
  }

  let {
    icon,
    label,
    iconSize = 16,
    size = "normal",
    active = false,
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
  class:active
  aria-label={label}
  aria-pressed={active ? true : undefined}
  title={title ?? label}
  {...rest}
>
  <Icon name={icon} size={iconSize} />
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

  .small {
    height: var(--icon-button-size-small);
    min-width: var(--icon-button-size-small);
    padding: 0 var(--icon-button-padding-x-small);
  }
</style>
