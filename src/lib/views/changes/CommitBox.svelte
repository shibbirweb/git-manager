<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { RepoInfo } from "$lib/types";
  import { toast } from "$lib/ui/toast.svelte";
  import { commitDraft } from "./commitDraft.svelte";
  import { branchLabel, showRelativePath, type RepoSection } from "./sections";

  interface Props {
    /** Repository the commit goes to. */
    repo: RepoInfo;
    stagedCount: number;
    conflictCount: number;
    /** Several repositories are open: show the target and its picker. */
    multiRepo: boolean;
    /** Repositories offered by the picker. */
    choices: RepoSection[];
    onpick: (repoRoot: string) => void;
  }

  let { repo, stagedCount, conflictCount, multiRepo, choices, onpick }: Props = $props();

  /** Repository whose HEAD message is being loaded for amend. */
  let loadingRoot = $state<string | null>(null);

  const draft = $derived(commitDraft.for(repo.root));
  const status = $derived(repoStore.statuses[repo.root] ?? null);
  const unborn = $derived(status?.head?.unborn ?? false);
  const branch = $derived(branchLabel(status?.head));
  const busy = $derived(repoStore.busy !== null);
  const loadingMessage = $derived(loadingRoot === repo.root);
  const hasMessage = $derived(draft.message.trim() !== "");
  const disabledReason = $derived.by(() => {
    if (conflictCount > 0) {
      return "Resolve conflicts before committing";
    }
    if (!draft.amend && stagedCount === 0) {
      return "Stage changes to commit";
    }
    if (!draft.amend && !hasMessage) {
      return "Enter a commit message";
    }
    return null;
  });
  const canCommit = $derived(disabledReason === null && !busy && !loadingMessage);
  const summary = $derived.by(() => {
    if (conflictCount > 0) {
      return conflictCount === 1 ? "1 conflicted file" : `${conflictCount} conflicted files`;
    }
    if (stagedCount === 0) {
      return draft.amend ? "Amend message only" : "Nothing staged";
    }
    return stagedCount === 1 ? "1 file staged" : `${stagedCount} files staged`;
  });
  const commitHint = $derived(multiRepo ? `Commit to ${repo.name} (Cmd+Enter)` : "Commit (Cmd+Enter)");

  function choiceLabel(choice: RepoSection): string {
    const name = showRelativePath(choice.repo) ? `${choice.repo.name} (${choice.repo.relativePath})` : choice.repo.name;
    const staged = choice.staged.length;
    return staged > 0 ? `${name}, ${staged} staged` : name;
  }

  async function toggleAmend(event: Event): Promise<void> {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    const target = draft;
    const repoRoot = repo.root;
    target.amend = checked;
    if (!checked) {
      if (target.prefilled !== null && target.message === target.prefilled) {
        target.message = "";
      }
      target.prefilled = null;
      return;
    }
    if (target.message.trim() !== "") {
      return;
    }
    loadingRoot = repoRoot;
    try {
      const headMessage = (await api.getHeadMessage(repoRoot)).trimEnd();
      if (target.amend && target.message.trim() === "") {
        target.message = headMessage;
        target.prefilled = headMessage;
      }
    } catch (error) {
      toast.error("Could not read the last commit message", errorMessage(error));
    } finally {
      if (loadingRoot === repoRoot) {
        loadingRoot = null;
      }
    }
  }

  async function commit(): Promise<void> {
    if (!canCommit) {
      return;
    }
    const target = draft;
    const message = target.message;
    const amend = target.amend;
    const result = await repoStore.run("Commit", (repoPath) => api.commit(repoPath, message, amend), {
      repoPath: repo.root,
      success: amend ? "Commit amended" : "Committed",
    });
    if (result !== undefined) {
      target.clear();
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void commit();
    }
  }
</script>

<div class="commit-box">
  {#if multiRepo}
    <div class="target">
      <span class="target-label dim">Commit to</span>
      {#if choices.length > 1}
        <select
          class="input target-select"
          value={repo.root}
          onchange={(event) => onpick(event.currentTarget.value)}
          aria-label="Repository to commit to"
          title={repo.root}
        >
          {#each choices as choice (choice.repo.root)}
            <option value={choice.repo.root}>{choiceLabel(choice)}</option>
          {/each}
        </select>
      {:else}
        <span class="target-name truncate" title={repo.root}>{repo.name}</span>
      {/if}
      {#if branch}
        <span class="target-branch dim truncate">on {branch}</span>
      {/if}
    </div>
  {/if}
  <textarea
    class="input message"
    placeholder={multiRepo ? `Message for ${repo.name}` : "Commit message"}
    bind:value={draft.message}
    onkeydown={onKeydown}
    spellcheck="true"
    aria-label="Commit message"
  ></textarea>
  <div class="footer">
    <label class="amend" title={unborn ? "There is no commit to amend yet" : "Amend the last commit"}>
      <input type="checkbox" checked={draft.amend} onchange={toggleAmend} disabled={unborn || busy} />
      Amend
    </label>
    <span class="summary dim truncate">{summary}</span>
    <button class="btn primary" onclick={commit} disabled={!canCommit} title={disabledReason ?? commitHint}>
      {draft.amend ? "Amend Commit" : "Commit"}
    </button>
  </div>
</div>

<style>
  .commit-box {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-top: 1px solid var(--border-strong);
    background: var(--panel);
  }

  .target {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .target-label {
    flex: none;
    font-size: 12px;
  }

  .target-select {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 70%;
    height: 24px;
    padding: 0 4px;
    font-weight: 600;
  }

  .target-name {
    flex: 0 1 auto;
    min-width: 0;
    font-weight: 600;
  }

  .target-branch {
    flex: 0 1 auto;
    min-width: 0;
    font-size: 12px;
  }

  .message {
    width: 100%;
    height: 96px;
    line-height: 1.45;
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .amend {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    white-space: nowrap;
  }

  .amend input {
    margin: 0;
  }

  .summary {
    flex: 1;
    min-width: 0;
    font-size: 12px;
  }
</style>
