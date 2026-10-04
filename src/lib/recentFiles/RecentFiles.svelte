<!--
  Recent Files (Cmd+E): the files shown in the editor, most recent first, with
  the one before the file on screen selected, so Cmd+E then Enter goes back to it. Typing
  filters the list, Cmd+E again shows the edited files only and Delete takes a file off the
  list. Mounted only while open (Workspace.svelte); the list lives in recentFilesStore.svelte.ts.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { currentPlatform, shortcutFor } from "$lib/commands/commandRuntime";
  import { formatAccelerator, matchesAccelerator } from "$lib/commands/keybinding";
  import FileTypeIcon from "$lib/fileIcons/FileTypeIcon.svelte";
  import { moveSelection } from "$lib/search/fileSearchModel";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { repoTones, type RepoTones, workspaceTones } from "$lib/views/files/tones";
  import { initialRecentSelection, recentFileRows, type RecentRow } from "./recentFilesModel";
  import { recentFilesStore } from "./recentFilesStore.svelte";

  /** Rows moved by Page Up / Page Down. */
  const PAGE = 10;

  const platform = currentPlatform();
  const mac = platform === "macos";
  /** The key that opened the popup; pressed again it switches to the edited files. */
  const ownKey = shortcutFor("edit.recentFiles");
  const ownKeyLabel = ownKey ? formatAccelerator(ownKey, platform) : null;
  /** Read once: the file on screen when the popup opened. */
  const activePath = untrack(() => repoStore.openFilePath);

  let input = $state<HTMLInputElement | null>(null);
  let list = $state<HTMLDivElement | null>(null);
  let query = $state("");
  let editedOnly = $state(false);
  let selected = $state(0);
  /** After Delete: the row to stay on when the list comes back shorter. */
  let keepIndex: number | null = null;

  const folders = $derived(repoStore.workspace?.folders ?? []);
  const rows = $derived(recentFileRows(recentFilesStore.files, folders, query, editedOnly));

  /** Git status colors, as in the Files panel. */
  const tones = $derived.by(() => {
    const perRepo: RepoTones[] = [];
    for (const repo of repoStore.repos) {
      const status = repoStore.statuses[repo.root];
      if (status) {
        perRepo.push(repoTones(status, repo.root));
      }
    }
    return workspaceTones(perRepo);
  });

  const title = $derived(editedOnly ? "Recently Edited Files" : "Recent Files");

  const emptyMessage = $derived.by(() => {
    if (query.trim() !== "") {
      return "No recent files match";
    }
    return editedOnly ? "No edited files yet" : "No recent files yet. Files you open show up here.";
  });

  onMount(() => {
    input?.focus();
    return () => recentFilesStore.release();
  });

  // A new query or list starts on its first row (on an empty query, the file before the one on screen).
  $effect(() => {
    const next = rows;
    const text = query;
    untrack(() => {
      selected = keepIndex !== null ? Math.min(keepIndex, Math.max(0, next.length - 1)) : initialRecentSelection(next, activePath, text);
      keepIndex = null;
    });
  });

  // Keep the selected row visible.
  $effect(() => {
    const index = selected;
    untrack(() => {
      list?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
    });
  });

  function cancel(): void {
    recentFilesStore.close();
    recentFilesStore.restoreFocus();
  }

  /** `toSide` (Cmd+Enter) opens it in the other editor group, as in Quick Open. */
  async function open(row: RecentRow, toSide = false): Promise<void> {
    const filePath = row.file.path;
    recentFilesStore.close();
    if (!(await navigation.fileExists(filePath))) {
      recentFilesStore.remove(filePath);
      recentFilesStore.restoreFocus();
      toast.info("File not found", `${row.file.name} no longer exists and was taken off Recent Files.`);
      return;
    }
    await navigation.openFileAt(filePath, null, null, { pin: true, toSide });
  }

  /** Delete: takes the file off the list; the same place stays selected. */
  function remove(index: number): void {
    const row = rows[index];
    if (!row) {
      return;
    }
    keepIndex = index;
    recentFilesStore.remove(row.file.path);
    input?.focus();
  }

  function toggleEdited(): void {
    editedOnly = !editedOnly;
    input?.focus();
  }

  /** Delete removes a row only when it would not delete text in the field. */
  function deletesRow(event: KeyboardEvent): boolean {
    if (event.key === "Delete" && !event.altKey && !event.shiftKey) {
      const field = input;
      return field === null || (field.selectionStart === field.value.length && field.selectionEnd === field.value.length);
    }
    // Cmd+Backspace on a Mac keyboard without a Delete key, when there is nothing to erase.
    return mac && event.key === "Backspace" && event.metaKey && query === "";
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.isComposing) {
      return;
    }
    const ctrlOnly = event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
    let step = 0;
    if (event.key === "ArrowDown" || (ctrlOnly && event.key === "n")) {
      step = 1;
    } else if (event.key === "ArrowUp" || (ctrlOnly && event.key === "p")) {
      step = -1;
    } else if (event.key === "PageDown") {
      step = PAGE;
    } else if (event.key === "PageUp") {
      step = -PAGE;
    }
    if (step !== 0) {
      event.preventDefault();
      event.stopPropagation();
      selected = moveSelection(selected, rows.length, step);
      return;
    }
    if (ownKey !== null && matchesAccelerator(event, ownKey, platform)) {
      event.preventDefault();
      event.stopPropagation();
      toggleEdited();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const row = rows[selected];
      if (row) {
        void open(row, mac ? event.metaKey : event.ctrlKey);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (deletesRow(event) && rows.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      remove(selected);
      return;
    }
    if (event.key === "Tab") {
      // Keeps the focus in the field.
      event.preventDefault();
      event.stopPropagation();
    }
  }
</script>

<!-- Clicking anywhere outside the popup closes it. -->
<div class="backdrop" role="presentation" onmousedown={cancel}></div>

<div class="popup" role="dialog" aria-label={title}>
  <div class="head">
    <span class="title">{title}</span>
    <button
      class="toggle"
      class:on={editedOnly}
      type="button"
      aria-pressed={editedOnly}
      title="Show only the files edited in the app"
      onmousedown={(event) => event.preventDefault()}
      onclick={toggleEdited}
    >
      {#if editedOnly}
        <Icon name="check" size={12} />
      {/if}
      Edited only
      {#if ownKeyLabel}
        <kbd>{ownKeyLabel}</kbd>
      {/if}
    </button>
  </div>
  <div class="field">
    <Icon name="search" size={14} />
    <input
      bind:this={input}
      bind:value={query}
      class="query"
      type="text"
      placeholder="Type to filter"
      spellcheck="false"
      autocomplete="off"
      aria-label="Filter recent files"
      onkeydown={onKeydown}
    />
  </div>
  <div class="list" role="listbox" aria-label={title} bind:this={list}>
    {#each rows as row, index (row.file.path)}
      {@const tone = tones.tone(row.file.path) ?? ""}
      {@const dirty = repoStore.isDirty(row.file.path)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="row {tone}"
        class:selected={index === selected}
        role="option"
        tabindex="-1"
        aria-selected={index === selected}
        data-index={index}
        title={row.file.path}
        onmousemove={() => (selected = index)}
        onmousedown={(event) => event.preventDefault()}
        onclick={() => void open(row)}
      >
        <FileTypeIcon fileName={row.file.name} />
        <span class="name"
          >{#each row.file.nameParts as part, partIndex (partIndex)}{#if part.match}<b>{part.text}</b>{:else}{part.text}{/if}{/each}</span
        >
        {#if dirty}
          <span class="dirty" title="Unsaved changes"></span>
        {/if}
        <span class="folder"
          >{#each row.file.folderParts as part, partIndex (partIndex)}{#if part.match}<b>{part.text}</b>{:else}{part.text}{/if}{/each}</span
        >
        <button
          class="remove"
          type="button"
          title="Remove from Recent Files"
          aria-label="Remove {row.file.name} from Recent Files"
          onclick={(event) => {
            event.stopPropagation();
            remove(index);
          }}
        >
          <Icon name="x" size={12} />
        </button>
      </div>
    {:else}
      <div class="message">{emptyMessage}</div>
    {/each}
  </div>
  <div class="hints">
    <span><kbd>Enter</kbd> open</span>
    <span><kbd>{mac ? "⌘" : "Ctrl+"}Enter</kbd> open to the side</span>
    <span><kbd>{mac ? "⌘⌫" : "Delete"}</kbd> remove</span>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 880;
  }

  .popup {
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 885;
    width: min(560px, calc(100vw - 32px));
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px 6px 12px;
    border-bottom: 1px solid var(--border-strong);
  }

  .title {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toggle {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .toggle:hover {
    background: var(--selected);
  }

  .toggle.on {
    color: var(--accent);
    border-color: var(--accent);
  }

  .field {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 34px;
    color: var(--text-dim);
    border-bottom: 1px solid var(--border-strong);
  }

  .query {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
  }

  .query::placeholder {
    color: var(--text-faint);
  }

  .list {
    max-height: min(468px, 60vh);
    overflow-y: auto;
    padding: 4px;
  }

  .row,
  .message {
    height: 26px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px 0 8px;
    border-radius: 4px;
    color: var(--text-dim);
  }

  .row {
    cursor: pointer;
  }

  .row.selected {
    background: var(--selected);
  }

  .message {
    color: var(--text-faint);
  }

  .name {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
    color: var(--text);
  }

  .row.modified .name {
    color: var(--accent);
  }

  .row.added .name {
    color: var(--success);
  }

  .row.conflict .name,
  .row.deleted .name {
    color: var(--danger);
  }

  .dirty {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-dim);
  }

  .folder {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
    text-align: right;
    font-size: 12px;
    color: var(--text-faint);
  }

  .remove {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    visibility: hidden;
  }

  .row:hover .remove,
  .row.selected .remove {
    visibility: visible;
  }

  .remove:hover {
    color: var(--text);
    background: var(--border-strong);
  }

  .hints {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    padding: 5px 12px;
    border-top: 1px solid var(--border-strong);
    font-size: 11.5px;
    color: var(--text-faint);
  }

  kbd {
    padding: 0 5px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--panel-alt);
    color: var(--text-dim);
    font-family: var(--font-ui);
    font-size: 11px;
    line-height: 16px;
    white-space: nowrap;
  }

  b {
    font-weight: 600;
    color: var(--accent);
  }
</style>
