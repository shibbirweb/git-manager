<!-- Standalone window used when git runs us as `mergetool`. -->
<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { onMount } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { settings } from "$lib/stores/settings.svelte";
  import type { MergeDocument } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import MergeEditor from "./MergeEditor.svelte";

  let doc = $state.raw<MergeDocument | null>(null);
  let loadError = $state<string | null>(null);
  let version = $state(0);
  let editor = $state<ReturnType<typeof MergeEditor> | null>(null);

  onMount(() => {
    void load(settings.ignoreWhitespace);
    const unlisten = watchClose();
    return () => {
      void unlisten.then((stop) => stop?.());
    };
  });

  /**
   * Closing the window works like Cancel: it asks before dropping an edited result. The
   * window itself is never closed here; cancelling exits the app with the unresolved status.
   */
  async function watchClose(): Promise<(() => void) | null> {
    try {
      return await getCurrentWindow().onCloseRequested((event) => {
        event.preventDefault();
        if (!dialogs.active) {
          void (editor ? editor.cancel() : cancel());
        }
      });
    } catch {
      return null;
    }
  }

  async function load(ignoreWhitespace: boolean): Promise<void> {
    try {
      doc = await api.loadMergetool(ignoreWhitespace);
      loadError = null;
      version++;
      const name = doc.path.split("/").pop() ?? doc.path;
      await getCurrentWindow()
        .setTitle(`Merge ${name}`)
        .catch(() => undefined);
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
    if (!doc) {
      return;
    }
    try {
      // Exits the process with status 0 so git marks the file resolved.
      await api.saveMergetool(content, doc.eol);
    } catch (error) {
      toast.error("Could not save the merge result", errorMessage(error));
    }
  }

  function cancel(): void {
    void api.cancelMergetool();
  }
</script>

<div class="mergetool">
  <div class="title-bar">
    <Icon name="merge" size={15} />
    <span class="title">Merge Revisions for</span>
    <span class="path mono truncate selectable">{doc?.path ?? ""}</span>
  </div>
  <div class="content">
    {#if loadError}
      <div class="notice">
        <p>Could not load the files passed by git mergetool.</p>
        <pre class="selectable">{loadError}</pre>
        <button class="btn" onclick={cancel}>Quit</button>
      </div>
    {:else if doc?.binary}
      <div class="notice">
        <p>Binary files cannot be merged here. Quit and resolve with <code>git checkout --ours/--theirs</code>.</p>
        <button class="btn" onclick={cancel}>Quit</button>
      </div>
    {:else if doc}
      {#key version}
        <MergeEditor bind:this={editor} {doc} onApply={applyResult} onCancel={cancel} onReload={reload} />
      {/key}
    {:else}
      <div class="notice dim">Loading...</div>
    {/if}
  </div>
</div>

<style>
  .mergetool {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--panel);
  }

  .title-bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    padding: 0 14px;
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
    max-width: 520px;
    text-align: center;
  }

  .notice p {
    margin: 0;
  }

  .notice pre {
    white-space: pre-wrap;
    font-size: 12px;
    color: var(--text-dim);
  }
</style>
