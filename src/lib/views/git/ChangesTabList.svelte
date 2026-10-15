<script lang="ts">
  // The Changes tab's file list: bulk actions, the rows with their menus, and the commit box above or below.
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { ignoreMenu } from "$lib/ignore/ignoreActions";
  import { openShelveDialog } from "$lib/shelf/shelfActions.svelte";
  import type { FileStatus, RepoInfo } from "$lib/types";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import FileRow from "@git-manager/ui/components/FileRow.svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import ListRegion from "@git-manager/ui/components/ListRegion.svelte";
  import SectionTitle from "@git-manager/ui/components/SectionTitle.svelte";
  import type { IconName } from "@git-manager/ui/icons";
  import { fileIcons } from "$lib/fileIcons/fileIcons.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import CommitBox from "../changes/CommitBox.svelte";
  import { splitPath, statusTitle } from "../changes/fileStatus";
  import { copyText, discard, stage, unstage } from "../changes/mutations";
  import { type ChangesTabAction, type ChangesTabFile, bulkTargets, fileActions, stagedState } from "./changesTab";

  interface Props {
    repoRoot: string;
    repo: RepoInfo | null;
    repoName: string;
    files: ChangesTabFile[];
    selected: ChangesTabFile | null;
    onkeydown: (event: KeyboardEvent) => void;
    onselect: (file: ChangesTabFile) => void;
    /** Open the file in an editor tab (double-click, Enter, Open File). */
    onopen: (file: ChangesTabFile) => void;
  }

  let { repoRoot, repo, repoName, files, selected, onkeydown, onselect, onopen }: Props = $props();

  let fileListEl = $state<ListRegion | null>(null);
  const busy = $derived(repoStore.busy !== null);
  const bulk = $derived(bulkTargets(files));
  const conflictCount = $derived(files.filter((file) => file.status.conflicted).length);
  /** Settings > Git > Commit box: Per repository puts the box above the files, as in the sidebar. */
  const perRepo = $derived(settings.commitBoxLayout === "perRepo");

  const actionButtons: Record<ChangesTabAction, { icon: IconName; title: string; danger?: boolean }> = {
    resolve: { icon: "merge", title: "Resolve in merge tool" },
    unstage: { icon: "minus", title: "Unstage" },
    discard: { icon: "discard", title: "Discard changes", danger: true },
    stage: { icon: "plus", title: "Stage" },
  };

  function runAction(action: ChangesTabAction, file: FileStatus): void {
    if (action === "resolve") {
      void repoStore.openMerge(file.path, repoRoot);
    } else if (action === "unstage") {
      unstage(repoRoot, [file]);
    } else if (action === "discard") {
      void discard(repoRoot, [file], repoName);
    } else {
      stage(repoRoot, [file]);
    }
  }

  function rowMenu(event: MouseEvent, file: ChangesTabFile): void {
    event.preventDefault();
    onselect(file);
    const status = file.status;
    const actions = fileActions(status);
    let items: MenuItem[];
    if (status.conflicted) {
      items = [
        { label: "Resolve in Merge Tool", action: () => void repoStore.openMerge(status.path, repoRoot) },
        { label: "Show All Conflicts...", action: () => void repoStore.openConflicts(repoRoot) },
      ];
    } else {
      items = [];
      if (actions.includes("stage")) {
        items.push({ label: "Stage", action: () => stage(repoRoot, [status]), disabled: busy });
      }
      if (actions.includes("unstage")) {
        items.push({ label: "Unstage", action: () => unstage(repoRoot, [status]), disabled: busy });
      }
      if (actions.includes("discard")) {
        items.push({
          label: "Discard Changes...",
          action: () => void discard(repoRoot, [status], repoName),
          danger: true,
          disabled: busy,
        });
      }
      if (items.length > 0) {
        items.push({ separator: true });
      }
      if (file.kind !== "deleted" && !file.submodule) {
        items.push({ label: "Open File", action: () => onopen(file) });
      }
      if (!file.submodule) {
        items.push({
          label: "Shelve Changes...",
          disabled: busy,
          action: () => openShelveDialog(repoRoot, [status.path]),
        });
      }
      const ignoreItem = ignoreMenu(repoRoot, status.path, status.path.endsWith("/"));
      if (ignoreItem) {
        items.push(ignoreItem);
      }
    }
    items.push({ separator: true }, { label: "Copy Path", action: () => copyText(status.path) });
    contextMenu.open(event, items);
  }

  function rowTitle(file: ChangesTabFile): string {
    const path = file.origPath ? `${file.origPath} -> ${file.path}` : file.path;
    const staged = stagedState(file.status);
    const note = staged === "staged" ? ", all changes staged" : staged ? ", some changes staged" : "";
    return `${statusTitle(file.kind)}: ${path}${note}`;
  }

  function rowActions(file: ChangesTabFile) {
    return fileActions(file.status).map((action) => ({
      ...actionButtons[action],
      run: () => runAction(action, file.status),
    }));
  }

  function rowId(file: ChangesTabFile): string {
    return `changes-tab-${encodeURIComponent(file.path)}`;
  }
</script>

{#if perRepo && repo}
  <!-- Commit box per repository: above the files, like the sidebar. -->
  <CommitBox
    {repo}
    stagedCount={bulk.unstage.length}
    {conflictCount}
    multiRepo={false}
    choices={[]}
    onpick={() => {}}
    placement="top"
  />
{/if}
<SectionTitle variant="list" title="Changed files" count={files.length}>
  {#snippet actions()}
    {#if bulk.unstage.length > 0}
      <IconButton
        icon="minus"
        iconSize="medium"
        size="row"
        label="Unstage all"
        onclick={() => unstage(repoRoot, bulk.unstage)}
        disabled={busy}
      />
    {/if}
    {#if bulk.discard.length > 0}
      <IconButton
        icon="discard"
        iconSize="medium"
        size="row"
        tone="dim-danger"
        label="Discard all"
        onclick={() => void discard(repoRoot, bulk.discard, repoName)}
        disabled={busy}
      />
    {/if}
    {#if bulk.stage.length > 0}
      <IconButton
        icon="plus"
        iconSize="medium"
        size="row"
        label="Stage all"
        onclick={() => stage(repoRoot, bulk.stage)}
        disabled={busy}
      />
    {/if}
  {/snippet}
</SectionTitle>
<ListRegion label="Changed files" activeId={selected ? rowId(selected) : undefined} {onkeydown} bind:this={fileListEl}>
  {#each files as file (file.path)}
    {@const parts = splitPath(file.path)}
    {@const staged = stagedState(file.status)}
    <FileRow
      kind={file.kind}
      name={parts.name}
      directory={parts.directory}
      badge={staged ?? ""}
      icon={fileIcons.resolve?.(parts.name) ?? null}
      variant="list"
      selected={file.path === selected?.path}
      id={rowId(file)}
      title={rowTitle(file)}
      keepFocus
      actions={rowActions(file)}
      onselect={() => {
        onselect(file);
        fileListEl?.focus();
      }}
      onactivate={() => onopen(file)}
      oncontextmenu={(event) => rowMenu(event, file)}
    />
  {:else}
    <EmptyState titleTone="dim" title="No uncommitted changes" />
  {/each}
</ListRegion>
<!-- The sidebar's commit box: the draft is kept per repository, so both show the same message. -->
{#if !perRepo && repo}
  <CommitBox
    {repo}
    stagedCount={bulk.unstage.length}
    {conflictCount}
    multiRepo={false}
    choices={[]}
    onpick={() => {}}
  />
{/if}
