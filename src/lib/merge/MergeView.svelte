<script lang="ts">
  import { onMount } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import type { MergeDocument, Side } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import MergeEditor from "./MergeEditor.svelte";

  let { repoPath, conflictPath }: { repoPath: string; conflictPath: string } = $props();

  let doc = $state.raw<MergeDocument | null>(null);
  let loadError = $state<string | null>(null);
  let version = $state(0);
  /** The user chose to merge a modify/delete conflict as text. */
  let forceText = $state(false);
  let editor = $state<ReturnType<typeof MergeEditor> | null>(null);

  onMount(() => {
    void load(settings.ignoreWhitespace);
  });

  async function load(ignoreWhitespace: boolean): Promise<void> {
    try {
      doc = await api.loadConflict(repoPath, conflictPath, ignoreWhitespace);
      loadError = null;
      version++;
    } catch (error) {
      loadError = errorMessage(error);
    }
  }

  function reload(ignoreWhitespace: boolean): void {
    settings.ignoreWhitespace = ignoreWhitespace;
    settings.save();
    void load(ignoreWhitespace);
  }

  async function applyResult(content: string): Promise<void> {
    const current = doc;
    if (!current) {
      return;
    }
    const saved = await repoStore.run(
      "Save resolution",
      (path) => api.saveResolution(path, conflictPath, content, current.eol).then(() => true),
      { success: `Resolved ${conflictPath}` },
    );
    if (saved) {
      repoStore.closeMerge();
    }
  }

  async function acceptSide(side: Side): Promise<void> {
    const done = await repoStore.run(
      side === "ours" ? "Accept yours" : "Accept theirs",
      (path) => api.acceptSide(path, [conflictPath], side).then(() => true),
      { success: `Resolved ${conflictPath}` },
    );
    if (done) {
      repoStore.closeMerge();
    }
  }

  /** The close button works like Cancel, so an edited result is only discarded after asking. */
  function close(): void {
    if (editor) {
      void editor.cancel();
    } else {
      repoStore.closeMerge();
    }
  }

  const fileLevelReason = $derived.by(() => {
    if (!doc) {
      return null;
    }
    if (doc.binary) {
      return "This file is binary, so it can only be resolved by picking one version.";
    }
    if (forceText) {
      return null;
    }
    if (doc.kind === "deletedByUs") {
      return "This file was deleted on your side and modified on theirs.";
    }
    if (doc.kind === "deletedByThem") {
      return "This file was modified on your side and deleted on theirs.";
    }
    return null;
  });
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label="Merge {conflictPath}">
  <div class="title-bar">
    <Icon name="merge" size={15} />
    <span class="title">Merge Revisions for</span>
    <span class="path mono truncate selectable">{conflictPath}</span>
    <div class="spacer"></div>
    <button class="icon-btn" onclick={close} title="Close" aria-label="Close merge">
      <Icon name="x" size={15} />
    </button>
  </div>

  <div class="content">
    {#if loadError}
      <div class="notice">
        <Icon name="alert" size={22} />
        <p>Could not load this conflict.</p>
        <pre class="selectable">{loadError}</pre>
        <button class="btn" onclick={() => repoStore.closeMerge()}>Close</button>
      </div>
    {:else if doc && fileLevelReason}
      <div class="notice">
        <Icon name="alert" size={22} />
        <p>{fileLevelReason}</p>
        <div class="choices">
          <button class="btn" onclick={() => acceptSide("ours")}>
            {doc.kind === "deletedByUs" ? "Keep Deleted" : "Accept Yours"}
            <span class="dim">{doc.oursLabel}</span>
          </button>
          <button class="btn" onclick={() => acceptSide("theirs")}>
            {doc.kind === "deletedByThem" ? "Keep Deleted" : "Accept Theirs"}
            <span class="dim">{doc.theirsLabel}</span>
          </button>
          {#if !doc.binary}
            <button class="btn" onclick={() => (forceText = true)}>Merge Text Anyway</button>
          {/if}
        </div>
        <button class="btn" onclick={() => repoStore.closeMerge()}>Cancel</button>
      </div>
    {:else if doc}
      {#key version}
        <MergeEditor bind:this={editor} {doc} onApply={applyResult} onCancel={() => repoStore.closeMerge()} onReload={reload} />
      {/key}
    {:else}
      <div class="notice dim">Loading...</div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 500;
    display: flex;
    flex-direction: column;
    background: var(--panel);
  }

  .title-bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 8px 0 14px;
    border-bottom: 1px solid var(--border-strong);
    color: var(--text-dim);
  }

  .title {
    font-weight: 600;
    color: var(--text);
  }

  .path {
    min-width: 0;
    color: var(--text);
  }

  .spacer {
    flex: 1;
  }

  .content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .notice {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 560px;
    text-align: center;
    color: var(--text);
  }

  .notice p {
    margin: 0;
  }

  .notice pre {
    max-width: 100%;
    white-space: pre-wrap;
    font-size: 12px;
    color: var(--text-dim);
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
</style>
