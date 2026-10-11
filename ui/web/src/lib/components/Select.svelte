<!-- A native drop-down list, styled like Input. Use Segmented for two to four short choices. -->
<script lang="ts" generics="T extends string">
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
    width?: string;
    onchange?: (value: T) => void;
  }

  let { options, value = $bindable(), label, disabled = false, width = "auto", onchange }: Props = $props();
</script>

<select
  class="input"
  aria-label={label}
  {disabled}
  style:width
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

<style>
  .input {
    flex: none;
    max-width: 280px;
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
</style>
