<!-- JetBrains' Reset HEAD dialog: the revision to reset the current branch to (HEAD, a commit
     id or a branch) and the mode, each with its one-line explanation. Hard asks first. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { CommitSummary, ResetMode } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { decodeRefPick, refPickItems } from "../changes/repoPickers";
  import GitDialogFrame from "./GitDialogFrame.svelte";
  import { gitDialogs } from "./gitDialogs.svelte";
  import { RESET_MODES, validateRevision } from "./gitOptions";
  import { undoAction } from "./undoActions";

  interface Props {
    repoRoot: string;
    /** Filled in when opened from a commit, e.g. the reflog's Reset Current Branch to Here. */
    initialRevision?: string | null;
  }

  let { repoRoot, initialRevision = null }: Props = $props();

  // The dialog opens once per request, so the prop is only read at the start.
  let revision = $state(untrack(() => initialRevision) ?? "HEAD");
  let mode = $state<ResetMode>("mixed");
  let resolved = $state<{ revision: string; commitId: string } | null>(null);
  let resolveError = $state<string | null>(null);
  let resolveToken = 0;

  const branch = $derived(repoStore.statuses[repoRoot]?.head.branch ?? "HEAD");
  const revisionError = $derived(validateRevision(revision));
  const canReset = $derived(
    revisionError === null && resolved?.revision === revision.trim() && resolveError === null && repoStore.busy === null,
  );

  $effect(() => {
    const text = revision.trim();
    if (validateRevision(text) !== null) {
      resolved = null;
      resolveError = null;
      return;
    }
    const timer = setTimeout(() => void resolve(text), 150);
    return () => clearTimeout(timer);
  });

  async function resolve(text: string): Promise<void> {
    const token = ++resolveToken;
    try {
      const commitId = await api.resolveRevision(repoRoot, text);
      if (token === resolveToken) {
        resolved = { revision: text, commitId };
        resolveError = null;
      }
    } catch (error) {
      if (token === resolveToken) {
        resolved = null;
        resolveError = errorMessage(error);
      }
    }
  }

  async function pickBranch(): Promise<void> {
    const refs = repoRoot === repoStore.repo?.root ? repoStore.refs : await api.getRefs(repoRoot).catch(() => null);
    const picked = decodeRefPick(
      await dialogs.pick({
        title: "Reset to Branch or Tag",
        placeholder: "Select a branch or tag",
        items: refPickItems(refs, { local: true, remote: true, tags: true, skipCurrent: true }),
        emptyText: "No other branches",
      }),
    );
    if (picked && picked.kind !== "create" && picked.kind !== "createFrom") {
      revision = picked.name;
    }
  }

  async function pickCommit(): Promise<void> {
    const commits: CommitSummary[] = await api.getLog(repoRoot, 0, 200, false).catch(() => []);
    const commitId = await dialogs.pick({
      title: "Reset to Commit",
      placeholder: "Filter by message, author or hash",
      items: commits.map((commit) => ({
        value: commit.id,
        label: commit.summary || commit.shortId,
        description: `${commit.shortId}  ${commit.authorName}`,
      })),
      emptyText: "No commits",
    });
    if (commitId) {
      revision = commitId;
    }
  }

  function close(): void {
    gitDialogs.close();
  }

  async function submit(): Promise<void> {
    const target = resolved;
    if (!canReset || !target) {
      return;
    }
    const shortId = target.commitId.slice(0, 8);
    if (mode === "hard") {
      const confirmed = await dialogs.confirm({
        title: "Hard Reset",
        message: `Reset ${branch} to ${target.revision} (${shortId}) and discard every uncommitted change? This cannot be undone.`,
        confirmLabel: "Reset",
        danger: true,
      });
      if (!confirmed) {
        return;
      }
    }
    const resetMode = mode;
    close();
    await repoStore.run("Reset", (repoPath) => api.resetTo(repoPath, target.commitId, resetMode), {
      repoPath: repoRoot,
      success: `Reset ${branch} to ${shortId} (${resetMode})`,
      action: () => undoAction(repoRoot, ["reset"]),
    });
  }
</script>

<GitDialogFrame title="Reset HEAD" width={540} onCancel={close} onSubmit={() => void submit()}>
  <label class="field">
    <span>Reset {branch} to</span>
    <div class="row">
      <input class="input mono revision" bind:value={revision} spellcheck="false" autocomplete="off" placeholder="HEAD, a commit id or a branch" />
      <button type="button" class="btn" onclick={() => void pickCommit()}>Commit...</button>
      <button type="button" class="btn" onclick={() => void pickBranch()}>Branch...</button>
    </div>
  </label>
  {#if revisionError && revision !== ""}
    <div class="error">{revisionError}</div>
  {:else if resolveError}
    <div class="error">{resolveError}</div>
  {:else if resolved}
    <div class="hint">Commit <span class="mono">{resolved.commitId.slice(0, 8)}</span></div>
  {/if}

  <fieldset class="modes">
    <legend class="hint">Reset type</legend>
    {#each RESET_MODES as option (option.value)}
      <label class="mode">
        <input type="radio" name="reset-mode" value={option.value} bind:group={mode} />
        <span class="mode-text">
          <span class="mode-label" class:danger={option.danger}>{option.label}</span>
          <span class="hint">{option.description}</span>
        </span>
      </label>
    {/each}
  </fieldset>

  {#snippet footer()}
    <span class="hint">&#8984;Enter to reset</span>
    <span class="spacer"></span>
    <button type="button" class="btn" onclick={close}>Cancel</button>
    <button type="button" class="btn primary" class:danger-fill={mode === "hard"} disabled={!canReset} onclick={() => void submit()}>
      Reset
    </button>
  {/snippet}
</GitDialogFrame>

<style>
  .revision {
    flex: 1;
    min-width: 0;
  }

  .modes {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 4px 0 0;
    padding: 0;
    border: none;
  }

  .modes legend {
    padding: 0;
    margin-bottom: 4px;
  }

  .mode {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .mode input {
    margin-top: 2px;
  }

  .mode-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .mode-label {
    font-weight: 500;
  }

  .mode-label.danger {
    color: var(--danger);
  }
</style>
