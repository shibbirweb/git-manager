<!-- Main-area view showing the diff of the change selected in the Changes sidebar. -->
<script lang="ts">
  import type { PreviewSides } from "$lib/diff/binaryPreview";
  import DiffView from "$lib/diff/DiffView.svelte";
  import { joinPath } from "$lib/stores/workspacePaths";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { HEAD_REVISION, INDEX_REVISION } from "$lib/views/files/previewSource";
  import { buildSections, displayPath, findFile, findSection, splitSections } from "./sections";
  import { changesSelection } from "./selection.svelte";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { untrack } from "svelte";

  let reveal = $state<{ line: number; token: number } | null>(null);

  // Back / Forward to a line in this diff.
  $effect(() => {
    const request = navigation.diffReveal;
    const current = changesSelection.selected;
    if (request && current) {
      untrack(() => {
        const taken = navigation.takeDiffReveal(current.repoRoot, current.path, current.area);
        if (taken) {
          reveal = taken;
        }
      });
    }
  });

  const sections = $derived(buildSections(repoStore.repos, repoStore.statuses));
  const changed = $derived(splitSections(sections).changed);
  const multiRepo = $derived(repoStore.repos.length > 1);
  const anyLoaded = $derived(sections.some((section) => section.status !== null));
  const conflictTotal = $derived(changed.reduce((sum, section) => sum + section.conflicts.length, 0));
  const selected = $derived(changesSelection.selected);
  const selectedSection = $derived(selected ? findSection(sections, selected.repoRoot) : null);
  const diffMode = $derived(selected?.area === "staged" ? "staged" : "unstaged");
  const panelHidden = $derived(settings.leftPanel !== "changes");

  /** Bumped when the repository's status changes, so a binary preview loads its files again. */
  let previewVersion = $state(0);
  $effect(() => {
    void repoStore.statuses[selected?.repoRoot ?? ""];
    untrack(() => previewVersion++);
  });
  /** Unstaged: the index against the work tree. Staged: HEAD (the old path of a rename) against the index. */
  const previewSides = $derived.by((): PreviewSides | null => {
    if (!selected) {
      return null;
    }
    const index = { kind: "revision", repoRoot: selected.repoRoot, revision: INDEX_REVISION, filePath: selected.path } as const;
    if (selected.area === "staged") {
      const oldPath = findFile(sections, selected)?.origPath ?? selected.path;
      const head = { kind: "revision", repoRoot: selected.repoRoot, revision: HEAD_REVISION, filePath: oldPath } as const;
      return { original: head, modified: index, version: previewVersion };
    }
    const worktree = { kind: "worktree", filePath: joinPath(selected.repoRoot, selected.path) } as const;
    return { original: index, modified: worktree, version: previewVersion };
  });
</script>

<div class="changes-diff">
  {#if repoStore.repos.length === 0}
    <div class="placeholder dim">This folder has no git repository yet.</div>
  {:else if !anyLoaded}
    <div class="placeholder"></div>
  {:else if selected && changesSelection.diff}
    <DiffView
      diff={changesSelection.diff}
      path={displayPath(selectedSection?.repo ?? null, selected.path, multiRepo)}
      mode={diffMode}
      leftLabel={diffMode === "staged" ? "HEAD" : "Index"}
      rightLabel={diffMode === "staged" ? "Index (staged)" : "Working Tree"}
      onChange={(target, content) => changesSelection.applyDiffChange(target, content)}
      blame={{
        repoRoot: selected.repoRoot,
        filePath: selected.path,
        revision: null,
        origin: (line) => ({ kind: "diff", repoRoot: selected.repoRoot, path: selected.path, area: selected.area, line }),
      }}
      revealLine={reveal}
      workingFile={{ filePath: joinPath(selected.repoRoot, selected.path), sameLines: diffMode !== "staged" }}
      {previewSides}
    />
  {:else if selected && changesSelection.diffError}
    <div class="placeholder">
      <div class="error-title">Could not load the diff</div>
      <div class="dim selectable">{changesSelection.diffError}</div>
    </div>
  {:else if selected}
    <div class="placeholder loading dim">Loading diff...</div>
  {:else if changed.length === 0}
    <div class="placeholder">
      <div class="clean-icon"><Icon name="check" size={22} /></div>
      <div class="empty-title">{multiRepo ? `No changes in ${repoStore.repos.length} repositories` : "Working tree clean"}</div>
      <div class="dim">There are no changes to commit.</div>
    </div>
  {:else}
    <div class="placeholder dim">
      <div>{conflictTotal > 0 ? "Resolve conflicts to continue" : "Select a file in Changes to see its diff"}</div>
      {#if panelHidden}
        <button class="btn small" onclick={() => settings.setLeftPanel("changes")}>
          <Icon name="git-compare" size={13} />
          Show Changes
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .changes-diff {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--editor-bg);
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

  .clean-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-bottom: 6px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--success) 14%, transparent);
    color: var(--success);
  }

  .empty-title,
  .error-title {
    font-size: 14px;
    font-weight: 600;
  }

  .error-title {
    color: var(--danger);
  }

  .loading {
    animation: appear 0.2s ease 0.25s both;
  }

  @keyframes appear {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
