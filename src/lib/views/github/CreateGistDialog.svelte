<!-- Create Gist: the file on screen (or its selection) as a secret or public gist, with a
     preview of exactly what is uploaded. -->
<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import GitDialogFrame from "../git/GitDialogFrame.svelte";
  import { closeGitHubDialog, openGitHubDialog } from "./githubDialogs";
  import { validateGistFileName } from "./githubModel";

  interface Props {
    fileName: string;
    content: string;
    fromSelection: boolean;
  }

  let { fileName: initialFileName, content, fromSelection }: Props = $props();

  /** The preview shows this much; the whole content is uploaded. */
  const PREVIEW_CHARS = 20_000;

  // svelte-ignore state_referenced_locally
  let fileName = $state(initialFileName);
  let description = $state("");
  let isPublic = $state(false);
  let working = $state(false);
  let problem = $state<string | null>(null);

  const fileNameError = $derived(validateGistFileName(fileName));
  const empty = $derived(content.trim() === "");
  const lineCount = $derived(content === "" ? 0 : content.split("\n").length);
  const preview = $derived(content.length > PREVIEW_CHARS ? `${content.slice(0, PREVIEW_CHARS)}\n...` : content);
  const canCreate = $derived(!working && fileNameError === null && !empty);

  function close(): void {
    if (!working) {
      closeGitHubDialog();
    }
  }

  async function submit(): Promise<void> {
    if (!canCreate) {
      return;
    }
    if (isPublic) {
      const confirmed = await dialogs.confirm({
        title: "Create Public Gist",
        message: "A public gist is listed on your profile and can be found by anyone. Create it as public?",
        confirmLabel: "Create Public",
        danger: true,
      });
      if (!confirmed) {
        return;
      }
    }
    working = true;
    problem = null;
    try {
      const gist = await api.githubCreateGist({
        fileName: fileName.trim(),
        description: description.trim(),
        public: isPublic,
        content,
      });
      openGitHubDialog({
        kind: "result",
        title: "Gist Created",
        message: `${isPublic ? "Public" : "Secret"} gist with ${fileName.trim()}.${isPublic ? "" : " Anyone with the link can see it."}`,
        url: gist.htmlUrl,
        openLabel: "Open Gist",
        problem: null,
      });
    } catch (error) {
      problem = errorMessage(error);
      working = false;
    }
  }
</script>

<GitDialogFrame title="Create Gist" width={600} closable={!working} onCancel={close} onSubmit={() => void submit()}>
  <div class="row two">
    <label class="field grow">
      <span>File name</span>
      <input class="input" bind:value={fileName} disabled={working} spellcheck="false" autocomplete="off" data-autofocus />
    </label>
    <div class="field">
      <span>Visibility</span>
      <div class="segmented" role="radiogroup" aria-label="Gist visibility">
        <button type="button" role="radio" aria-checked={!isPublic} class:on={!isPublic} disabled={working} onclick={() => (isPublic = false)}>
          Secret
        </button>
        <button type="button" role="radio" aria-checked={isPublic} class:on={isPublic} disabled={working} onclick={() => (isPublic = true)}>
          Public
        </button>
      </div>
    </div>
  </div>
  {#if fileNameError}
    <div class="error">{fileNameError}</div>
  {/if}
  <label class="field">
    <span>Description</span>
    <input class="input" bind:value={description} disabled={working} placeholder="Optional" autocomplete="off" />
  </label>
  <div class="field">
    <span>{fromSelection ? "Selection" : "Whole file"}, {lineCount} {lineCount === 1 ? "line" : "lines"}</span>
    <pre class="preview selectable">{preview}</pre>
  </div>
  {#if empty}
    <div class="error">There is nothing to share: the {fromSelection ? "selection" : "file"} is empty.</div>
  {/if}
  {#if problem}
    <div class="error selectable">{problem}</div>
  {/if}

  {#snippet footer()}
    <button type="button" class="btn" onclick={close} disabled={working}>Cancel</button>
    <button type="button" class="btn primary" disabled={!canCreate} onclick={() => void submit()}>
      {working ? "Creating..." : "Create Gist"}
    </button>
  {/snippet}
</GitDialogFrame>

<style>
  .two {
    align-items: flex-start;
  }

  .grow {
    flex: 1;
    min-width: 0;
  }

  .segmented {
    display: inline-flex;
    height: 28px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .segmented button {
    padding: 0 12px;
    border: none;
    background: var(--panel);
    color: var(--text-dim);
    font: inherit;
    cursor: pointer;
  }

  .segmented button + button {
    border-left: 1px solid var(--border-strong);
  }

  .segmented button.on {
    background: var(--selected);
    color: var(--text);
  }

  .preview {
    margin: 0;
    max-height: 220px;
    overflow: auto;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--editor-bg);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 11.5px;
    line-height: 1.45;
    white-space: pre;
    tab-size: 4;
  }
</style>
