<!-- The "Conflicts" list: pick a side per file or open the merge tool. -->
<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { ConflictFile, ConflictSummary, FileConflictKind, Side } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Button from "@nibtree/ui/components/Button.svelte";
  import Dialog from "@nibtree/ui/components/Dialog.svelte";
  import EmptyState from "@nibtree/ui/components/EmptyState.svelte";
  import Icon from "@nibtree/ui/components/Icon.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Table from "@nibtree/ui/components/Table.svelte";
  import Tag from "@nibtree/ui/components/Tag.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import type { DataColumn } from "@nibtree/ui/logic/table";

  let summary = $state.raw<ConflictSummary | null>(null);
  let loadError = $state<string | null>(null);
  let selected = $state<string[]>([]);
  /** The row picked last: arrows move from it. */
  let current = $state<string | null>(null);
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
        current = next.files[0].path;
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
    const outcome = await repoStore.runOp(
      "Continue",
      (repoPath) => api.continueOperation(repoPath),
      "Operation completed",
    );
    if (outcome && !outcome.conflicts) {
      repoStore.conflictsOpen = false;
    }
  }

  function close(): void {
    repoStore.conflictsOpen = false;
  }

  /** Up and Down move through the files, Enter merges the one selected; Esc is the dialog's. */
  function onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || dialogs.active || files.length === 0) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const at = files.findIndex((file) => file.path === (current ?? selected[0]));
      const next = Math.max(0, Math.min(files.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)));
      selected = [files[next].path];
      current = files[next].path;
    } else if (event.key === "Enter" && canMerge) {
      event.preventDefault();
      openMerge(single);
    }
  }

  const columns = $derived<DataColumn[]>([
    { id: "name", label: "Name", width: "fill" },
    { id: "ours", label: summary?.op.oursLabel ?? "Yours", width: "side" },
    { id: "theirs", label: summary?.op.theirsLabel ?? "Theirs", width: "side" },
  ]);

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

<Dialog
  open
  variant="panel"
  width="xlarge"
  title="Conflicts"
  subtitle={summary && summary.op.kind !== "none" ? summary.op.description : ""}
  onclose={close}
>
  {#if loadError}
    <Text tone="danger" selectable element="p">{loadError}</Text>
  {:else if summary && files.length === 0}
    <EmptyState icon="check" iconStyle="circle" iconTone="success" title="All conflicts are resolved.">
      {#snippet action()}
        {#if summary && summary.op.kind !== "none" && summary.op.kind !== "other"}
          <Button variant="primary" onclick={continueOp}>Continue {opLabel}</Button>
        {/if}
      {/snippet}
    </EmptyState>
  {:else}
    <Table
      {columns}
      rows={files}
      rowKey={(file) => file.path}
      label="Conflicted files"
      multiple
      bind:selection={selected}
      bind:selected={current}
      onopen={(file) => !file.binary && openMerge(file)}
    >
      {#snippet cell(file, column)}
        {#if column.id === "name"}
          {@const slash = file.path.lastIndexOf("/")}
          <Stack direction="row" gap="sm" align="center">
            <Icon name="file" size="medium" />
            <Text truncate>{slash >= 0 ? file.path.slice(slash + 1) : file.path}</Text>
            {#if slash >= 0}<Text tone="dim" truncate>{file.path.slice(0, slash)}</Text>{/if}
            {#if file.binary}<Tag size="small">binary</Tag>{/if}
          </Stack>
        {:else}
          {@const status = sideStatus(file.kind, column.id === "ours" ? "ours" : "theirs")}
          <Text tone={status === "Deleted" ? "danger" : "dim"}>{status}</Text>
        {/if}
      {/snippet}
    </Table>
  {/if}
  {#snippet footnote()}
    {#if files.length > 0}
      <Text size="small" tone="dim"
        >Double-click a file to merge it. Cmd-click or Shift-click selects several files.</Text
      >
    {/if}
  {/snippet}
  {#snippet actions()}
    {#if files.length > 0}
      <Button onclick={() => accept("ours")} disabled={selectedFiles.length === 0}>Accept Yours</Button>
      <Button onclick={() => accept("theirs")} disabled={selectedFiles.length === 0}>Accept Theirs</Button>
      <Button variant="primary" onclick={() => openMerge(single)} disabled={!canMerge}>Merge...</Button>
    {/if}
  {/snippet}
</Dialog>
