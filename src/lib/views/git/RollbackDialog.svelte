<!-- Rollback Changes: the changed tracked files with checkboxes; their staged and
     unstaged changes go back to HEAD. New files are removed from Git, and deleted when asked. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { api } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { FileStatus } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import GitDialogFrame from "./GitDialogFrame.svelte";
  import { gitDialogs } from "./gitDialogs.svelte";
  import { addedFiles, rollbackCandidates, rollbackPaths } from "./gitOptions";

  interface Props {
    repoRoot: string;
    /** Files to start with ticked; null ticks every one. */
    filePaths: string[] | null;
  }

  let { repoRoot, filePaths }: Props = $props();

  const candidates = $derived(rollbackCandidates(repoStore.statuses[repoRoot]?.files ?? []));
  let checked = $state<Record<string, boolean>>(
    untrack(() => Object.fromEntries(candidates.map((file) => [file.path, filePaths === null || filePaths.includes(file.path)]))),
  );
  let deleteAdded = $state(false);

  const selected = $derived(candidates.filter((file) => checked[file.path] ?? false));
  const selectedAdded = $derived(addedFiles(selected));
  const allChecked = $derived(candidates.length > 0 && selected.length === candidates.length);

  function letter(file: FileStatus): string {
    const kind = file.staged ?? file.unstaged;
    switch (kind) {
      case "added":
        return "A";
      case "deleted":
        return "D";
      case "renamed":
        return "R";
      case "typechange":
        return "T";
      default:
        return "M";
    }
  }

  function toggleAll(): void {
    const next = !allChecked;
    checked = Object.fromEntries(candidates.map((file) => [file.path, next]));
  }

  function close(): void {
    gitDialogs.close();
  }

  async function submit(): Promise<void> {
    const files = selected;
    if (files.length === 0 || repoStore.busy !== null) {
      return;
    }
    const parts = [
      files.length === 1 ? `Changes to ${files[0].path} will be lost.` : `Changes to ${files.length} files will be lost.`,
    ];
    const added = selectedAdded.length;
    if (added > 0) {
      parts.push(
        deleteAdded
          ? `${added === 1 ? "1 new file" : `${added} new files`} will be deleted.`
          : `${added === 1 ? "1 new file stays" : `${added} new files stay`} on disk, untracked.`,
      );
    }
    parts.push("This cannot be undone.");
    const confirmed = await dialogs.confirm({
      title: "Rollback Changes",
      message: parts.join(" "),
      confirmLabel: "Rollback",
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    const paths = rollbackPaths(files);
    const remove = deleteAdded;
    close();
    await repoStore.run("Rollback", (repoPath) => api.rollbackFiles(repoPath, paths, remove), {
      repoPath: repoRoot,
      success: files.length === 1 ? `Rolled back ${files[0].path}` : `Rolled back ${files.length} files`,
    });
  }
</script>

<GitDialogFrame title="Rollback Changes" width={560} onCancel={close} onSubmit={() => void submit()}>
  {#if candidates.length === 0}
    <p class="dim">There are no changes to tracked files.</p>
  {:else}
    <label class="check all">
      <input type="checkbox" checked={allChecked} onchange={toggleAll} data-autofocus />
      {selected.length} of {candidates.length} {candidates.length === 1 ? "file" : "files"}
    </label>
    <div class="files" role="list">
      {#each candidates as file (file.path)}
        <label class="file" role="listitem" title={file.origPath ? `${file.origPath} -> ${file.path}` : file.path}>
          <input type="checkbox" bind:checked={checked[file.path]} />
          <span class="letter mono">{letter(file)}</span>
          <span class="path truncate">{file.path}</span>
          {#if file.staged && file.unstaged}
            <span class="hint">staged and unstaged</span>
          {:else if file.staged}
            <span class="hint">staged</span>
          {/if}
        </label>
      {/each}
    </div>
    {#if selectedAdded.length > 0}
      <label class="check"><input type="checkbox" bind:checked={deleteAdded} /> Delete local copies of added files</label>
    {/if}
  {/if}

  {#snippet footer()}
    <button type="button" class="btn" onclick={close}>Cancel</button>
    <button type="button" class="btn primary danger-fill" disabled={selected.length === 0 || repoStore.busy !== null} onclick={() => void submit()}>
      Rollback
    </button>
  {/snippet}
</GitDialogFrame>

<style>
  .files {
    display: flex;
    flex-direction: column;
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--editor-bg);
    padding: 2px 0;
  }

  .file {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 10px;
    min-width: 0;
  }

  .file:hover {
    background: var(--hover);
  }

  .letter {
    width: 12px;
    color: var(--text-dim);
    font-size: 11.5px;
  }

  .path {
    flex: 1;
    min-width: 0;
  }
</style>
