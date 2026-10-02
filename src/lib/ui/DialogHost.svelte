<script lang="ts">
  import { tick } from "svelte";
  import { dialogs } from "./dialog.svelte";
  import { initialPick, pickRows, stepPick } from "./pickList";

  let value = $state("");
  let checked = $state(false);
  let secondary = $state("");
  let inputEl = $state<HTMLInputElement | null>(null);
  let confirmEl = $state<HTMLButtonElement | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);
  /** Highlighted row of the pick list. */
  let pickIndex = $state(-1);

  const active = $derived(dialogs.active);
  const validationError = $derived(
    active?.type === "prompt" && active.options.validate ? active.options.validate(value) : null,
  );
  const rows = $derived(active?.type === "pick" ? pickRows(active.options.items, value) : []);

  $effect(() => {
    const current = dialogs.active;
    if (!current) {
      return;
    }
    if (current.type === "prompt") {
      value = current.options.initial ?? "";
      checked = current.options.checkbox?.checked ?? false;
      secondary = current.options.secondary?.initial ?? "";
    } else if (current.type === "pick") {
      value = "";
      pickIndex = initialPick(pickRows(current.options.items, ""), "");
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
      current.resolve({ value: value.trim(), checked, secondary: secondary.trim() });
    } else if (current.type === "pick") {
      const row = rows[pickIndex];
      if (row?.kind === "item" && !row.item.disabled) {
        dialogs.close();
        current.resolve(row.item.value);
      }
    } else if (current.type === "confirm") {
      dialogs.close();
      current.resolve(true);
    }
  }

  function pick(choice: string): void {
    const current = dialogs.active;
    if (current?.type === "choose" || current?.type === "pick") {
      dialogs.close();
      current.resolve(choice);
    }
  }

  function filterChanged(): void {
    pickIndex = initialPick(rows, value);
    listEl?.scrollTo({ top: 0 });
  }

  async function movePick(direction: 1 | -1): Promise<void> {
    pickIndex = stepPick(rows, pickIndex, direction);
    await tick();
    listEl?.querySelector(".pick-row.highlighted")?.scrollIntoView({ block: "nearest" });
  }

  function onFilterKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      void movePick(event.key === "ArrowDown" ? 1 : -1);
    }
  }

  /** Cmd+Enter submits a prompt from its multi-line field. */
  function onSecondaryKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
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
        {#if active.options.secondary}
          <label class="field secondary">
            <span>{active.options.secondary.label}</span>
            <textarea
              class="input"
              bind:value={secondary}
              placeholder={active.options.secondary.placeholder ?? ""}
              rows="3"
              spellcheck="true"
              onkeydown={onSecondaryKeydown}
            ></textarea>
          </label>
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
      {:else if active.type === "pick"}
        <input
          bind:this={inputEl}
          class="input filter"
          bind:value
          oninput={filterChanged}
          onkeydown={onFilterKeydown}
          placeholder={active.options.placeholder ?? "Type to filter"}
          spellcheck="false"
          autocomplete="off"
          role="combobox"
          aria-expanded="true"
          aria-controls="pick-list"
          aria-activedescendant={pickIndex >= 0 ? `pick-row-${pickIndex}` : undefined}
        />
        <div bind:this={listEl} id="pick-list" class="pick-list" role="listbox" aria-label={active.options.title}>
          {#each rows as row, index (index)}
            {#if row.kind === "group"}
              <div class="pick-group" role="presentation">{row.label}</div>
            {:else}
              <button
                type="button"
                id="pick-row-{index}"
                class="pick-row"
                class:highlighted={index === pickIndex}
                role="option"
                aria-selected={index === pickIndex}
                tabindex="-1"
                disabled={row.item.disabled}
                onmousemove={() => {
                  if (!row.item.disabled) {
                    pickIndex = index;
                  }
                }}
                onclick={() => pick(row.item.value)}
              >
                <span class="pick-label truncate">{row.item.label}</span>
                {#if row.item.description}
                  <span class="pick-description truncate">{row.item.description}</span>
                {/if}
              </button>
            {/if}
          {:else}
            <div class="pick-empty dim">{active.options.emptyText ?? "Nothing matches"}</div>
          {/each}
        </div>
        <div class="actions">
          <button type="button" class="btn" onclick={cancel}>Cancel</button>
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

  .field.secondary {
    margin-top: 12px;
  }

  .field textarea {
    width: 100%;
    resize: vertical;
    line-height: 1.45;
  }

  .filter {
    width: 100%;
  }

  .pick-list {
    max-height: min(340px, 50vh);
    overflow-y: auto;
    margin-top: 8px;
    padding: 2px 0;
  }

  .pick-group {
    padding: 8px 8px 3px;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .pick-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    min-width: 0;
    padding: 5px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .pick-row.highlighted {
    background: var(--accent);
    color: var(--accent-text);
  }

  .pick-row:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .pick-label {
    flex: 0 1 auto;
    min-width: 0;
  }

  .pick-description {
    flex: 0 1 auto;
    min-width: 0;
    color: var(--text-faint);
    font-size: 12px;
  }

  .pick-row.highlighted .pick-description {
    color: inherit;
    opacity: 0.8;
  }

  .pick-empty {
    padding: 10px 8px;
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
