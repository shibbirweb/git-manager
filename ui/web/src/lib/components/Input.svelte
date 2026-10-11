<!-- A single-line text field. Invalid draws a red border; pair it with Field to show the message. -->
<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLInputAttributes, "class" | "style"> {
    value?: string;
    invalid?: boolean;
    mono?: boolean;
    element?: HTMLInputElement | null;
  }

  let {
    value = $bindable(""),
    invalid = false,
    mono = false,
    type = "text",
    element = $bindable(null),
    ...rest
  }: Props = $props();
</script>

<input
  bind:this={element}
  bind:value
  {type}
  class="input"
  class:invalid
  class:mono
  aria-invalid={invalid || undefined}
  {...rest}
/>

<style>
  .input {
    height: var(--input-height);
    padding: 0 var(--input-padding-x);
    border: 1px solid var(--border-strong);
    border-radius: var(--input-radius);
    background: var(--panel);
    color: var(--text);
    font: inherit;
    outline: none;
  }

  .input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 var(--input-focus-ring) color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .input:disabled {
    opacity: 0.5;
  }

  .invalid,
  .invalid:focus {
    border-color: var(--danger);
  }

  .invalid:focus {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--danger) 25%, transparent);
  }

  .mono {
    font-family: var(--font-mono);
  }
</style>
