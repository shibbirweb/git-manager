<!-- Shelf > Show Diff: one shelved file, the version it started from (left) against the
     shelved version (right), read-only. Rebuilt from the patch on the shelf. -->
<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import { joinPath } from "$lib/stores/workspacePaths";
  import GitDiffView from "$lib/diff/GitDiffView.svelte";
  import type { ShelfFileDiff } from "$lib/types";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Notice from "@git-manager/ui/components/Notice.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
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

<Stack gap="none" grow surface="editor">
  {#if loadError}
    <EmptyState icon="alert" title="Could not show the shelved change" hint={loadError} />
  {:else if result}
    {#if result.partial}
      <Notice variant="banner">
        The original of {filePath} is no longer in the repository: only the changed lines show.
      </Notice>
    {:else if result.file.oldPath && result.file.oldPath !== result.file.path}
      <Notice variant="banner">{shelvedFileLabel(result.file)}</Notice>
    {/if}
    <GitDiffView
      source={{ kind: "plain" }}
      diff={result.diff}
      path={filePath}
      labels={{ left: "Base", right: "Shelved" }}
      workingFile={{ filePath: joinPath(repoRoot, filePath), sameLines: false }}
    />
  {:else}
    <EmptyState title="Loading..." delayed />
  {/if}
</Stack>
