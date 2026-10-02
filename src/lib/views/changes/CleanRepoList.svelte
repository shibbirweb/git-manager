<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { changesLayout } from "./layout.svelte";
  import { copyText } from "./mutations";
  import RepoActions from "./RepoActions.svelte";
  import { repoMenuFor } from "./repoActions";
  import { opLabel, showRelativePath, type RepoSection } from "./sections";

  interface Props {
    /** Repositories without changes (or whose status is still loading). */
    sections: RepoSection[];
    activeRoot: string | null;
  }

  let { sections, activeRoot }: Props = $props();

  const collapsed = $derived(changesLayout.isCleanCollapsed(sections.length));

  /** Right click: the "..." menu, plus the repository items. */
  async function repoMenu(event: MouseEvent, section: RepoSection): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const repoRoot = section.repo.root;
    const items: MenuItem[] = section.status ? await repoMenuFor(repoRoot) : [];
    if (items.length > 0) {
      items.push({ separator: true });
    }
    if (repoRoot !== activeRoot) {
      items.push({ label: "Set as Active Repository", action: () => void repoStore.setActiveRepo(repoRoot) });
    }
    items.push({ label: "Copy Repository Path", action: () => copyText(repoRoot) });
    contextMenu.open(event, items);
  }
</script>

<div class="clean-list" role="group" aria-label="Repositories without changes">
  <div class="list-header">
    <button
      class="list-toggle"
      onclick={() => changesLayout.toggleClean(sections.length)}
      aria-expanded={!collapsed}
    >
      <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={13} />
      <span class="list-label">No Changes</span>
      <span class="list-count">{sections.length}</span>
    </button>
  </div>
  {#if !collapsed}
    {#each sections as section (section.repo.root)}
      {@const active = section.repo.root === activeRoot}
      {@const operation = opLabel(section.status?.op?.kind)}
      <div
        class="clean-row"
        class:active
        role="presentation"
        title="{section.repo.root}{active ? ', active repository' : ''}"
        oncontextmenu={(event) => void repoMenu(event, section)}
      >
        <span class="icon"><Icon name="folder-git" size={13} /></span>
        <span class="name truncate">{section.repo.name}</span>
        {#if section.repo.submodule}
          <span class="kind-badge" title="A submodule of the repository around it">submodule</span>
        {:else if section.repo.worktree}
          <span class="kind-badge" title="A linked worktree">worktree</span>
        {/if}
        {#if showRelativePath(section.repo)}
          <span class="path truncate">{section.repo.relativePath}</span>
        {/if}
        {#if operation}
          <span class="op-badge">{operation}</span>
        {/if}
        <span class="spacer"></span>
        {#if !active}
          <button
            class="action"
            onclick={() => void repoStore.setActiveRepo(section.repo.root)}
            title="Set as active repository"
            aria-label="Set {section.repo.name} as active repository"
          >
            <Icon name="folder-git" size={13} />
          </button>
        {/if}
        {#if section.status}
          <RepoActions {section} showCommit={false} />
        {:else}
          <span class="note">reading status</span>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .clean-list {
    margin-top: 6px;
  }

  .list-header {
    display: flex;
    align-items: center;
    height: 26px;
    padding: 0 6px 0 4px;
  }

  .list-header:hover {
    background: var(--hover);
  }

  .list-toggle {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 5px;
    height: 100%;
    padding: 0 4px;
    border: none;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
    text-align: left;
  }

  .list-label {
    font-weight: 600;
  }

  .list-count {
    font-size: 12px;
  }

  .clean-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 6px 0 24px;
    color: var(--text-dim);
    container: repo-row / inline-size;
  }

  .kind-badge {
    flex: none;
    padding: 0 5px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    line-height: 14px;
  }

  .clean-row:hover {
    background: var(--hover);
  }

  .clean-row.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: var(--accent);
  }

  .icon {
    flex: none;
    display: inline-flex;
    color: var(--text-faint);
  }

  .name {
    flex: 0 1 auto;
    min-width: 30px;
    color: var(--text);
  }

  .path {
    flex: 0 1 auto;
    min-width: 20px;
    font-size: 12px;
  }

  .path {
    color: var(--text-faint);
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

  .spacer {
    flex: 1;
  }

  .note {
    flex: none;
    color: var(--text-faint);
    font-size: 11.5px;
  }

  .action {
    display: none;
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

  .clean-row:hover .action {
    display: inline-flex;
  }

  .action:hover {
    background: var(--border-strong);
    color: var(--text);
  }
</style>
