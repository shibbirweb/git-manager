<!-- Shelf > Show Diff: one shelved file, the version it started from (left) against the
     shelved version (right), read-only. Rebuilt from the patch on the shelf. -->
<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import { joinPath } from "$lib/stores/workspacePaths";
  import DiffView from "$lib/diff/DiffView.svelte";
  import type { ShelfFileDiff } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { shelfState } from "./shelfActions.svelte";
  import { shelvedFileLabel } from "./shelfModel";

  interface Props {
    repoRoot: string;
    filePath: string;
    shelfId: string;
  }

  let { repoRoot, filePath, shelfId }: Props = $props();

  let result = $state.raw<ShelfFileDiff | null>(null);
  let loadError = $state<string | null>(null);
  let loadToken = 0;

  $effect(() => {
    // Renamed, partly unshelved or deleted shelves reload.
    void shelfState.version;
    void load(repoRoot, shelfId, filePath);
  });

  async function load(targetRoot: string, targetShelf: string, targetPath: string): Promise<void> {
    const token = ++loadToken;
    try {
      const next = await api.shelfFileDiff(targetRoot, targetShelf, targetPath);
      if (token === loadToken) {
        result = next;
        loadError = null;
      }
    } catch (error) {
      if (token === loadToken) {
        result = null;
        loadError = errorMessage(error);
      }
    }
  }
</script>

<div class="shelf-diff">
  {#if loadError}
    <div class="placeholder">
      <Icon name="alert" size={18} />
      <div>Could not show the shelved change</div>
      <div class="dim selectable">{loadError}</div>
    </div>
  {:else if result}
    {#if result.partial}
      <div class="note dim">The original of {filePath} is no longer in the repository: only the changed lines show.</div>
    {:else if result.file.oldPath && result.file.oldPath !== result.file.path}
      <div class="note dim">{shelvedFileLabel(result.file)}</div>
    {/if}
    <DiffView
      diff={result.diff}
      path={filePath}
      mode="readonly"
      leftLabel="Base"
      rightLabel="Shelved"
      workingFile={{ filePath: joinPath(repoRoot, filePath), sameLines: false }}
    />
  {:else}
    <div class="placeholder dim">Loading...</div>
  {/if}
</div>

<style>
  .shelf-diff {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--editor-bg);
  }

  .note {
    flex: none;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border-strong);
    background: var(--panel-alt);
    font-size: 12px;
  }

  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    text-align: center;
  }
</style>
