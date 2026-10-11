<!-- A button that opens a Menu under itself, like a "..." button. With `text` it is a Button, otherwise an
     IconButton. The menu aligns with the button's left edge, or its right edge with `alignEnd`. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import type { MenuItem } from "../logic/menuModel";
  import Button from "./Button.svelte";
  import IconButton from "./IconButton.svelte";
  import Menu from "./Menu.svelte";

  interface Props {
    items: MenuItem[];
    label: string;
    icon?: IconName;
    text?: string;
    alignEnd?: boolean;
    disabled?: boolean;
  }

  let { items, label, icon = "more", text = "", alignEnd = false, disabled = false }: Props = $props();

  let element = $state<HTMLButtonElement | null>(null);
  let open = $state<{ x: number; y: number; keyboard: boolean } | null>(null);

  function toggle(event: MouseEvent): void {
    if (open || !element) {
      open = null;
      return;
    }
    const rect = element.getBoundingClientRect();
    // A keyboard click (Enter or Space) has detail 0: highlight the first item so arrows work at once.
    open = { x: alignEnd ? rect.right : rect.left, y: rect.bottom + 2, keyboard: event.detail === 0 };
  }

  function close(restoreFocus: boolean): void {
    open = null;
    if (restoreFocus) {
      element?.focus();
    }
  }
</script>

{#if text}
  <Button bind:element {icon} {disabled} aria-haspopup="menu" aria-expanded={open !== null} onclick={toggle}>
    {text}
  </Button>
{:else}
  <IconButton
    bind:element
    {icon}
    {label}
    {disabled}
    active={open !== null}
    aria-haspopup="menu"
    aria-expanded={open !== null}
    onclick={toggle}
  />
{/if}

{#if open}
  <Menu {items} x={open.x} y={open.y} {alignEnd} keyboard={open.keyboard} {label} onclose={close} />
{/if}
