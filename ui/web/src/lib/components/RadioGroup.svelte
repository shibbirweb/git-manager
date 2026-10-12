<!-- Native radio buttons for one choice among a few, each with an optional description under its label. -->
<script lang="ts" generics="T extends string">
  import { presetVar, type LabelColumn } from "../logic/presets";

  interface RadioOption<V extends string> {
    value: V;
    label: string;
    description?: string;
    disabled?: boolean;
    /** A choice that throws work away, such as reset --hard: its label is red. */
    danger?: boolean;
  }

  interface Props {
    options: RadioOption<T>[];
    value: T;
    name: string;
    label: string;
    direction?: "column" | "row";
    layout?: "stacked" | "columns";
    labelWidth?: LabelColumn;
    onchange?: (value: T) => void;
  }

  let {
    options,
    value = $bindable(),
    name,
    label,
    direction = "column",
    layout = "stacked",
    labelWidth = "large",
    onchange,
  }: Props = $props();
</script>

<div
  class="radios"
  class:row={direction === "row"}
  role="radiogroup"
  aria-label={label}
  style:--column={presetVar("labelColumn", labelWidth)}
>
  {#each options as option (option.value)}
    <label class="radio" class:columns={layout === "columns"} class:disabled={option.disabled}>
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
      {#if layout === "columns"}
        <span class="column-label" class:danger={option.danger}>{option.label}</span>
        <span class="column-hint">{option.description ?? ""}</span>
      {:else}
        <span class="text">
          <span class:label={!!option.description} class:danger={option.danger}>{option.label}</span>
          {#if option.description}
            <span class="description">{option.description}</span>
          {/if}
        </span>
      {/if}
    </label>
  {/each}
</div>

<style>
  .radios {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .row {
    flex-direction: row;
    gap: var(--space-7);
  }

  .radio {
    display: inline-flex;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .radio input {
    margin: var(--space-1) 0 0;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .columns {
    display: grid;
    grid-template-columns: auto var(--column) 1fr;
    align-items: center;
  }

  .columns input {
    margin: 0;
  }

  .column-label {
    font-weight: var(--font-weight-medium);
  }

  .column-hint {
    color: var(--text-faint);
    font-size: var(--font-size-small);
  }

  .description {
    font-size: var(--font-size-small);
    color: var(--text-dim);
  }

  /* A choice with a description reads as a heading over it, as in Reset's modes. */
  .label {
    font-weight: var(--font-weight-medium);
  }

  .danger {
    color: var(--danger);
  }

  .disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
