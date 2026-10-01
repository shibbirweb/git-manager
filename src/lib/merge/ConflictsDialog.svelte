<!-- JetBrains-style "Conflicts" list: pick a side per file or open the merge tool. -->
<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { ConflictFile, ConflictSummary, FileConflictKind, Side } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";

  let summary = $state.raw<ConflictSummary | null>(null);
  let loadError = $state<string | null>(null);
  let selected = $state<string[]>([]);
  let anchor = $state<string | null>(null);
  let requestId = 0;

  // Reload whenever the repository status changes (resolutions, watcher events).
  $effect(() => {
    void repoStore.status;
    void refresh();
  });

  async function refresh(): Promise<void> {
    if (!repoStore.repo) {
      return;
    }
    const request = ++requestId;
    try {
      const next = await api.listConflicts(repoStore.repo.root);
      if (request !== requestId) {
        return;
      }
      summary = next;
      loadError = null;
      const paths = new Set(next.files.map((file) => file.path));
      selected = selected.filter((path) => paths.has(path));
      if (selected.length === 0 && next.files.length > 0) {
        selected = [next.files[0].path];
        anchor = next.files[0].path;
      }
    } catch (error) {
      loadError = errorMessage(error);
    }
  }

  const files = $derived(summary?.files ?? []);
  const selectedFiles = $derived(files.filter((file) => selected.includes(file.path)));
  const single = $derived(selectedFiles.length === 1 ? selectedFiles[0] : null);
  const canMerge = $derived(single !== null && !single.binary);

  function sideStatus(kind: FileConflictKind, side: Side): string {
    if (kind === "bothAdded") {
      return "Added";
    }
    if ((kind === "deletedByUs" && side === "ours") || (kind === "deletedByThem" && side === "theirs")) {
      return "Deleted";
    }
    return "Modified";
  }

  function select(file: ConflictFile, event: MouseEvent): void {
    if (event.metaKey || event.ctrlKey) {
      selected = selected.includes(file.path)
        ? selected.filter((path) => path !== file.path)
        : [...selected, file.path];
      anchor = file.path;
      return;
    }
    if (event.shiftKey && anchor) {
      const from = files.findIndex((item) => item.path === anchor);
      const to = files.findIndex((item) => item.path === file.path);
      const [low, high] = from < to ? [from, to] : [to, from];
      selected = files.slice(low, high + 1).map((item) => item.path);
      return;
    }
    selected = [file.path];
    anchor = file.path;
  }

  function openMerge(file: ConflictFile | null): void {
    if (file) {
      repoStore.openMerge(file.path);
    }
  }

  async function accept(side: Side): Promise<void> {
    const paths = selectedFiles.map((file) => file.path);
    if (paths.length === 0) {
      return;
    }
    const label = side === "ours" ? "Accept yours" : "Accept theirs";
    await repoStore.run(label, (repoPath) => api.acceptSide(repoPath, paths, side), {
      success: paths.length === 1 ? `Resolved ${paths[0]}` : `Resolved ${paths.length} files`,
    });
  }

  async function continueOp(): Promise<void> {
    const outcome = await repoStore.runOp("Continue", (repoPath) => api.continueOperation(repoPath), "Operation completed");
    if (outcome && !outcome.conflicts) {
      repoStore.conflictsOpen = false;
    }
  }

  function close(): void {
    repoStore.conflictsOpen = false;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || dialogs.active) {
      return;
    }
    if (event.key === "Escape") {
      close();
      return;
    }
    if (files.length === 0) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const current = files.findIndex((file) => file.path === (anchor ?? selected[0]));
      const next = Math.max(0, Math.min(files.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
      selected = [files[next].path];
      anchor = files[next].path;
    } else if (event.key === "Enter" && canMerge) {
      event.preventDefault();
      openMerge(single);
    }
  }

  const opLabel = $derived.by(() => {
    switch (summary?.op.kind) {
      case "merge":
        return "Merge";
      case "rebase":
        return "Rebase";
      case "cherryPick":
        return "Cherry-Pick";
      case "revert":
        return "Revert";
      default:
        return "Operation";
    }
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="overlay" role="presentation" onmousedown={(event) => event.target === event.currentTarget && close()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="conflicts-title">
    <div class="head">
      <h2 id="conflicts-title">Conflicts</h2>
      {#if summary && summary.op.kind !== "none"}
        <span class="dim truncate">{summary.op.description}</span>
      {/if}
      <div class="spacer"></div>
      <button class="icon-btn" onclick={close} aria-label="Close"><Icon name="x" size={15} /></button>
    </div>

    {#if loadError}
      <p class="error selectable">{loadError}</p>
    {:else if summary && files.length === 0}
      <div class="done">
        <div class="done-icon"><Icon name="check" size={22} /></div>
        <p>All conflicts are resolved.</p>
        {#if summary.op.kind !== "none" && summary.op.kind !== "other"}
          <button class="btn primary" onclick={continueOp}>Continue {opLabel}</button>
        {/if}
      </div>
    {:else}
      <div class="body">
        <div class="table" role="listbox" aria-multiselectable="true" tabindex="-1">
          <div class="row header">
            <span class="name">Name</span>
            <span class="side truncate" title={summary?.op.oursLabel}>{summary?.op.oursLabel ?? "Yours"}</span>
            <span class="side truncate" title={summary?.op.theirsLabel}>{summary?.op.theirsLabel ?? "Theirs"}</span>
          </div>
          {#each files as file (file.path)}
            {@const slash = file.path.lastIndexOf("/")}
            <div
              class="row item"
              class:selected={selected.includes(file.path)}
              role="option"
              aria-selected={selected.includes(file.path)}
              tabindex="-1"
              onclick={(event) => select(file, event)}
              ondblclick={() => !file.binary && openMerge(file)}
              onkeydown={() => undefined}
            >
              <span class="name truncate">
                <Icon name="file" size={13} />
                <span class="file">{slash >= 0 ? file.path.slice(slash + 1) : file.path}</span>
                {#if slash >= 0}
                  <span class="dir dim">{file.path.slice(0, slash)}</span>
                {/if}
                {#if file.binary}
                  <span class="tag">binary</span>
                {/if}
              </span>
              <span class="side" class:deleted={sideStatus(file.kind, "ours") === "Deleted"}>{sideStatus(file.kind, "ours")}</span>
              <span class="side" class:deleted={sideStatus(file.kind, "theirs") === "Deleted"}>
                {sideStatus(file.kind, "theirs")}
              </span>
            </div>
          {/each}
        </div>
        <div class="actions">
          <button class="btn" onclick={() => accept("ours")} disabled={selectedFiles.length === 0}>Accept Yours</button>
          <button class="btn" onclick={() => accept("theirs")} disabled={selectedFiles.length === 0}>Accept Theirs</button>
          <button class="btn primary" onclick={() => openMerge(single)} disabled={!canMerge}>Merge...</button>
        </div>
      </div>
      <p class="footnote dim">Double-click a file to merge it. Cmd-click or Shift-click selects several files.</p>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 400;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 9vh;
    background: var(--overlay);
  }

  .dialog {
    width: min(760px, calc(100vw - 32px));
    max-height: 78vh;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    box-shadow: var(--shadow);
    padding: 14px 16px 12px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  h2 {
    margin: 0;
    font-size: 14px;
  }

  .spacer {
    flex: 1;
  }

  .body {
    display: flex;
    gap: 12px;
    min-height: 0;
  }

  .table {
    flex: 1;
    min-width: 0;
    overflow: auto;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    outline: none;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 130px 130px;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    height: 28px;
  }

  .row.header {
    position: sticky;
    top: 0;
    background: var(--panel-alt);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
    border-bottom: 1px solid var(--border-strong);
  }

  .row.item {
    cursor: default;
  }

  .row.item:hover {
    background: var(--hover);
  }

  .row.item.selected {
    background: var(--selected);
  }

  .name {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .file {
    font-weight: 500;
  }

  .dir {
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tag {
    padding: 0 5px;
    border-radius: 4px;
    background: var(--hover);
    font-size: 11px;
    color: var(--text-dim);
  }

  .side {
    font-size: 12px;
  }

  .side.deleted {
    color: var(--danger);
  }

  .actions {
    flex: none;
    width: 140px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .actions .btn {
    justify-content: center;
  }

  .footnote {
    margin: 10px 0 0;
    font-size: 12px;
  }

  .done {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 24px 0 16px;
  }

  .done p {
    margin: 0;
  }

  .done-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--success) 18%, transparent);
    color: var(--success);
  }

  .error {
    color: var(--danger);
    white-space: pre-wrap;
  }
</style>
