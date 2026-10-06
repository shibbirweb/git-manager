<script lang="ts">
  import { withCommandKeys } from "$lib/commands/commandRuntime";
  import { tick, untrack } from "svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import CleanRepoList from "./changes/CleanRepoList.svelte";
  import CommitBox from "./changes/CommitBox.svelte";
  import CommitLayoutIcon from "./changes/CommitLayoutIcon.svelte";
  import { commitDraft } from "./changes/commitDraft.svelte";
  import { rowElementId, sameSelection, type FileSelection, type GroupId } from "./changes/fileStatus";
  import { changesLayout } from "./changes/layout.svelte";
  import { activate, discard } from "./changes/mutations";
  import RepoActions from "./changes/RepoActions.svelte";
  import RepoSection from "./changes/RepoSection.svelte";
  import { buildSections, commitChoices, findFile, findSection, resolveCommitTarget, selectableRows, splitSections } from "./changes/sections";
  import { changesSelection } from "./changes/selection.svelte";
  import { navigation } from "$lib/stores/navigation.svelte";

  const repos = $derived(repoStore.repos);
  const multiRepo = $derived(repos.length > 1);
  const activeRoot = $derived(repoStore.repo?.root ?? null);
  const sections = $derived(buildSections(repoStore.repos, repoStore.statuses));
  const split = $derived(splitSections(sections));
  const changed = $derived(split.changed);
  const busy = $derived(repoStore.busy !== null);
  const selected = $derived(changesSelection.selected);
  /** Settings > Git > Commit box: a box at the top of each repository instead of one under the list. */
  const perRepo = $derived(settings.commitBoxLayout === "perRepo");

  let listEl = $state<HTMLDivElement | null>(null);

  function isHidden(repoRoot: string, group: GroupId): boolean {
    return (multiRepo && changesLayout.isRepoCollapsed(repoRoot)) || changesLayout.isGroupCollapsed(repoRoot, group);
  }

  /** Rows reachable with the arrow keys (sections and groups that are expanded). */
  const visibleRows = $derived(selectableRows(changed, isHidden));
  const selectedSection = $derived(selected ? findSection(sections, selected.repoRoot) : null);
  const selectedFile = $derived(selected ? findFile(sections, selected) : null);
  /** Screen readers follow the selected row while the list itself has the focus. */
  const activeRowId = $derived(
    selected && visibleRows.some((row) => sameSelection(row, selected)) ? rowElementId(selected) : undefined,
  );

  const commitTarget = $derived(resolveCommitTarget(repos, changesLayout.commitTargetRoot, activeRoot));
  const commitSection = $derived(commitTarget ? findSection(sections, commitTarget.root) : null);
  const choices = $derived(commitChoices(sections, commitTarget?.root ?? null));

  // Drafts belong to the open workspace; drop those of repositories that vanished.
  $effect(() => {
    const workspaceRoot = repoStore.workspace?.root ?? null;
    const repoRoots = repos.map((repo) => repo.root);
    untrack(() => commitDraft.sync(workspaceRoot, repoRoots));
  });

  // Switching the active repository elsewhere moves the commit target along.
  $effect(() => {
    const repoRoot = activeRoot;
    untrack(() => {
      if (repoRoot && repoRoot !== changesLayout.seenActiveRoot) {
        changesLayout.seenActiveRoot = repoRoot;
        changesLayout.focusRepo(repoRoot);
      }
    });
  });

  function clickRow(selection: FileSelection): void {
    navigation.record({ kind: "diff", repoRoot: selection.repoRoot, path: selection.path, area: selection.area, line: 0 });
    changesSelection.pick(selection);
    listEl?.focus();
  }

  // Keyboard

  async function onListKeydown(event: KeyboardEvent): Promise<void> {
    // Keys typed in a repository's commit box stay there.
    if ((event.target as HTMLElement | null)?.closest("input, textarea, select")) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (visibleRows.length === 0) {
        return;
      }
      const index = selected ? visibleRows.findIndex((row) => sameSelection(row, selected)) : -1;
      let next: number;
      if (index < 0) {
        next = event.key === "ArrowDown" ? 0 : visibleRows.length - 1;
      } else {
        next = Math.max(0, Math.min(visibleRows.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
      }
      changesSelection.pick(visibleRows[next]);
      await tick();
      listEl?.querySelector(".row.selected")?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (!selected || !selectedFile || busy) {
      return;
    }
    // Space or Enter on a focused header button runs it; do not also act on the selected row.
    if ((event.target as HTMLElement | null)?.closest("button, select, input, textarea")) {
      return;
    }
    // The list keeps the focus (rows are only its active descendant), so it handles Enter too.
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      activate(selected.repoRoot, selectedFile, selected.area);
    } else if ((event.key === "Delete" || event.key === "Backspace") && selected.area === "unstaged") {
      event.preventDefault();
      void discard(selected.repoRoot, [selectedFile], multiRepo ? (selectedSection?.repo.name ?? null) : null);
    }
  }

  function initRepository(): void {
    const workspaceRoot = repoStore.workspace?.root ?? null;
    if (workspaceRoot) {
      void repoStore.initRepository(workspaceRoot);
    }
  }
</script>

<div class="panel">
  <div class="head">
    <span class="title">Changes</span>
    {#if repoStore.totalChanges > 0}
      <span class="count">{repoStore.totalChanges}</span>
    {/if}
    <div class="spacer"></div>
    {#if repos.length > 0}
      <button
        class="icon-btn small"
        onclick={() => settings.setPreference("commitBoxLayout", perRepo ? "single" : "perRepo")}
        title={perRepo ? "Show One Commit Box" : "Show a Commit Box per Repository"}
        aria-label="Commit box per repository"
        aria-pressed={perRepo}
      >
        <CommitLayoutIcon {perRepo} />
      </button>
    {/if}
    {#if !multiRepo && sections[0]?.status}
      <!-- One repository: its actions sit in the title bar. -->
      <RepoActions section={sections[0]} />
    {:else}
      <button class="icon-btn small" onclick={() => void repoStore.refreshAll()} title="Refresh All" aria-label="Refresh all">
        <Icon name="refresh" size={13} />
      </button>
    {/if}
    <button class="icon-btn small" onclick={() => settings.setLeftPanel(null)} title={withCommandKeys("Hide", "view.sidebar")} aria-label="Hide changes">
      <Icon name="x" size={14} />
    </button>
  </div>

  {#if repoStore.workspace && repos.length === 0}
    <div class="placeholder no-repo">
      <div class="empty-icon"><Icon name="folder-git" size={20} /></div>
      <div class="empty-title">No git repository</div>
      <div class="dim">Initialize one here, or scan again after adding one.</div>
      <div class="empty-actions">
        <button class="btn small primary" onclick={initRepository} disabled={busy}>Initialize Repository</button>
        <button class="btn small" onclick={() => void repoStore.rediscover()} disabled={busy}>Scan Again</button>
      </div>
    </div>
  {:else}
    <div
      class="file-list"
      role="listbox"
      tabindex="0"
      aria-label="Changed files"
      aria-activedescendant={activeRowId}
      bind:this={listEl}
      onkeydown={onListKeydown}
    >
      {#if !multiRepo}
        {#if perRepo && commitTarget && sections[0]?.status && sections[0].changeCount === 0}
          <!-- A clean repository keeps its box, for Amend. -->
          <CommitBox repo={commitTarget} stagedCount={0} conflictCount={0} multiRepo={false} choices={[]} onpick={() => {}} placement="section" />
        {/if}
        {#if sections[0]?.status && sections[0].changeCount === 0}
          <div class="list-empty">
            <div class="clean-icon"><Icon name="check" size={18} /></div>
            <div class="dim">Working tree clean</div>
          </div>
        {:else if sections[0]}
          <RepoSection
            section={sections[0]}
            multiRepo={false}
            active={true}
            selected={selected?.repoRoot === sections[0].repo.root ? selected : null}
            onselect={clickRow}
            commitBox={perRepo}
          />
        {/if}
      {:else}
        {#if changed.length === 0}
          <div class="list-empty">
            <div class="clean-icon"><Icon name="check" size={18} /></div>
            <div class="dim">No changes in {repos.length} repositories</div>
          </div>
        {/if}
        {#each changed as section (section.repo.root)}
          <RepoSection
            {section}
            multiRepo={true}
            active={section.repo.root === activeRoot}
            selected={selected?.repoRoot === section.repo.root ? selected : null}
            onselect={clickRow}
            commitBox={perRepo}
          />
        {/each}
        {#if split.clean.length > 0}
          <CleanRepoList sections={split.clean} {activeRoot} />
        {/if}
      {/if}
    </div>
    {#if commitTarget && !perRepo}
      <CommitBox
        repo={commitTarget}
        stagedCount={commitSection?.staged.length ?? 0}
        conflictCount={commitSection?.conflicts.length ?? 0}
        {multiRepo}
        {choices}
        onpick={(repoRoot) => changesLayout.focusRepo(repoRoot)}
      />
    {/if}
  {/if}
</div>

<style>
  .panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    background: var(--panel);
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 6px 0 12px;
    border-bottom: 1px solid var(--border-strong);
    container: repo-row / inline-size;
  }

  /* The title gives way first in a narrow sidebar, so the buttons never run into the close button. */
  .title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  /*
   * RepoActions may shrink in a repository row, but here it keeps its buttons whole (the branch
   * name still hides). A long branch name shortens before the title does.
   */
  .head > :global(.repo-row-actions) {
    flex-shrink: 1000;
    min-width: auto;
  }

  .count {
    flex: none;
    min-width: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--hover);
    font-size: 11px;
    line-height: 16px;
    text-align: center;
  }

  .spacer {
    flex: 1;
  }

  .icon-btn.small {
    height: 24px;
    min-width: 24px;
  }

  .file-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 0;
    outline: none;
  }

  .list-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 28px 16px;
    text-align: center;
  }

  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 20px 14px;
    text-align: center;
  }

  .clean-icon,
  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
  }

  .clean-icon {
    background: color-mix(in srgb, var(--success) 14%, transparent);
    color: var(--success);
  }

  .empty-icon {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
  }

  .empty-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 8px;
  }

  .empty-title {
    font-weight: 600;
  }
</style>
