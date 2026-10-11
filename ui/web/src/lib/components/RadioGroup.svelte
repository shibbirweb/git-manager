<!-- Native radio buttons for one choice among a few, each with an optional description under its label. -->
<script lang="ts" generics="T extends string">
  interface RadioOption<V extends string> {
    value: V;
    label: string;
    description?: string;
    disabled?: boolean;
  }

  interface Props {
    options: RadioOption<T>[];
    value: T;
    name: string;
    label: string;
    direction?: "column" | "row";
    onchange?: (value: T) => void;
  }

  let { options, value = $bindable(), name, label, direction = "column", onchange }: Props = $props();
</script>

<div class="radios" class:row={direction === "row"} role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <label class="radio" class:disabled={option.disabled}>
      <input
        type="radio"
        {name}
        value={option.value}
        checked={option.value === value}
        disabled={option.disabled}
        onchange={() => {
          value = option.value;
          onchange?.(option.value);
        }}
      />
      <span class="text">
        <span>{option.label}</span>
        {#if option.description}
          <span class="description">{option.description}</span>
        {/if}
      </span>
    </label>
  {/each}
</div>

<style>
  .radios {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .row {
    flex-direction: row;
    gap: 14px;
  }

  .radio {
    display: inline-flex;
    align-items: flex-start;
    gap: 6px;
    cursor: pointer;
  }

  .radio input {
    margin: 2px 0 0;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .description {
    font-size: 12px;
    color: var(--text-dim);
  }

  .disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
