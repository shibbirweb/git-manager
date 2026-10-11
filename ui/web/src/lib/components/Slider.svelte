<!-- A range slider with its value shown on the right, like Settings' font size and line height. -->
<script lang="ts">
  interface Props {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    disabled?: boolean;
    format?: (value: number) => string;
    onchange?: (value: number) => void;
  }

  let {
    value = $bindable(),
    min,
    max,
    step = 1,
    label,
    disabled = false,
    format = (shown: number) => String(shown),
    onchange,
  }: Props = $props();
</script>

<div class="range">
  <input
    type="range"
    {min}
    {max}
    {step}
    {disabled}
    aria-label={label}
    bind:value
    oninput={() => onchange?.(value)}
  />
  <span class="value">{format(value)}</span>
</div>

<style>
  .range {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--slider-gap);
  }

  .range input {
    width: var(--slider-width);
    accent-color: var(--accent);
  }

  .value {
    width: var(--slider-value-width);
    text-align: right;
    font-family: var(--font-mono);
    font-size: var(--font-size-small);
  }
</style>
