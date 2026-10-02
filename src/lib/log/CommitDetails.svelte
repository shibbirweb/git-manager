<script lang="ts">
  import { untrack } from "svelte";
  import { joinPath } from "$lib/stores/workspacePaths";
  import { api, errorMessage } from "$lib/api";
  import type { PreviewSides } from "$lib/diff/binaryPreview";
  import DiffView from "$lib/diff/DiffView.svelte";
  import type { ChangedFile, CommitDetails, FileDiff } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { parentRevision } from "$lib/views/files/previewSource";
  import { fileDir, fileName, fullDate, statusLetter } from "./format";
  import { findLine } from "./lineMatch";

  interface Props {
    repoPath: string;
    commitId: string;
    /** Short id of a commit if it is loaded in the table, otherwise null. */
    loadedShortId: (commitId: string) => string | null;
    onSelectCommit: (commitId: string) => void;
    /**
     * Open this file's diff when showing that commit (e.g. coming from blame).
     * `lineText` is set when `line` is only a guess, to find the real line.
     */
    preferredFile?: {
      commitId: string;
      path: string;
      line: number | null;
      lineText?: string | null;
      token: number;
    } | null;
    /**
     * Shows "Open in Tab" and makes a double-click on a changed file open the
     * commit in its own editor tab on that file. Left out inside the tab itself.
     */
    onOpenInTab?: ((filePath: string | null) => void) | null;
  }

  let { repoPath, commitId, loadedShortId, onSelectCommit, preferredFile = null, onOpenInTab = null }: Props = $props();

  let details = $state<CommitDetails | null>(null);
  let detailsError = $state<string | null>(null);
  let selectedPath = $state<string | null>(null);
  /** The diff on screen; kept while the next one loads to avoid flicker. */
  let shown = $state.raw<{
    key: string;
    path: string;
    label: string;
    diff: FileDiff;
    /** Where a binary image or PDF comes from: the first parent (none for a root commit) and the commit. */
    previewSides: PreviewSides;
  } | null>(null);
  let diffError = $state<string | null>(null);
  let diffLoading = $state(false);
  let leftWidth = $state(360);
  let bodyEl = $state<HTMLDivElement | null>(null);
  let filesEl = $state<HTMLDivElement | null>(null);

  let detailsToken = 0;
  let diffToken = 0;

  const current = $derived(details && details.id === commitId ? details : null);
  const files = $derived(details?.files ?? []);
  const selectedFile = $derived(current ? ((current.files ?? []).find((file) => file.path === selectedPath) ?? null) : null);
  /** The line of the diff on screen to scroll to, from `preferredFile`. */
  const revealLine = $derived.by(() => {
    const preferred = preferredFile;
    const diff = shown;
    if (!preferred || !diff || preferred.commitId !== commitId || preferred.line === null) {
      return null;
    }
    if (preferred.path !== diff.path && preferred.path !== selectedFile?.origPath) {
      return null;
    }
    return { line: findLine(diff.diff.modified, preferred.line, preferred.lineText ?? null), token: preferred.token };
  });
  const body = $derived.by(() => {
    const message = details?.message ?? "";
    const newline = message.indexOf("\n");
    return {
      subject: newline === -1 ? message.trim() : message.slice(0, newline).trim(),
      rest: newline === -1 ? "" : message.slice(newline + 1).replace(/^\s*\n/, "").trimEnd(),
    };
  });

  $effect(() => {
    void loadDetails(repoPath, commitId);
  });

  // Back / Forward to another file of the commit already on screen.
  $effect(() => {
    const preferred = preferredFile;
    const loaded = current;
    if (!preferred || !loaded || preferred.commitId !== loaded.id) {
      return;
    }
    const match = loaded.files.find((file) => file.path === preferred.path || file.origPath === preferred.path);
    if (match && match.path !== untrack(() => selectedPath)) {
      selectedPath = match.path;
    }
  });

  $effect(() => {
    const ready = current !== null;
    const file = selectedFile;
    if (!ready) {
      return;
    }
    if (!file) {
      shown = null;
      diffError = null;
      diffLoading = false;
      return;
    }
    void loadDiff(repoPath, commitId, file);
  });

  async function loadDetails(targetRepoPath: string, targetCommitId: string): Promise<void> {
    const token = ++detailsToken;
    detailsError = null;
    try {
      const result = await api.getCommitDetails(targetRepoPath, targetCommitId);
      if (token !== detailsToken) {
        return;
      }
      details = result;
      const preferred =
        preferredFile && preferredFile.commitId === targetCommitId
          ? result.files.find((file) => file.path === preferredFile.path || file.origPath === preferredFile.path)
          : undefined;
      const keep = result.files.some((file) => file.path === selectedPath);
      if (preferred) {
        selectedPath = preferred.path;
      } else if (!keep) {
        selectedPath = result.files[0]?.path ?? null;
      }
    } catch (error) {
      if (token !== detailsToken) {
        return;
      }
      details = null;
      shown = null;
      selectedPath = null;
      detailsError = errorMessage(error);
    }
  }

  async function loadDiff(targetRepoPath: string, targetCommitId: string, file: ChangedFile): Promise<void> {
    const token = ++diffToken;
    diffLoading = true;
    diffError = null;
    try {
      const result = await api.getCommitFileDiff(targetRepoPath, targetCommitId, file.path, file.origPath ?? null);
      if (token !== diffToken) {
        return;
      }
      // loadDiff runs once these details are loaded; their id is the full one the scheme needs.
      const commitFullId = details?.id ?? targetCommitId;
      const hasParent = (details?.parents.length ?? 0) > 0;
      shown = {
        key: `${targetCommitId}:${file.path}`,
        path: file.path,
        label: targetCommitId.slice(0, 8),
        diff: result,
        previewSides: {
          original: hasParent
            ? { kind: "revision", repoRoot: targetRepoPath, revision: parentRevision(commitFullId), filePath: file.origPath ?? file.path }
            : null,
          modified: { kind: "revision", repoRoot: targetRepoPath, revision: commitFullId, filePath: file.path },
        },
      };
    } catch (error) {
      if (token !== diffToken) {
        return;
      }
      shown = null;
      diffError = errorMessage(error);
    } finally {
      if (token === diffToken) {
        diffLoading = false;
      }
    }
  }

  async function copyHash(): Promise<void> {
    try {
      await navigator.clipboard.writeText(details?.id ?? commitId);
      toast.success("Copied revision hash");
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  function onFilesKeydown(event: KeyboardEvent): void {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    if (files.length === 0) {
      return;
    }
    const current = files.findIndex((file) => file.path === selectedPath);
    const next =
      event.key === "ArrowDown" ? Math.min(files.length - 1, current + 1) : Math.max(0, current === -1 ? 0 : current - 1);
    selectedPath = files[next]?.path ?? null;
    filesEl?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function startResize(event: PointerEvent): void {
    const container = bodyEl;
    if (!container) {
      return;
    }
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const left = container.getBoundingClientRect().left;
    const total = container.clientWidth;
    const move = (moveEvent: PointerEvent): void => {
      leftWidth = Math.max(220, Math.min(total - 240, moveEvent.clientX - left));
    };
    const stop = (): void => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }
</script>

<div class="details" bind:this={bodyEl}>
  <div class="left" style="width: {leftWidth}px">
    {#if detailsError}
      <div class="state dim">
        <Icon name="alert" size={16} />
        <span>Could not load commit: {detailsError}</span>
      </div>
    {:else if !details}
      <div class="state dim">Loading commit...</div>
    {:else}
      <section class="info">
        <div class="subject-row">
          <div class="subject selectable">{body.subject || "(no message)"}</div>
          {#if onOpenInTab}
            <button
              class="btn small open-tab"
              onclick={() => onOpenInTab?.(selectedPath)}
              title="Open this commit in an editor tab, with the diff in the whole editor area (or double-click the commit or a file)"
            >
              <Icon name="commit" size={13} />
              Open in Tab
            </button>
          {/if}
        </div>
        {#if body.rest}
          <pre class="message selectable">{body.rest}</pre>
        {/if}
        <dl class="meta">
          <dt>Author</dt>
          <dd class="selectable truncate" title={details.authorEmail}>
            {details.authorName}
            {#if details.authorEmail}<span class="dim">&lt;{details.authorEmail}&gt;</span>{/if}
          </dd>
          <dt>Date</dt>
          <dd class="selectable">{fullDate(details.authorTime)}</dd>
          {#if details.committerName && details.committerName !== details.authorName}
            <dt>Committer</dt>
            <dd class="selectable truncate">{details.committerName}, {fullDate(details.committerTime)}</dd>
          {/if}
          <dt>Hash</dt>
          <dd class="hash">
            <span class="mono selectable truncate">{details.id}</span>
            <button class="icon-btn tiny" onclick={copyHash} title="Copy revision hash">
              <Icon name="copy" size={12} />
            </button>
          </dd>
          {#if details.parents.length > 0}
            <dt>{details.parents.length > 1 ? "Parents" : "Parent"}</dt>
            <dd class="parents">
              {#each details.parents as parentId (parentId)}
                {@const loaded = loadedShortId(parentId)}
                <button
                  class="parent mono"
                  disabled={loaded === null}
                  onclick={() => onSelectCommit(parentId)}
                  title={loaded === null ? `${parentId} (not loaded yet)` : `Select ${parentId}`}
                >
                  {loaded ?? parentId.slice(0, 8)}
                </button>
              {/each}
            </dd>
          {/if}
        </dl>
      </section>
      <div class="files-header dim">
        {files.length === 1 ? "1 changed file" : `${files.length} changed files`}
      </div>
      <div class="files" role="listbox" tabindex="0" aria-label="Changed files" bind:this={filesEl} onkeydown={onFilesKeydown}>
        {#each files as file, index (file.path)}
          <div
            class="file"
            class:selected={file.path === selectedPath}
            role="option"
            tabindex="-1"
            aria-selected={file.path === selectedPath}
            data-index={index}
            onmousedown={() => (selectedPath = file.path)}
            ondblclick={() => onOpenInTab?.(file.path)}
            title={`${file.origPath ? `${file.origPath} -> ${file.path}` : file.path}${onOpenInTab ? "\nDouble-click to open in a tab" : ""}`}
          >
            <span class="status status-{file.status}">{statusLetter(file.status)}</span>
            <span class="name truncate" class:deleted={file.status === "deleted"}>{fileName(file.path)}</span>
            <span class="dir dim truncate">{file.origPath ? `from ${fileName(file.origPath)} ` : ""}{fileDir(file.path)}</span>
          </div>
        {:else}
          <div class="state dim">No file changes</div>
        {/each}
      </div>
    {/if}
  </div>
  <div class="splitter" role="separator" aria-orientation="vertical" onpointerdown={startResize}></div>
  <div class="right">
    {#if diffError}
      <div class="state dim">
        <Icon name="alert" size={16} />
        <span>Could not load diff: {diffError}</span>
      </div>
    {:else if shown}
      {#key shown.key}
        <DiffView
          diff={shown.diff}
          path={shown.path}
          mode="readonly"
          leftLabel="Parent"
          rightLabel={shown.label}
          blame={shown.diff.modified === ""
            ? null
            : {
                repoRoot: repoPath,
                filePath: shown.path,
                revision: commitId,
                origin: (line) => ({ kind: "log", repoRoot: repoPath, commitId, filePath: shown?.path ?? null, line }),
              }}
          {revealLine}
          workingFile={{ filePath: joinPath(repoPath, shown.path), sameLines: false }}
          previewSides={shown.previewSides}
        />
      {/key}
    {:else if diffLoading}
      <div class="state dim">Loading diff...</div>
    {:else}
      <div class="state dim">Select a file to see its changes</div>
    {/if}
  </div>
</div>

<style>
  .details {
    flex: 1;
    display: flex;
    min-height: 0;
    min-width: 0;
  }

  .left {
    flex: none;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .right {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .splitter {
    flex: none;
    width: 5px;
    margin: 0 -2px;
    position: relative;
    z-index: 1;
    cursor: col-resize;
    background: linear-gradient(to right, transparent 2px, var(--border-strong) 2px, var(--border-strong) 3px, transparent 3px);
  }

  .state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    text-align: center;
  }

  .right .state {
    flex: 1;
  }

  .info {
    flex: none;
    max-height: 45%;
    overflow: auto;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-strong);
  }

  .subject-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .subject-row .subject {
    flex: 1;
    min-width: 0;
  }

  .open-tab {
    flex: none;
    gap: 5px;
  }

  .subject {
    font-weight: 600;
    line-height: 1.4;
    word-break: break-word;
  }

  .message {
    margin: 6px 0 0;
    font-family: var(--font-ui);
    font-size: 12.5px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text);
  }

  .meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 10px;
    margin: 10px 0 0;
    font-size: 12px;
  }

  .meta dt {
    color: var(--text-dim);
  }

  .meta dd {
    margin: 0;
    min-width: 0;
  }

  .hash {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .icon-btn.tiny {
    height: 20px;
    min-width: 20px;
    padding: 0 3px;
    color: var(--text-dim);
  }

  .parents {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .parent {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font-size: 12px;
    cursor: pointer;
  }

  .parent:hover:not(:disabled) {
    text-decoration: underline;
  }

  .parent:disabled {
    color: var(--text-dim);
    cursor: default;
  }

  .files-header {
    flex: none;
    padding: 6px 12px 4px;
    font-size: 11.5px;
  }

  .files {
    flex: 1;
    min-height: 0;
    overflow: auto;
    outline: none;
    padding-bottom: 4px;
  }

  .file {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 12px;
    cursor: pointer;
  }

  .file:hover {
    background: var(--hover);
  }

  .file.selected {
    background: var(--selected-inactive);
  }

  .files:focus-within .file.selected,
  .files:focus .file.selected {
    background: var(--selected);
  }

  .status {
    flex: none;
    width: 12px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-weight: 700;
    text-align: center;
    color: var(--accent);
  }

  .status-added {
    color: var(--success);
  }

  .status-deleted {
    color: var(--danger);
  }

  .status-renamed,
  .status-copied {
    color: color-mix(in srgb, var(--accent) 55%, var(--danger));
  }

  .status-typechange {
    color: var(--warning);
  }

  .name {
    flex: none;
    max-width: 70%;
  }

  .name.deleted {
    color: var(--text-dim);
    text-decoration: line-through;
  }

  .dir {
    flex: 1;
    min-width: 0;
    font-size: 12px;
  }
</style>
