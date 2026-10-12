<!-- A button that stays on or off, like the diff's "Collapse unchanged" and the merge editor's options. `plain` is
     borderless and tints when on (editor toolbars); `outline` has a border and turns accent when on; `tool` is a
     file bar's narrow tool; `chip` is a popup's filter with a check when on. Without a `text` it is a narrow icon
     button, and `label` names it. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    pressed?: boolean;
    label: string;
    text?: string;
    icon?: IconName | null;
    variant?: "plain" | "outline" | "tool" | "chip" | "filter";
    disabled?: boolean;
    title?: string;
    onchange?: (pressed: boolean) => void;
  }

  let {
    pressed = $bindable(false),
    label,
    text = "",
    icon = null,
    variant = "plain",
    disabled = false,
    title,
    onchange,
  }: Props = $props();

  function toggle(): void {
    pressed = !pressed;
    onchange?.(pressed);
  }
</script>

<button
  class="toggle {variant}"
  class:active={pressed}
  class:icon-only={!text}
  type="button"
  aria-pressed={pressed}
  aria-label={text ? undefined : label}
  title={title ?? label}
  {disabled}
  onclick={toggle}
>
  {#if variant === "chip" && pressed}<Icon name="check" size="compact" />{/if}
  {#if icon}<Icon name={icon} size="medium" />{/if}
  {#if text}<span>{text}</span>{/if}
</button>

<style>
  .toggle {
    flex: none;
    display: inline-flex;
    align-items: center;
    border-radius: var(--radius-control);
    background: transparent;
    font-size: var(--font-size-small);
    cursor: pointer;
  }

  .plain {
    gap: var(--toggle-button-plain-gap);
    height: var(--toggle-button-plain-height);
    padding: 0 var(--toggle-button-plain-padding-x);
    border: none;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .plain.icon-only {
    padding: 0 var(--toggle-button-icon-padding-x);
  }

  .plain:hover:not(:disabled) {
    background: var(--hover);
  }

  .plain.active {
    background: var(--selected-inactive);
    color: var(--text);
  }

  .outline {
    gap: var(--toggle-button-outline-gap);
    height: var(--toggle-button-outline-height);
    padding: 0 var(--toggle-button-outline-padding-x);
    border: 1px solid var(--border-strong);
    color: var(--text);
  }

  .outline.active {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    border-color: var(--accent);
    color: var(--accent);
  }

  /* A file bar's on and off tool, such as Blame. */
  .tool {
    justify-content: center;
    width: var(--toggle-button-tool-width);
    height: var(--toggle-button-tool-height);
    padding: 0;
    border: none;
    border-radius: var(--radius-small);
    color: var(--text-dim);
  }

  .tool:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  .tool.active {
    background: var(--selected-inactive);
    color: var(--text);
  }

  /* A filter in a popup's head, such as Recent Files' "Edited only": a check and an accent border when on. */
  .chip {
    gap: var(--toggle-button-chip-gap);
    padding: var(--toggle-button-chip-padding-y) var(--toggle-button-chip-padding-x);
    border: 1px solid transparent;
    border-radius: var(--radius-small);
    color: var(--text-dim);
  }

  .chip:hover:not(:disabled) {
    background: var(--selected);
  }

  .chip.active {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* A log filter such as "Mine": a bordered button that tints with the accent when on. */
  .filter {
    gap: var(--toggle-button-outline-gap);
    height: var(--toggle-button-filter-height);
    padding: 0 var(--toggle-button-filter-padding-x);
    border: 1px solid var(--border-strong);
    background: var(--panel);
    color: var(--text-dim);
    white-space: nowrap;
  }

  .filter:hover:not(:disabled) {
    background: var(--hover);
  }

  .filter.active {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--border-strong));
    background: color-mix(in srgb, var(--accent) 12%, var(--panel));
    color: var(--text);
  }

  .toggle:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
