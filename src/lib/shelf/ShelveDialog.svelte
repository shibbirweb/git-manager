<!-- JetBrains' Shelve Changes: a name, the changed files with checkboxes (staged, unstaged and new
     files) and "Keep changes in the working tree". The changes are saved as a patch on the shelf,
     then taken out of the work tree unless kept. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import GitDialogFrame from "$lib/views/git/GitDialogFrame.svelte";
  import { gitDialogs } from "$lib/views/git/gitDialogs.svelte";
  import { shelveFiles } from "./shelfActions.svelte";
  import { defaultShelfName, shelveCandidates, statusLetter } from "./shelfModel";

  interface Props {
    repoRoot: string;
    /** Files to start with ticked; null ticks every one. */
    filePaths: string[] | null;
  }

  let { repoRoot, filePaths }: Props = $props();

  const candidates = $derived(shelveCandidates(repoStore.statuses[repoRoot]?.files ?? []));
  const conflicted = $derived((repoStore.statuses[repoRoot]?.files ?? []).filter((file) => file.conflicted).length);
  let checked = $state<Record<string, boolean>>(
    untrack(() =>
      Object.fromEntries(
        candidates.map((file) => [
          file.path,
          filePaths === null || filePaths.includes(file.path) || (file.origPath !== null && filePaths.includes(file.origPath)),
        ]),
      ),
    ),
  );
  let name = $state(untrack(() => defaultShelfName(repoStore.statuses[repoRoot]?.head.branch ?? null, new Date())));
  let keepInWorkingTree = $state(false);

  const selected = $derived(candidates.filter((file) => checked[file.path] ?? false));
  const allChecked = $derived(candidates.length > 0 && selected.length === candidates.length);
  const canSubmit = $derived(selected.length > 0 && name.trim() !== "" && repoStore.busy === null);

  function toggleAll(): void {
    const next = !allChecked;
    checked = Object.fromEntries(candidates.map((file) => [file.path, next]));
  }

  function close(): void {
    gitDialogs.close();
  }

  async function submit(): Promise<void> {
    if (!canSubmit) {
      return;
    }
    const paths = selected.flatMap((file) => (file.origPath ? [file.path, file.origPath] : [file.path]));
    const shelfName = name.trim();
    const keep = keepInWorkingTree;
    close();
    await shelveFiles(repoRoot, shelfName, paths, keep);
  }
</script>

<GitDialogFrame title="Shelve Changes" width={580} onCancel={close} onSubmit={() => void submit()}>
  <label class="field">
    <span>Name</span>
    <input class="input" bind:value={name} spellcheck="false" autocomplete="off" data-autofocus />
  </label>
  {#if candidates.length === 0}
    <p class="dim">There are no changes to shelve.</p>
  {:else}
    <label class="check all">
      <input type="checkbox" checked={allChecked} onchange={toggleAll} />
      {selected.length} of {candidates.length} {candidates.length === 1 ? "file" : "files"}
    </label>
    <div class="files" role="list">
      {#each candidates as file (file.path)}
        <label class="file" role="listitem" title={file.origPath ? `${file.origPath} -> ${file.path}` : file.path}>
          <input type="checkbox" bind:checked={checked[file.path]} />
          <span class="letter mono">{statusLetter(file)}</span>
          <span class="path truncate">{file.path}</span>
          {#if file.unstaged === "untracked" && !file.staged}
            <span class="hint">new</span>
          {:else if file.staged && file.unstaged}
            <span class="hint">staged and unstaged</span>
          {:else if file.staged}
            <span class="hint">staged</span>
          {/if}
        </label>
      {/each}
    </div>
  {/if}
  {#if conflicted > 0}
    <p class="hint">{conflicted === 1 ? "1 conflicted file is" : `${conflicted} conflicted files are`} left out: resolve conflicts first.</p>
  {/if}
  <label class="check">
    <input type="checkbox" bind:checked={keepInWorkingTree} /> Keep changes in the working tree
  </label>

  {#snippet footer()}
    <button type="button" class="btn" onclick={close}>Cancel</button>
    <button type="button" class="btn primary" disabled={!canSubmit} onclick={() => void submit()}>Shelve</button>
  {/snippet}
</GitDialogFrame>

<style>
  .files {
    display: flex;
    flex-direction: column;
    max-height: 300px;
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
