<!-- A file's diff: the toolbar (DiffToolbar), and the two sides side by side or inline in the library's DiffFrame,
     whose editors diffEditors.svelte.ts builds. Binary files show a preview, Git LFS files their sizes. -->
<script lang="ts">
  import DiffFrame from "@git-manager/ui/components/DiffFrame.svelte";
  import type { DiffFrameParts } from "@git-manager/ui/components/DiffFrame.svelte";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import { untrack } from "svelte";
  import { type BlameTarget, setBlameDisplay } from "$lib/editor/blame";
  import { settings } from "$lib/stores/settings.svelte";
  import type { FileDiff, LineAction, LineSelection } from "$lib/types";
  import { toast } from "$lib/ui/toast.svelte";
  import { lfsContentChanged, lfsSizeText } from "$lib/views/git/lfs/lfsModel";
  import { type PreviewSides, showsBinaryPreview } from "./binaryPreview";
  import { DiffEditors, type DiffMode } from "./diffEditors.svelte";
  import { openLineMenu } from "./diffLineMenu";
  import { openWorkingFile } from "./openWorkingFile";
  import { diffLines } from "./diffLines.svelte";
  import DiffToolbar from "./DiffToolbar.svelte";
  import { selectionSize } from "./lineSelection";
  import { diffPrefs } from "./prefs.svelte";
  import { clampDiffSplit } from "./split";

  interface Props {
    diff: FileDiff;
    /** Repo-relative path, used for language detection. */
    path: string;
    /**
     * unstaged: left = index, right = work tree; chunk control stages (right -> left).
     * staged: left = HEAD, right = index; chunk control unstages (left -> right).
     * readonly: no chunk controls (commit diffs).
     */
    mode: DiffMode;
    leftLabel: string;
    rightLabel: string;
    /** Called with the full new text of the side a chunk control changed. */
    onChange?: (target: "original" | "modified", content: string) => void;
    /** Blame the right side: which commit last touched each line. */
    blame?: BlameTarget | null;
    /** Scroll the right side to this 0-based line (Back / Forward); a new token repeats it. */
    revealLine?: { line: number; token: number } | null;
    /**
     * The file in the work tree (absolute path), for the Open File button. `sameLines` when the
     * right side is the work tree itself, so the file opens at the line you are on.
     */
    workingFile?: { filePath: string; sameLines: boolean } | null;
    /** Where the two sides come from, so a binary image or PDF shows side by side. */
    previewSides?: PreviewSides | null;
    /**
     * Stage, Unstage or Discard Selected Lines (the Changes diff): called with the changed
     * lines the selection picks. Without it the diff offers no line actions. A change's Revert
     * button (unstaged only) calls it with discard, the change's lines and `wholeChange`.
     */
    onLines?: ((action: LineAction, selection: LineSelection, wholeChange?: boolean) => void) | null;
    /** Offers the 3-pane layout in the toolbar (a merge commit's file, or the Changes diff's staging view). */
    onThreePanes?: (() => void) | null;
  }

  let {
    diff,
    path,
    mode,
    leftLabel,
    rightLabel,
    onChange,
    blame = null,
    revealLine = null,
    workingFile = null,
    previewSides = null,
    onLines = null,
    onThreePanes = null,
  }: Props = $props();

  const editors = new DiffEditors(() => revealLine);
  let parts = $state<DiffFrameParts | null>(null);
  /** False while the diff is hidden (a background tab), so the preview frees its files. */
  let previewShown = $state(false);

  /** A Git LFS file: its sizes replace the pointer text. */
  const lfs = $derived(diff.lfs ?? null);
  const textual = $derived(!diff.binary && !diff.tooLarge && lfs === null);
  const identical = $derived(textual && diff.original === diff.modified);
  const binaryPreview = $derived(showsBinaryPreview(diff, path, previewSides));
  const inline = $derived(settings.diffLayout === "inline");
  const fileName = $derived(path.split("/").pop() ?? path);
  /** Which line actions the diff offers: Stage and Discard (unstaged), Unstage (staged), or none. */
  const lineMode = $derived(onLines && textual && !identical && mode !== "readonly" ? mode : null);
  /** Each unstaged change has a Revert button: its work tree lines go back to the staged version. */
  const reverts = $derived(lineMode === "unstaged");

  // A reveal for the diff that is already on screen.
  $effect(() => {
    void revealLine;
    const editor = editors.newEditor();
    if (editor) {
      editors.applyReveal(editor);
    }
  });

  // Apply the blame preferences to the open diff as they change.
  $effect(() => {
    const display = { inline: settings.currentLineBlame, gutter: settings.blameGutter };
    const editor = editors.newEditor();
    if (editor && blame) {
      setBlameDisplay(editor, display);
    }
  });

  // The Git menu and the Command Palette run the line actions here while this diff is shown.
  $effect(() => {
    const target = lineMode;
    if (!target) {
      return;
    }
    return diffLines.attach({ mode: target, run: (action) => runLines(action) });
  });

  $effect(() => {
    const target = parts;
    if (!target || !textual || identical) {
      return;
    }
    const collapse = diffPrefs.collapseUnchanged;
    const layout = settings.diffLayout;
    const scrollKey = `${mode}:${collapse}:${layout}:${path}`;
    // Blame and the change callback are read when built, as before, without rebuilding when they change.
    const { blameTarget, changed, revert } = untrack(() => ({
      blameTarget: blame,
      changed: onChange,
      revert: reverts ? revertChange : null,
    }));
    void editors.build({
      parts: target,
      diff,
      path,
      mode,
      collapse,
      layout,
      scrollKey,
      blame: blameTarget,
      onChange: changed,
      onRevert: revert,
    });
    return () => editors.teardown(scrollKey);
  });

  function runLines(action: LineAction): void {
    const selection = editors.currentSelection();
    if (selectionSize(selection) === 0) {
      toast.info("Select changed lines first", "Select lines in the diff, or put the cursor on a change.");
      return;
    }
    onLines?.(action, selection);
  }

  function revertChange(selection: LineSelection | null): void {
    if (selection && selectionSize(selection) > 0) {
      onLines?.("discard", selection, true);
    }
  }

  /** Opens the real file in an editor tab, at the same line when the right side is the work tree. */
  function openFile(): void {
    const target = workingFile;
    if (!target) {
      return;
    }
    const editor = editors.newEditor();
    void openWorkingFile(target.filePath, target.sameLines && editor ? editors.lineOnScreen(editor) : null);
  }
</script>

<Stack gap="none" grow surface="editor" role="region" label="Diff">
  <DiffToolbar
    {editors}
    textDiff={textual && !identical}
    {inline}
    showBlame={blame !== null}
    showOpenFile={workingFile !== null}
    {lineMode}
    {path}
    onopenfile={openFile}
    onlines={runLines}
    onthreepanes={onThreePanes}
  />
  {#if !textual}
    {#if binaryPreview && previewSides}
      <Stack gap="none" grow onshown={(shown) => (previewShown = shown)}>
        {#if previewShown}
          {#await import("./BinaryPreview.svelte") then preview}
            <preview.default sides={previewSides} {leftLabel} {rightLabel} {path} />
          {/await}
        {/if}
      </Stack>
    {:else if lfs}
      <EmptyState
        title="Stored in Git LFS"
        strong
        hint="{lfsSizeText(lfs)}{lfsContentChanged(lfs) ? '' : ', same content'}"
      />
    {:else}
      <EmptyState titleTone="dim" title={diff.tooLarge ? "File too large to diff" : "Binary file, no text diff"} />
    {/if}
  {:else if identical}
    <EmptyState titleTone="dim" title="No content changes" />
  {:else}
    <DiffFrame
      layout={inline ? "inline" : "split"}
      label="Diff of {fileName}"
      sideLabels={{ original: leftLabel, modified: rightLabel }}
      ribbons={inline ? null : editors.ribbons}
      applySide={mode === "unstaged" ? "right" : "left"}
      onapply={mode === "readonly" || inline ? undefined : (index) => editors.copyChange(index)}
      applyTitle={mode === "unstaged" ? "Stage this change" : "Unstage this change"}
      onrevert={reverts && !inline ? (index) => revertChange(editors.changeLines(index)) : undefined}
      revertTitle="Revert this change"
      colors="sides"
      ruler
      bind:ratio={() => clampDiffSplit(settings.diffSplitRatio), (ratio) => (settings.diffSplitRatio = ratio)}
      oncommitratio={() => settings.save()}
      onready={(ready) => {
        parts = ready;
        return () => (parts = null);
      }}
      oncontextmenu={(event) => {
        if (lineMode) {
          openLineMenu(event, editors, lineMode, runLines);
        }
      }}
    />
  {/if}
</Stack>
