<!-- A native drop-down list, styled like Input. Use Segmented for two to four short choices. The native arrow is
     hidden (WebKit draws it against the right border) and a chevron sits inside the padding instead. -->
<script lang="ts" generics="T extends string">
  import { controlWidth, type ControlWidth } from "../logic/presets";
  import Icon from "./Icon.svelte";

  interface SelectOption<V extends string> {
    value: V;
    label: string;
    disabled?: boolean;
  }

  interface Props {
    options: SelectOption<T>[];
    value: T;
    label: string;
    disabled?: boolean;
    width?: ControlWidth;
    size?: "normal" | "small";
    onchange?: (value: T) => void;
  }

  let {
    options,
    value = $bindable(),
    label,
    disabled = false,
    width = "auto",
    size = "normal",
    onchange,
  }: Props = $props();
</script>

<span class="select {size}" class:disabled style:width={controlWidth(width)}>
  <select
    class="input"
    aria-label={label}
    {disabled}
    {value}
    onchange={(event) => {
      value = event.currentTarget.value as T;
      onchange?.(value);
    }}
  >
    {#each options as option (option.value)}
      <option value={option.value} disabled={option.disabled}>{option.label}</option>
    {/each}
  </select>
  <span class="arrow"><Icon name="chevron-down" size="compact" tone="dim" /></span>
</span>

<style>
  .select {
    position: relative;
    display: inline-flex;
    flex: none;
    max-width: var(--control-width-large);
  }

  .input {
    width: 100%;
    min-width: 0;
    height: var(--input-height);
    padding: 0 var(--select-arrow-space) 0 var(--input-padding-x);
    border: 1px solid var(--border-strong);
    border-radius: var(--input-radius);
    background: var(--panel);
    color: var(--text);
    font: inherit;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
  }

  .input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 var(--input-focus-ring) color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .arrow {
    position: absolute;
    top: 0;
    right: var(--select-arrow-inset);
    bottom: 0;
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  /* A picker inside a settings line, such as Git identity's repository. */
  .small .input {
    height: var(--size-control-small);
    padding: 0 var(--select-small-arrow-space) 0 var(--space-2);
    font-size: var(--font-size-small);
  }

  .small .arrow {
    right: var(--select-small-arrow-inset);
  }

  .disabled {
    opacity: 0.5;
  }
</style>
