<!-- Compare Files: two workspace files, or the clipboard and a file, as a read-only diff in
     its own tab. While the tab is on screen it follows the files: a change on disk asks the
     backend, which answers with nothing when both versions are the same (two stats), and a
     side open with unsaved edits is checked every few seconds. A hidden tab does no work. -->
<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import type { PreviewSides } from "$lib/diff/binaryPreview";
  import DiffView from "$lib/diff/DiffView.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { FileCompare } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { compareStore, type SideInput } from "./compareStore.svelte";
  import { type CompareSideRef, parseCompareTabPath, sideLabels } from "./compareTabs";

  interface Props {
    tabPath: string;
  }

  let { tabPath }: Props = $props();

  /** How often a side with unsaved edits is looked at while the tab is on screen. */
  const BUFFER_POLL_MS = 2000;

  const ref = $derived(parseCompareTabPath(tabPath));
  const names = $derived(ref ? sideLabels(ref) : ["", ""]);

  let root = $state<HTMLDivElement | null>(null);
  let visible = $state(false);
  let result = $state.raw<FileCompare | null>(null);
  let loadError = $state<string | null>(null);
  let clipGone = $state(false);
  /** Which side showed unsaved edits in the last load. */
  let unsaved = $state<[boolean, boolean]>([false, false]);
  /** Bumped on every new result, so a binary preview reads the files again. */
  let previewVersion = $state(0);
  let loadToken = 0;
  let knownVersion: string | null = null;
  /** Texts last sent, so an unchanged buffer is not sent again. */
  let sentTexts: [string | null, string | null] = [null, null];

  const leftLabel = $derived(`${names[0]}${unsaved[0] ? " (unsaved)" : ""}`);
  const rightLabel = $derived(`${names[1]}${unsaved[1] ? " (unsaved)" : ""}`);
  const rightFile = $derived(ref?.right.kind === "file" ? ref.right.filePath : null);

  /** Images and PDFs show side by side when both sides are files on disk. */
  const previewSides = $derived.by((): PreviewSides | null => {
    if (!ref || !result || ref.left.kind !== "file" || ref.right.kind !== "file" || unsaved[0] || unsaved[1]) {
      return null;
    }
    return {
      original: result.leftMissing ? null : { kind: "worktree", filePath: ref.left.filePath },
      modified: result.rightMissing ? null : { kind: "worktree", filePath: ref.right.filePath },
      version: previewVersion,
    };
  });

  const missingNote = $derived.by((): string | null => {
    if (!result || !ref) {
      return null;
    }
    if (result.leftMissing && result.rightMissing) {
      return "Neither file exists.";
    }
    if (result.leftMissing) {
      return `${names[0]} does not exist: everything shows as added.`;
    }
    return result.rightMissing ? `${names[1]} does not exist: everything shows as deleted.` : null;
  });

  const binaryNote = $derived.by((): string | null => {
    if (!result || !result.diff.binary || previewSides) {
      return null;
    }
    return result.identical ? "The two files are the same." : "The two files differ.";
  });

  // Only a tab on screen loads: a hidden one has no size.
  $effect(() => {
    const element = root;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => {
      visible = element.offsetWidth > 0 && element.offsetHeight > 0;
    });
    observer.observe(element);
    return () => observer.disconnect();
  });

  // Files changed on disk, a side gained or lost unsaved edits, or the tab came on screen.
  $effect(() => {
    void repoStore.fileVersions;
    void repoStore.workspaceVersion;
    const current = ref;
    if (!current) {
      return;
    }
    // Gaining or losing unsaved edits changes what a side sends.
    for (const side of [current.left, current.right]) {
      if (side.kind === "file") {
        void repoStore.isDirty(side.filePath);
      }
    }
    if (visible) {
      untrack(() => void load(current));
    }
  });

  // While on screen, a side with unsaved edits is checked now and then.
  $effect(() => {
    const current = ref;
    if (!visible || !current) {
      return;
    }
    const timer = setInterval(() => {
      if ([current.left, current.right].some((side) => side.kind === "file" && repoStore.isDirty(side.filePath))) {
        void load(current);
      }
    }, BUFFER_POLL_MS);
    return () => clearInterval(timer);
  });

  onDestroy(() => {
    // A clipboard text goes with the last tab that shows it.
    setTimeout(() => compareStore.prune(), 0);
  });

  async function load(current: { left: CompareSideRef; right: CompareSideRef }): Promise<void> {
    const inputs: (SideInput | null)[] = [compareStore.sideInput(current.left), compareStore.sideInput(current.right)];
    const [left, right] = inputs;
    if (!left || !right) {
      clipGone = true;
      return;
    }
    const texts: [string | null, string | null] = [left.side.text, right.side.text];
    // Unchanged texts (and files, checked by the backend) need no new diff.
    const known = texts[0] === sentTexts[0] && texts[1] === sentTexts[1] ? knownVersion : null;
    const token = ++loadToken;
    try {
      const next = await api.compareFiles(left.side, right.side, known);
      if (token !== loadToken) {
        return;
      }
      loadError = null;
      if (next) {
        result = next;
        knownVersion = next.version;
        sentTexts = texts;
        unsaved = [left.unsaved, right.unsaved];
        previewVersion++;
      }
    } catch (error) {
      if (token === loadToken) {
        loadError = errorMessage(error);
      }
    }
  }
</script>

<div class="compare-files" bind:this={root}>
  {#if !ref}
    <div class="placeholder dim">This compare tab cannot be read.</div>
  {:else if clipGone}
    <div class="placeholder dim">The clipboard text of this tab is gone. Close the tab and compare again.</div>
  {:else if loadError}
    <div class="placeholder">
      <Icon name="alert" size={18} />
      <div>Could not compare the files</div>
      <div class="dim selectable">{loadError}</div>
    </div>
  {:else if result}
    {#if missingNote}
      <div class="note dim">{missingNote}</div>
    {/if}
    {#if binaryNote}
      <div class="note dim">{binaryNote}</div>
    {/if}
    <DiffView
      diff={result.diff}
      path={result.diff.path}
      mode="readonly"
      {leftLabel}
      {rightLabel}
      workingFile={rightFile && !result.rightMissing ? { filePath: rightFile, sameLines: true } : null}
      {previewSides}
    />
  {:else}
    <div class="placeholder dim">Loading...</div>
  {/if}
</div>

<style>
  .compare-files {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--editor-bg);
  }

  .note {
    flex: none;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border-strong);
    background: var(--panel-alt);
    font-size: 12px;
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
</style>
