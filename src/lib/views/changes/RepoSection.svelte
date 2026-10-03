<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { FileStatus } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import FileRow from "./FileRow.svelte";
  import { kindIn, rowElementId, sameSelection, type FileSelection, type GroupId, type RowAction } from "./fileStatus";
  import { changesLayout } from "./layout.svelte";
  import { activate, copyText, discard, stage, unstage } from "./mutations";
  import RepoActions from "./RepoActions.svelte";
  import { repoMenuFor } from "./repoActions";
  import { ignoreMenu } from "$lib/ignore/ignoreActions";
  import { openShelveDialog } from "$lib/shelf/shelfActions.svelte";
  import { branchLabel, opLabel, showRelativePath, type RepoSection } from "./sections";
  import { lfsFileSet } from "../git/lfs/lfsModel";
  import { lfsStore } from "../git/lfs/lfsStore.svelte";
  import { submoduleEntryItems } from "../git/submodules/submoduleActions";
  import { describeSubmoduleChange, isSubmoduleEntry } from "../git/submodules/submoduleModel";

  interface Props {
    section: RepoSection;
    /** Several repositories are shown: render the repository header and indent the groups. */
    multiRepo: boolean;
    active: boolean;
    /** The selection when it belongs to this repository, else null. */
    selected: FileSelection | null;
    onselect: (selection: FileSelection) => void;
  }

  let { section, multiRepo, active, selected, onselect }: Props = $props();

  const repo = $derived(section.repo);
  const repoRoot = $derived(section.repo.root);
  const head = $derived(section.status?.head ?? null);
  const branch = $derived(branchLabel(head));
  const operation = $derived(opLabel(section.status?.op?.kind));
  const busy = $derived(repoStore.busy !== null);
  const collapsed = $derived(multiRepo && changesLayout.isRepoCollapsed(repoRoot));
  /** Repository named in dialogs when several are shown. */
  const dialogName = $derived(multiRepo ? repo.name : null);
  const lfsFiles = $derived(lfsFileSet(lfsStore.statuses[repoRoot]));

  // LFS files for the "LFS" badges, checked again when HEAD, the index or entries change.
  $effect(() => {
    lfsStore.follow(repoRoot, repoStore.treeVersions[repoRoot] ?? 0);
  });

  function rowBadge(file: FileStatus): string | null {
    if (isSubmoduleEntry(file)) {
      return "submodule";
    }
    return lfsFiles.has(file.path) ? "LFS" : null;
  }

  function rowNote(file: FileStatus, group: GroupId): string | null {
    return group === "unstaged" ? describeSubmoduleChange(file.submodule) || null : null;
  }

  function rowSelection(file: FileStatus, group: GroupId): FileSelection {
    return { repoRoot, path: file.path, area: group === "staged" ? "staged" : "unstaged" };
  }

  function rowActions(file: FileStatus, group: GroupId): RowAction[] {
    if (group === "conflicts") {
      return [
        { icon: "merge", title: "Resolve in merge tool", run: () => void repoStore.openMerge(file.path, repoRoot) },
      ];
    }
    if (group === "staged") {
      return [{ icon: "minus", title: "Unstage", run: () => unstage(repoRoot, [file]) }];
    }
    // Discarding does not apply to a submodule: Update (in its menu) checks out the recorded commit.
    if (isSubmoduleEntry(file)) {
      return [{ icon: "plus", title: "Stage", run: () => stage(repoRoot, [file]) }];
    }
    return [
      {
        icon: "discard",
        title: "Discard changes",
        run: () => void discard(repoRoot, [file], dialogName),
        danger: true,
      },
      { icon: "plus", title: "Stage", run: () => stage(repoRoot, [file]) },
    ];
  }

  function rowMenu(event: MouseEvent, file: FileStatus, group: GroupId): void {
    let items: MenuItem[];
    if (group === "conflicts") {
      items = [
        { label: "Resolve in Merge Tool", action: () => void repoStore.openMerge(file.path, repoRoot) },
        { label: "Show All Conflicts...", action: () => void repoStore.openConflicts(repoRoot) },
      ];
    } else if (group === "staged") {
      items = [{ label: "Unstage", action: () => unstage(repoRoot, [file]), disabled: busy }];
    } else {
      items = [
        { label: "Stage", action: () => stage(repoRoot, [file]), disabled: busy },
        {
          label: "Discard Changes...",
          action: () => void discard(repoRoot, [file], dialogName),
          danger: true,
          disabled: busy,
        },
      ];
    }
    if (isSubmoduleEntry(file) && group !== "conflicts") {
      items = group === "staged" ? items : items.filter((item) => !("label" in item) || item.label !== "Discard Changes...");
      items.push({ separator: true }, ...submoduleEntryItems(repoRoot, file.path));
    }
    const ignoreItem = group === "conflicts" ? null : ignoreMenu(repoRoot, file.path, file.path.endsWith("/"));
    if (ignoreItem) {
      items.push({ separator: true }, ignoreItem);
    }
    if (group !== "conflicts" && !file.submodule) {
      items.push({ label: "Shelve Changes...", disabled: busy, action: () => openShelveDialog(repoRoot, [file.path]) });
    }
    items.push({ separator: true }, { label: "Copy Path", action: () => copyText(file.path) });
    contextMenu.open(event, items);
  }

  /** Right click: the "..." menu, plus the repository items. */
  async function headerMenu(event: MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const items: MenuItem[] = await repoMenuFor(repoRoot);
    if (section.conflicts.length > 0) {
      items.push({ label: "Resolve Conflicts...", action: () => void repoStore.openConflicts(repoRoot) });
    }
    items.push({ separator: true });
    if (!active) {
      items.push({ label: "Set as Active Repository", action: () => void repoStore.setActiveRepo(repoRoot) });
    }
    items.push({ label: "Copy Repository Path", action: () => copyText(repoRoot) });
    contextMenu.open(event, items);
  }

  function headerTitle(): string {
    const parts = [repoRoot];
    if (branch) {
      parts.push(`on ${branch}`);
    }
    if (active) {
      parts.push("active repository");
    }
    return parts.join(", ");
  }
</script>

{#snippet groupHeader(group: GroupId, label: string, groupFiles: FileStatus[])}
  {@const groupCollapsed = changesLayout.isGroupCollapsed(repoRoot, group)}
  <div class="group-header" class:nested={multiRepo}>
    <button
      class="group-toggle"
      onclick={() => changesLayout.toggleGroup(repoRoot, group)}
      aria-expanded={!groupCollapsed}
    >
      <Icon name={groupCollapsed ? "chevron-right" : "chevron-down"} size={13} />
      <span class="group-label">{label}</span>
      <span class="group-count">{groupFiles.length}</span>
    </button>
    <span class="group-actions">
      {#if group === "conflicts"}
        <button class="btn small" onclick={() => void repoStore.openConflicts(repoRoot)}>Resolve...</button>
      {:else if group === "staged"}
        <button class="action" onclick={() => unstage(repoRoot, groupFiles)} disabled={busy} title="Unstage all">
          <Icon name="minus" size={13} />
        </button>
      {:else}
        <button
          class="action danger"
          onclick={() => void discard(repoRoot, groupFiles, dialogName)}
          disabled={busy}
          title="Discard all"
        >
          <Icon name="discard" size={13} />
        </button>
        <button class="action" onclick={() => stage(repoRoot, groupFiles)} disabled={busy} title="Stage all">
          <Icon name="plus" size={13} />
        </button>
      {/if}
    </span>
  </div>
{/snippet}

{#snippet fileGroup(group: GroupId, label: string, groupFiles: FileStatus[])}
  {#if groupFiles.length > 0}
    <div class="group" role="group" aria-label={label}>
      {@render groupHeader(group, label, groupFiles)}
      {#if !changesLayout.isGroupCollapsed(repoRoot, group)}
        {#each groupFiles as file (file.path)}
          {@const selection = rowSelection(file, group)}
          <FileRow
            {file}
            nested={multiRepo}
            kind={group === "conflicts" ? null : kindIn(file, selection.area)}
            selected={group !== "conflicts" && sameSelection(selection, selected)}
            id={group === "conflicts" ? undefined : rowElementId(selection)}
            actions={rowActions(file, group)}
            badge={rowBadge(file)}
            note={rowNote(file, group)}
            onselect={() => {
              if (group === "conflicts") {
                void repoStore.openMerge(file.path, repoRoot);
              } else {
                onselect(selection);
              }
            }}
            onactivate={() => activate(repoRoot, file, group)}
            oncontextmenu={(event) => rowMenu(event, file, group)}
          />
        {/each}
      {/if}
    </div>
  {/if}
{/snippet}

<div class="repo-section" role="group" aria-label={repo.name}>
  {#if multiRepo}
    <div class="repo-header" class:active oncontextmenu={(event) => void headerMenu(event)} role="presentation">
      <button
        class="repo-toggle"
        onclick={() => changesLayout.toggleRepo(repoRoot)}
        aria-expanded={!collapsed}
        title={headerTitle()}
      >
        <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={13} />
        <!-- Keeps a few letters of the name before the actions wrap; a short name needs less. -->
        <span class="repo-label" style:--name-min="{Math.min(repo.name.length, 4)}ch">
          <span class="repo-label-row">
            <span class="repo-name">{repo.name}</span>
            {#if repo.submodule}
              <span class="kind-badge" title="A submodule of the repository around it">submodule</span>
            {:else if repo.worktree}
              <span class="kind-badge" title="A linked worktree">worktree</span>
            {/if}
            {#if showRelativePath(repo)}
              <span class="repo-path truncate">{repo.relativePath}</span>
            {/if}
          </span>
        </span>
        <span class="badge" title="{section.changeCount} changed {section.changeCount === 1 ? 'file' : 'files'}">
          {section.changeCount}
        </span>
        {#if operation}
          <span class="op-badge" title={section.status?.op?.description ?? operation}>{operation}</span>
        {/if}
      </button>
      <RepoActions {section} />
    </div>
  {/if}
  {#if !collapsed}
    {@render fileGroup("conflicts", "Conflicts", section.conflicts)}
    {@render fileGroup("staged", "Staged", section.staged)}
    {@render fileGroup("unstaged", "Changes", section.unstaged)}
  {/if}
</div>

<style>
  .repo-section + :global(.repo-section) {
    margin-top: 2px;
  }

  /*
   * One line when it fits: the branch name and the repository name truncate, the badges never
   * do. When not even a few letters of the name fit, the actions wrap to a second line.
   */
  .repo-header {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 4px;
    min-height: 28px;
    padding: 0 6px 0 4px;
    /* RepoActions hides the branch name first when this row gets narrow. */
    container: repo-row / inline-size;
  }

  /* Starts from its smallest width and shares the rest with the name, up to its full width. */
  .repo-header > :global(.repo-row-actions) {
    flex: 1 1 0;
    min-width: auto;
    max-width: max-content;
    min-height: 24px;
    margin-left: auto;
    justify-content: flex-end;
  }

  .repo-header:hover {
    background: var(--hover);
  }

  .repo-header.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 5px;
    bottom: 5px;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: var(--accent);
  }

  /*
   * Never narrower than its badges (its own min-content), so they are never cut off. It takes
   * two thirds of the free space and the actions one third (the name matters more than the
   * branch); what either cannot use goes to the other.
   */
  .repo-toggle {
    flex: 2 1 0;
    max-width: max-content;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 4px;
    border: none;
    background: transparent;
    color: var(--text);
    cursor: pointer;
    text-align: left;
  }

  /*
   * A grid track of minmax(0, max-content) gives the label a min-content of 0 (plus
   * --name-min), so the row can shrink the name; a flex item would count its full text.
   */
  .repo-label {
    flex: 0 1 auto;
    display: grid;
    grid-template-columns: minmax(0, max-content);
    min-width: var(--name-min, 0);
  }

  .repo-label-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
  }

  .repo-name {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  /* Gives way before the name. */
  .repo-path {
    min-width: 0;
    flex: 0 1000 auto;
    color: var(--text-faint);
    font-size: 12px;
  }

  .kind-badge {
    flex: none;
    padding: 0 5px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--text-dim);
    font-size: 10px;
    font-weight: 600;
    line-height: 14px;
  }

  .op-badge {
    flex: none;
    padding: 0 6px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--warning) 18%, transparent);
    color: var(--warning);
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
  }

  .badge {
    flex: none;
    min-width: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--selected-inactive);
    color: var(--text-dim);
    font-size: 11px;
    font-weight: 600;
    line-height: 17px;
    text-align: center;
  }

  /* A very narrow sidebar drops the change count, then lets the name go. */
  @container repo-row (max-width: 200px) {
    .badge {
      display: none;
    }

    .repo-label {
      min-width: 0;
    }
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 6px 0 4px;
  }

  .group-header.nested {
    padding-left: 16px;
  }

  .group-header:hover {
    background: var(--hover);
  }

  .group + .group {
    margin-top: 4px;
  }

  .group-toggle {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 5px;
    height: 100%;
    padding: 0 4px;
    border: none;
    background: transparent;
    color: var(--text);
    cursor: pointer;
    text-align: left;
  }

  .group-label {
    font-weight: 600;
  }

  .group-count {
    color: var(--text-dim);
    font-size: 12px;
  }

  .group-actions {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .group-actions .action {
    display: none;
  }

  .group-header:hover .group-actions .action {
    display: inline-flex;
  }

  .group-actions .btn.small {
    height: 20px;
    padding: 0 8px;
    font-size: 11.5px;
  }

  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .action:hover:not(:disabled) {
    background: var(--border-strong);
    color: var(--text);
  }

  .action.danger:hover:not(:disabled) {
    color: var(--danger);
  }

  .action:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
