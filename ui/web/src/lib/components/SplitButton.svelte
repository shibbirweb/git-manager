<!-- A main action joined to a menu of related actions, like Commit with Commit and Push behind its arrow. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import type { MenuItem } from "../logic/menuModel";
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
  import Menu from "./Menu.svelte";

  interface Props {
    text: string;
    items: MenuItem[];
    menuLabel: string;
    variant?: "default" | "primary";
    size?: "normal" | "small";
    icon?: IconName | null;
    disabled?: boolean;
    onclick: () => void;
  }

  let {
    text,
    items,
    menuLabel,
    variant = "primary",
    size = "normal",
    icon = null,
    disabled = false,
    onclick,
  }: Props = $props();

  let arrow = $state<HTMLButtonElement | null>(null);
  let open = $state<{ x: number; y: number; keyboard: boolean } | null>(null);

  function toggle(event: MouseEvent): void {
    if (open || !arrow) {
      open = null;
      return;
    }
    const rect = arrow.getBoundingClientRect();
    open = { x: rect.right, y: rect.bottom + 2, keyboard: event.detail === 0 };
  }
</script>

<span class="split" role="group" aria-label={text}>
  <span class="main"><Button {variant} {size} {icon} {disabled} {onclick}>{text}</Button></span>
  <span class="arrow">
    <Button
      bind:element={arrow}
      {variant}
      {size}
      {disabled}
      aria-label={menuLabel}
      aria-haspopup="menu"
      aria-expanded={open !== null}
      onclick={toggle}
    >
      <Icon name="chevron-down" size="medium" />
    </Button>
  </span>
</span>

{#if open}
  <Menu
    {items}
    x={open.x}
    y={open.y}
    alignEnd
    keyboard={open.keyboard}
    label={menuLabel}
    onclose={(restore) => {
      open = null;
      if (restore) {
        arrow?.focus();
      }
    }}
  />
{/if}

<style>
  .split {
    flex: none;
    display: inline-flex;
  }

  .main :global(button) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .arrow {
    margin-left: 1px;
  }

  .arrow :global(button) {
    padding: 0 var(--split-button-arrow-padding-x);
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
</style>
