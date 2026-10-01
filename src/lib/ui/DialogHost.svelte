<script lang="ts">
  import { tick } from "svelte";
  import { dialogs } from "./dialog.svelte";

  let value = $state("");
  let checked = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);
  let confirmEl = $state<HTMLButtonElement | null>(null);

  const active = $derived(dialogs.active);
  const validationError = $derived(
    active?.type === "prompt" && active.options.validate ? active.options.validate(value) : null,
  );

  $effect(() => {
    const current = dialogs.active;
    if (!current) {
      return;
    }
    if (current.type === "prompt") {
      value = current.options.initial ?? "";
      checked = current.options.checkbox?.checked ?? false;
    }
    tick().then(() => {
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      } else {
        confirmEl?.focus();
      }
    });
  });

  function cancel(): void {
    const current = dialogs.active;
    dialogs.close();
    if (!current) {
      return;
    }
    if (current.type === "confirm") {
      current.resolve(false);
    } else {
      current.resolve(null);
    }
  }

  function submit(): void {
    const current = dialogs.active;
    if (!current) {
      return;
    }
    if (current.type === "prompt") {
      if (validationError || !value.trim()) {
        return;
      }
      dialogs.close();
      current.resolve({ value: value.trim(), checked });
    } else if (current.type === "confirm") {
      dialogs.close();
      current.resolve(true);
    }
  }

  function pick(choice: string): void {
    const current = dialogs.active;
    if (current?.type === "choose") {
      dialogs.close();
      current.resolve(choice);
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!dialogs.active) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if active}
  <div class="overlay" role="presentation" onmousedown={(event) => event.target === event.currentTarget && cancel()}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    <form
      onsubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h2 id="dialog-title">{active.options.title}</h2>

      {#if active.type === "confirm"}
        {#if active.options.message}
          <p class="message selectable">{active.options.message}</p>
        {/if}
        <div class="actions">
          <button type="button" class="btn" onclick={cancel}>{active.options.cancelLabel ?? "Cancel"}</button>
          <button bind:this={confirmEl} type="submit" class="btn primary" class:danger-fill={active.options.danger}>
            {active.options.confirmLabel ?? "OK"}
          </button>
        </div>
      {:else if active.type === "prompt"}
        <label class="field">
          {#if active.options.label}
            <span>{active.options.label}</span>
          {/if}
          <input
            bind:this={inputEl}
            class="input"
            bind:value
            placeholder={active.options.placeholder ?? ""}
            spellcheck="false"
            autocomplete="off"
          />
        </label>
        {#if validationError && value}
          <div class="error">{validationError}</div>
        {/if}
        {#if active.options.checkbox}
          <label class="check">
            <input type="checkbox" bind:checked />
            {active.options.checkbox.label}
          </label>
        {/if}
        <div class="actions">
          <button type="button" class="btn" onclick={cancel}>Cancel</button>
          <button type="submit" class="btn primary" disabled={!!validationError || !value.trim()}>
            {active.options.confirmLabel ?? "OK"}
          </button>
        </div>
      {:else if active.type === "choose"}
        {#if active.options.message}
          <p class="message selectable">{active.options.message}</p>
        {/if}
        <div class="choices">
          {#each active.options.options as option (option.value)}
            <button type="button" class="choice" class:danger={option.danger} onclick={() => pick(option.value)}>
              <span class="choice-label">{option.label}</span>
              {#if option.description}
                <span class="dim">{option.description}</span>
              {/if}
            </button>
          {/each}
        </div>
        <div class="actions">
          <button type="button" class="btn" onclick={cancel}>Cancel</button>
        </div>
      {/if}
    </form>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 14vh;
    z-index: 900;
  }

  .dialog {
    width: min(460px, calc(100vw - 32px));
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    box-shadow: var(--shadow);
    padding: 18px 20px 16px;
  }

  h2 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
  }

  .message {
    margin: 0 0 16px;
    line-height: 1.5;
    white-space: pre-wrap;
    color: var(--text-dim);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field .input {
    width: 100%;
  }

  .error {
    margin-top: 6px;
    color: var(--danger);
    font-size: 12px;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 18px;
  }

  .danger-fill {
    background: var(--danger);
    border-color: var(--danger);
  }

  .choices {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .choice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 8px 12px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--panel);
    text-align: left;
    cursor: pointer;
  }

  .choice:hover {
    background: var(--hover);
  }

  .choice.danger .choice-label {
    color: var(--danger);
  }

  .choice-label {
    font-weight: 500;
  }
</style>
