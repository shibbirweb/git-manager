<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { FileStatus } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import FileRow from "./FileRow.svelte";
  import { kindIn, rowElementId, sameSelection, type FileSelection, type GroupId, type RowAction } from "./fileStatus";
  import { changesLayout } from "./layout.svelte";
  import { activate, copyText, discard, stage, unstage } from "./mutations";
  import { branchLabel, opLabel, showRelativePath, type RepoSection } from "./sections";

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
    items.push({ separator: true }, { label: "Copy Path", action: () => copyText(file.path) });
    contextMenu.open(event, items);
  }

  function headerMenu(event: MouseEvent): void {
    const items: MenuItem[] = [
      {
        label: "Stage All",
        action: () => stage(repoRoot, section.unstaged),
        disabled: busy || section.unstaged.length === 0,
      },
      {
        label: "Unstage All",
        action: () => unstage(repoRoot, section.staged),
        disabled: busy || section.staged.length === 0,
      },
      {
        label: "Discard All Changes...",
        action: () => void discard(repoRoot, section.unstaged, repo.name),
        danger: true,
        disabled: busy || section.unstaged.length === 0,
      },
    ];
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
    <div class="repo-header" class:active oncontextmenu={headerMenu} role="presentation">
      <button
        class="repo-toggle"
        onclick={() => changesLayout.toggleRepo(repoRoot)}
        aria-expanded={!collapsed}
        title={headerTitle()}
      >
        <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={13} />
        <span class="repo-name">{repo.name}</span>
        {#if showRelativePath(repo)}
          <span class="repo-path truncate">{repo.relativePath}</span>
        {/if}
        {#if branch}
          <span class="repo-branch truncate" class:detached={!head?.branch}>
            <Icon name="branch" size={11} />
            {branch}
          </span>
        {/if}
        {#if (head?.ahead ?? 0) > 0}
          <span class="sync" title="{head?.ahead} ahead of upstream">
            <Icon name="arrow-up" size={10} />{head?.ahead}
          </span>
        {/if}
        {#if (head?.behind ?? 0) > 0}
          <span class="sync" title="{head?.behind} behind upstream">
            <Icon name="arrow-down" size={10} />{head?.behind}
          </span>
        {/if}
        {#if operation}
          <span class="op-badge" title={section.status?.op?.description ?? operation}>{operation}</span>
        {/if}
      </button>
      <span class="repo-actions">
        {#if !active}
          <button
            class="action"
            onclick={() => void repoStore.setActiveRepo(repoRoot)}
            title="Set as active repository"
            aria-label="Set as active repository"
          >
            <Icon name="folder-git" size={13} />
          </button>
        {/if}
        <button
          class="action danger"
          onclick={() => void discard(repoRoot, section.unstaged, repo.name)}
          disabled={busy || section.unstaged.length === 0}
          title="Discard all changes"
          aria-label="Discard all changes"
        >
          <Icon name="discard" size={13} />
        </button>
        <button
          class="action"
          onclick={() => unstage(repoRoot, section.staged)}
          disabled={busy || section.staged.length === 0}
          title="Unstage all"
          aria-label="Unstage all"
        >
          <Icon name="minus" size={13} />
        </button>
        <button
          class="action"
          onclick={() => stage(repoRoot, section.unstaged)}
          disabled={busy || section.unstaged.length === 0}
          title="Stage all"
          aria-label="Stage all"
        >
          <Icon name="plus" size={13} />
        </button>
      </span>
      <span class="badge" title="{section.changeCount} changed {section.changeCount === 1 ? 'file' : 'files'}">
        {section.changeCount}
      </span>
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

  .repo-header {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 6px 0 4px;
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

  .repo-toggle {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    padding: 0 4px;
    border: none;
    background: transparent;
    color: var(--text);
    cursor: pointer;
    text-align: left;
    overflow: hidden;
  }

  .repo-name {
    flex: none;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  .repo-path {
    min-width: 24px;
    flex: 0 1 auto;
    color: var(--text-faint);
    font-size: 12px;
  }

  .repo-branch {
    min-width: 30px;
    flex: 0 1 auto;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--text-dim);
    font-size: 12px;
  }

  .repo-branch.detached {
    font-style: italic;
  }

  .sync {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 1px;
    color: var(--text-dim);
    font-size: 11.5px;
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

  .repo-actions {
    flex: none;
    display: none;
    align-items: center;
    gap: 1px;
  }

  .repo-header:hover .repo-actions,
  .repo-header:focus-within .repo-actions {
    display: flex;
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
