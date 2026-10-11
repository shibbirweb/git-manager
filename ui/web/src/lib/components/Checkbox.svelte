<!-- A native checkbox with its label; clicking the text toggles it. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    checked?: boolean;
    indeterminate?: boolean;
    label?: string;
    disabled?: boolean;
    onchange?: (checked: boolean) => void;
    children?: Snippet;
  }

  let { checked = $bindable(false), indeterminate = false, label = "", disabled = false, onchange, children }: Props =
    $props();
</script>

<label class="check" class:disabled>
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
    gap: 6px;
    cursor: pointer;
  }

  .check input {
    margin: 0;
  }

  .disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
