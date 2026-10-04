<!-- Settings > Keyboard Shortcuts: every command with its keys. Search by name or by pressing
     keys; click the keys to record new ones. The rules (reserved keys, conflicts, saving) live in
     commands/shortcutSettings.ts. -->
<script lang="ts">
  import { tick } from "svelte";
  import { commandSpecs, currentPlatform } from "$lib/commands/commandRuntime";
  import type { Keybinding } from "$lib/commands/keybinding";
  import type { CommandId, CommandSpec } from "$lib/commands/registry";
  import {
    commandsWithKeys,
    type RecordedKeys,
    recordKeys,
    replaceShortcut,
    type ShortcutRow,
    shortcutRows,
    withoutOverride,
    withShortcut,
  } from "$lib/commands/shortcutSettings";
  import { settings } from "$lib/stores/settings.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";

  const platform = currentPlatform();
  const mac = platform === "macos";
  const specs = commandSpecs(platform);

  let query = $state("");
  /** Record Keys: key presses in the search field search by keys. */
  let searchByKeys = $state(false);
  let searchKeys = $state<Keybinding | null>(null);
  let searchText = $state("");
  let changedOnly = $state(false);
  let searchInput = $state<HTMLInputElement | null>(null);

  /** The command whose keys are being recorded. */
  let editingId = $state<CommandId | null>(null);
  let pending = $state<RecordedKeys | null>(null);
  let recorder = $state<HTMLElement | null>(null);

  const overrides = $derived(settings.keybindings);
  const rows = $derived(
    shortcutRows(specs, overrides, platform, { query, keys: searchByKeys ? searchKeys : null, changedOnly }),
  );
  const changedCount = $derived(Object.keys(overrides).length);
  const editingSpec = $derived(specs.find((spec) => spec.id === editingId) ?? null);
  const pendingConflicts = $derived(
    pending && !pending.problem && editingId ? commandsWithKeys(specs, overrides, platform, pending.accelerator, editingId) : [],
  );

  function isPlain(event: KeyboardEvent): boolean {
    return !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
  }

  function onSearchKeydown(event: KeyboardEvent): void {
    if (!searchByKeys) {
      return;
    }
    // Every key is a search term here, so nothing else (the menu, the window) runs it.
    event.preventDefault();
    event.stopPropagation();
    if (isPlain(event) && event.key === "Escape") {
      searchByKeys = false;
      return;
    }
    if (isPlain(event) && event.key === "Backspace") {
      searchKeys = null;
      searchText = "";
      return;
    }
    const recorded = recordKeys(event, platform);
    if (recorded) {
      searchKeys = recorded.binding;
      searchText = recorded.text;
    }
  }

  async function toggleSearchByKeys(): Promise<void> {
    searchByKeys = !searchByKeys;
    searchKeys = null;
    searchText = "";
    await tick();
    searchInput?.focus();
  }

  async function startEditing(spec: CommandSpec): Promise<void> {
    editingId = spec.id;
    pending = null;
    await tick();
    recorder?.focus();
  }

  function stopEditing(): void {
    editingId = null;
    pending = null;
  }

  function onRecorderKeydown(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (isPlain(event) && event.key === "Escape") {
      stopEditing();
      return;
    }
    if (isPlain(event) && event.key === "Enter") {
      if (pending && !pending.problem && pendingConflicts.length === 0) {
        save(false);
      }
      return;
    }
    pending = recordKeys(event, platform) ?? pending;
  }

  /** Saves the recorded keys; `replace` takes them away from the commands that had them. */
  function save(replace: boolean): void {
    const spec = editingSpec;
    if (!spec || !pending || pending.problem) {
      return;
    }
    const next = replace
      ? replaceShortcut(overrides, spec, pending.accelerator, pendingConflicts, platform)
      : withShortcut(overrides, spec, pending.accelerator, platform);
    settings.setKeybindings(next);
    stopEditing();
  }

  function removeKeys(spec: CommandSpec): void {
    settings.setKeybindings(withShortcut(overrides, spec, null, platform));
  }

  function resetKeys(spec: CommandSpec): void {
    settings.setKeybindings(withoutOverride(overrides, spec.id));
  }

  async function resetAll(): Promise<void> {
    const ok = await dialogs.confirm({
      title: "Reset Keyboard Shortcuts",
      message: `Restore the default keys of ${changedCount === 1 ? "1 command" : `${changedCount} commands`}?`,
      confirmLabel: "Reset All",
      danger: true,
    });
    if (ok) {
      stopEditing();
      settings.setKeybindings({});
    }
  }

  function changedTitle(row: ShortcutRow): string {
    return row.defaultText ? `Changed. Default: ${row.defaultText}` : "Changed. Default: none";
  }
</script>

<div class="toolbar">
  <div class="search">
    {#if searchByKeys}
      <input
        class="input"
        readonly
        bind:this={searchInput}
        value={searchText}
        placeholder="Press keys to search"
        aria-label="Press keys to search"
        onkeydown={onSearchKeydown}
      />
    {:else}
      <input class="input" bind:this={searchInput} bind:value={query} placeholder="Search by name or keys" aria-label="Search shortcuts" spellcheck="false" />
    {/if}
    <button
      class="btn small"
      class:on={searchByKeys}
      aria-pressed={searchByKeys}
      title="Search by pressing the keys"
      onclick={() => void toggleSearchByKeys()}
    >
      Record Keys
    </button>
  </div>
  <div class="filters">
    <label class="check">
      <input type="checkbox" bind:checked={changedOnly} />
      Changed only
    </label>
    <span class="dim count">{rows.length} commands</span>
    <button class="btn small" disabled={changedCount === 0} onclick={() => void resetAll()}>Reset All</button>
  </div>
  <div class="fixed dim">
    <kbd>{mac ? "⇧ ⇧" : "Shift Shift"}</kbd>
    <span>Search Everywhere. Pressing Shift twice is fixed.</span>
  </div>
</div>

<ul class="list" aria-label="Keyboard shortcuts">
  {#each rows as row (row.spec.id)}
    {@const editing = editingId === row.spec.id}
    <li class="item" class:editing>
      <div class="main">
        <div class="name">
          <span class="title truncate" title={row.label}>
            <span class="category">{row.spec.category}:</span>
            {row.spec.title}
          </span>
          {#if row.changed}
            <span class="changed" title={changedTitle(row)}>Changed</span>
          {/if}
          {#if row.conflicts.length > 0}
            <span class="conflict" title={`Same keys as ${row.conflicts.join(", ")}`}>
              <Icon name="alert" size={12} />
              Conflict
            </span>
          {/if}
        </div>
        {#if editing}
          <div
            class="recorder"
            tabindex="0"
            role="textbox"
            aria-label="Press the new keys"
            bind:this={recorder}
            onkeydown={onRecorderKeydown}
          >
            {pending ? pending.text : "Press keys"}
          </div>
        {:else}
          <button class="keys" title="Change the keys" onclick={() => void startEditing(row.spec)}>
            {#if row.keysText}
              <kbd>{row.keysText}</kbd>
            {:else}
              <span class="dim">None</span>
            {/if}
          </button>
        {/if}
        <div class="actions">
          {#if !editing && row.shortcut}
            <button class="icon-btn" title="Remove the keys" aria-label="Remove the keys" onclick={() => removeKeys(row.spec)}>
              <Icon name="x" size={13} />
            </button>
          {/if}
          {#if !editing && row.changed}
            <button class="icon-btn" title="Reset to the default" aria-label="Reset to the default" onclick={() => resetKeys(row.spec)}>
              <Icon name="undo" size={13} />
            </button>
          {/if}
        </div>
      </div>
      {#if editing}
        <div class="edit">
          {#if pending?.problem}
            <span class="problem">{pending.problem}</span>
          {:else if pendingConflicts.length > 0}
            <span class="problem">
              Also used by {pendingConflicts.map((spec) => `${spec.category}: ${spec.title}`).join(", ")}.
            </span>
          {:else}
            <span class="dim">{pending ? "Enter saves." : "Press the new keys."} Esc cancels.</span>
          {/if}
          <div class="edit-actions">
            {#if pendingConflicts.length > 0}
              <button class="btn small" onclick={() => save(false)}>Keep Both</button>
              <button class="btn small primary" onclick={() => save(true)}>Replace</button>
            {:else}
              <button class="btn small primary" disabled={!pending || pending.problem !== null} onclick={() => save(false)}>Save</button>
            {/if}
            <button class="btn small" onclick={stopEditing}>Cancel</button>
          </div>
        </div>
      {/if}
    </li>
  {:else}
    <li class="empty dim">No command matches.</li>
  {/each}
</ul>

<style>
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 0 10px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
  }

  .search,
  .filters,
  .fixed {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .search .input {
    flex: 1;
    min-width: 0;
  }

  .btn.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .count {
    margin-left: auto;
  }

  .fixed {
    font-size: 12px;
  }

  .list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .item {
    border-bottom: 1px solid var(--border);
  }

  .item.editing {
    background: var(--panel-alt);
  }

  .main {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 34px;
    padding: 2px 6px;
  }

  .name {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .category {
    color: var(--text-dim);
  }

  .changed,
  .conflict {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 3px;
    padding: 0 6px;
    border-radius: 9px;
    font-size: 11px;
    line-height: 18px;
  }

  .changed {
    background: var(--selected);
    color: var(--text);
  }

  .conflict {
    color: var(--warning);
    border: 1px solid var(--warning);
  }

  .keys,
  .recorder {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: flex-end;
    width: 150px;
    min-height: 26px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: none;
    color: var(--text);
    cursor: pointer;
  }

  .keys:hover {
    border-color: var(--border-strong);
  }

  .recorder {
    justify-content: center;
    border-color: var(--accent);
    background: var(--panel);
    cursor: text;
    outline: none;
  }

  .actions {
    display: flex;
    flex-shrink: 0;
    justify-content: flex-end;
    gap: 2px;
    width: 56px;
  }

  kbd {
    padding: 1px 6px;
    border: 1px solid var(--border-strong);
    border-bottom-width: 2px;
    border-radius: 5px;
    background: var(--panel-alt);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 12px;
    white-space: nowrap;
  }

  .edit {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 0 6px 8px;
    font-size: 12px;
  }

  .edit-actions {
    display: flex;
    flex-shrink: 0;
    gap: 6px;
  }

  .problem {
    color: var(--warning);
  }

  .empty {
    padding: 16px 6px;
  }
</style>
