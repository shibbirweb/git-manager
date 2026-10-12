<!-- A menu of one-of choices inside a Popover, like Keep Awake's: a bold title with its current status, a line,
     then each choice with a radio mark and a line of description. Arrow keys move, Enter or Space picks. -->
<script lang="ts" generics="T extends string">
  interface Choice {
    value: T;
    label: string;
    description?: string;
  }

  interface Props {
    title: string;
    status?: string;
    choices: Choice[];
    value: T;
    onchange?: (value: T) => void;
  }

  let { title, status = "", choices, value = $bindable(), onchange }: Props = $props();

  function choose(next: T): void {
    value = next;
    onchange?.(next);
  }

  function keydown(event: KeyboardEvent): void {
    const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(".choice")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step !== 0) {
      event.preventDefault();
      buttons[(index + step + buttons.length) % buttons.length]?.focus();
    }
  }
</script>

<div class="choice-menu" role="menu" aria-label={title} tabindex="-1" onkeydown={keydown}>
  <div class="head">
    <span>{title}</span>
    {#if status}<span class="status">{status}</span>{/if}
  </div>
  <div class="separator" role="separator"></div>
  {#each choices as choice (choice.value)}
    <button
      class="choice"
      type="button"
      role="menuitemradio"
      aria-checked={value === choice.value}
      onclick={() => choose(choice.value)}
    >
      <span class="radio" aria-hidden="true">
        {#if value === choice.value}<span class="radio-dot"></span>{/if}
      </span>
      <span class="lines">
        <span>{choice.label}</span>
        {#if choice.description}<span class="description">{choice.description}</span>{/if}
      </span>
    </button>
  {/each}
</div>

<style>
  .choice-menu {
    font-size: var(--font-size-small);
    outline: none;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--choice-menu-head-gap);
    padding: var(--choice-menu-item-padding-y) var(--choice-menu-item-padding-x);
    font-weight: var(--font-weight-semibold);
  }

  .status {
    color: var(--text-dim);
    font-weight: var(--font-weight-regular);
  }

  .separator {
    height: 1px;
    margin: var(--choice-menu-separator-space) calc(var(--choice-menu-separator-space) * -1);
    background: var(--border);
  }

  .choice {
    display: flex;
    align-items: center;
    gap: var(--choice-menu-item-gap);
    width: 100%;
    padding: var(--choice-menu-item-padding-y) var(--choice-menu-item-padding-x);
    border: none;
    border-radius: var(--radius-small);
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .choice:hover,
  .choice:focus-visible {
    background: var(--hover);
    outline: none;
  }

  .radio {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--choice-menu-radio-width);
  }

  .radio-dot {
    width: var(--choice-menu-radio-dot);
    height: var(--choice-menu-radio-dot);
    border-radius: 50%;
    background: var(--text);
  }

  .lines {
    display: flex;
    flex-direction: column;
    gap: var(--choice-menu-lines-gap);
  }

  .description {
    font-size: var(--font-size-xsmall);
    color: var(--text-dim);
  }
</style>
