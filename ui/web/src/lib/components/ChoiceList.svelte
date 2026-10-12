<!-- A few answers to pick from, each a card with a label and a line of description, like "How to apply the
     stash?". A danger choice has a red label. Picking one calls `onpick` with its value. -->
<script lang="ts" generics="T extends string">
  interface Choice {
    value: T;
    label: string;
    description?: string;
    danger?: boolean;
  }

  interface Props {
    choices: Choice[];
    label: string;
    onpick: (value: T) => void;
  }

  let { choices, label, onpick }: Props = $props();
</script>

<div class="choices" role="group" aria-label={label}>
  {#each choices as choice (choice.value)}
    <button type="button" class="choice" class:danger={choice.danger} onclick={() => onpick(choice.value)}>
      <span class="choice-label">{choice.label}</span>
      {#if choice.description}<span class="description">{choice.description}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .choices {
    display: flex;
    flex-direction: column;
    gap: var(--choice-list-gap);
  }

  .choice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--choice-list-line-gap);
    padding: var(--choice-list-padding-y) var(--choice-list-padding-x);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-control);
    background: var(--panel);
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .choice:hover {
    background: var(--hover);
  }

  .choice-label {
    font-weight: var(--font-weight-medium);
  }

  .danger .choice-label {
    color: var(--danger);
  }

  .description {
    color: var(--text-dim);
  }
</style>
