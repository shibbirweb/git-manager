<!-- A single-line text field. Invalid draws a red border; pair it with Field to show the message. -->
<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { controlWidth, type ControlWidth } from "../logic/presets";

  interface Props extends Omit<HTMLInputAttributes, "class" | "style"> {
    value?: string;
    invalid?: boolean;
    mono?: boolean;
    width?: ControlWidth;
    suggestions?: string[];
    element?: HTMLInputElement | null;
  }

  let {
    value = $bindable(""),
    invalid = false,
    mono = false,
    width = "auto",
    suggestions = [],
    type = "text",
    element = $bindable(null),
    ...rest
  }: Props = $props();

  const listId = $props.id();
</script>

<input
  bind:this={element}
  bind:value
  {type}
  class="input"
  class:invalid
  class:mono
  aria-invalid={invalid || undefined}
  style:width={controlWidth(width)}
  list={suggestions.length ? listId : undefined}
  {...rest}
/>
{#if suggestions.length}
  <datalist id={listId}>
    {#each suggestions as suggestion (suggestion)}
      <option value={suggestion}></option>
    {/each}
  </datalist>
{/if}

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
    box-shadow: 0 0 0 var(--input-focus-ring) color-mix(in srgb, var(--danger) 25%, transparent);
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--font-size-small);
  }
</style>
