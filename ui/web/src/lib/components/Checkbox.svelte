<!-- A native checkbox with its label; clicking the text toggles it. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    checked?: boolean;
    indeterminate?: boolean;
    label?: string;
    disabled?: boolean;
    size?: "normal" | "small";
    /** Tooltip, such as why it is off. */
    title?: string;
    onchange?: (checked: boolean) => void;
    children?: Snippet;
  }

  let {
    checked = $bindable(false),
    indeterminate = false,
    label = "",
    disabled = false,
    size = "normal",
    title,
    onchange,
    children,
  }: Props = $props();
</script>

<label class="check {size}" class:disabled {title}>
  <input type="checkbox" bind:checked {indeterminate} {disabled} onchange={() => onchange?.(checked)} />
  {#if children}
    {@render children()}
  {:else}
    <span>{label}</span>
  {/if}
</label>

<style>
  .check {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    cursor: pointer;
  }

  .check input {
    margin: 0;
  }

  /* A small dim option in a bar, like the notifications' Do Not Disturb. */
  .small {
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }

  .disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
