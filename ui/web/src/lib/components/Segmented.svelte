<!-- A row of mutually exclusive choices (a toggle group), like Settings' Light / Dark / System. Arrow keys move. -->
<script lang="ts" generics="T extends string">
  import type { IconName } from "../icons";
  import { isRovingKey, nextIndex } from "../logic/roving";
  import Icon from "./Icon.svelte";

  interface SegmentedOption<V extends string> {
    value: V;
    label?: string;
    icon?: IconName;
    title?: string;
    disabled?: boolean;
  }

  interface Props {
    options: SegmentedOption<T>[];
    value: T;
    label: string;
    disabled?: boolean;
    onchange?: (value: T) => void;
  }

  let { options, value = $bindable(), label, disabled = false, onchange }: Props = $props();
  let buttons: HTMLButtonElement[] = $state([]);

  function choose(next: T): void {
    if (next !== value) {
      value = next;
      onchange?.(next);
    }
  }

  function onkeydown(event: KeyboardEvent): void {
    if (!isRovingKey(event.key)) {
      return;
    }
    event.preventDefault();
    const current = options.findIndex((option) => option.value === value);
    const index = nextIndex(Math.max(0, current), options.length, event.key, (at) => options[at].disabled === true);
    if (index >= 0) {
      choose(options[index].value);
      buttons[index]?.focus();
    }
  }
</script>

<div class="segmented" role="radiogroup" aria-label={label} tabindex="-1" {onkeydown}>
  {#each options as option, index (option.value)}
    <button
      bind:this={buttons[index]}
      type="button"
      role="radio"
      class:on={option.value === value}
      class:with-icon={option.icon !== undefined && option.label !== undefined}
      aria-checked={option.value === value}
      aria-label={option.label ? undefined : option.title}
      title={option.title}
      tabindex={option.value === value ? 0 : -1}
      disabled={disabled || option.disabled}
      onclick={() => choose(option.value)}
    >
      {#if option.icon}
        <Icon name={option.icon} size={14} />
      {/if}
      {#if option.label}
        <span>{option.label}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    flex: none;
    display: flex;
    width: fit-content;
    padding: var(--segmented-padding);
    border-radius: var(--segmented-radius);
    background: var(--panel-alt);
    border: 1px solid var(--border-strong);
  }

  button {
    display: inline-flex;
    align-items: center;
    padding: var(--segmented-segment-padding-y) var(--segmented-segment-padding-x);
    border: none;
    border-radius: var(--segmented-segment-radius);
    background: transparent;
    color: var(--text-dim);
    font: inherit;
    cursor: pointer;
  }

  .with-icon {
    gap: 5px;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .on {
    background: var(--panel);
    color: var(--text);
    box-shadow: var(--shadow-segment);
  }
</style>
