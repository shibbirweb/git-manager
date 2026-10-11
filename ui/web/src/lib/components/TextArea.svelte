<!-- A multi-line text field, like the commit message box. -->
<script lang="ts">
  import type { HTMLTextareaAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLTextareaAttributes, "class" | "style"> {
    value?: string;
    rows?: number;
    resize?: "none" | "vertical";
    invalid?: boolean;
    mono?: boolean;
    element?: HTMLTextAreaElement | null;
  }

  let {
    value = $bindable(""),
    rows = 3,
    resize = "none",
    invalid = false,
    mono = false,
    element = $bindable(null),
    ...rest
  }: Props = $props();
</script>

<textarea
  bind:this={element}
  bind:value
  {rows}
  class="input"
  class:invalid
  class:mono
  style:resize
  aria-invalid={invalid || undefined}
  {...rest}
></textarea>

<style>
  .input {
    height: auto;
    padding: var(--input-padding-y) var(--input-padding-x);
    border: 1px solid var(--border-strong);
    border-radius: var(--input-radius);
    background: var(--panel);
    color: var(--text);
    font: inherit;
    font-family: var(--font-ui);
    outline: none;
  }

  .input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 var(--input-focus-ring) color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .invalid,
  .invalid:focus {
    border-color: var(--danger);
  }

  .mono {
    font-family: var(--font-mono);
  }
</style>
