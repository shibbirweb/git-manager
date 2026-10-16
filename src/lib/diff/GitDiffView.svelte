<!-- Every file diff in the app: the same toolbar, layouts and buttons wherever it shows (the Changes diff and tab, a
     commit, a compare, a shelf, local history). `source` says what it compares; from it this view picks the three
     panes that fit (HEAD | index | work tree, parent 1 | merge | parent 2, or older | newer | work tree), loads
     them when side by side uses three columns, and wires each change's Stage, Unstage, Revert and Apply. -->
<script lang="ts">
  import { untrack } from "svelte";
  import type { BlameTarget } from "$lib/editor/blame";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { joinPath } from "$lib/stores/workspacePaths";
  import type { FileDiff, LineAction, LineSelection } from "$lib/types";
  import { StagingDiffs } from "$lib/views/changes/stagingDiffs.svelte";
  import type { PreviewSides } from "./binaryPreview";
  import { changeWorkTree, writeIndex } from "./diffActions";
  import { setDiffLayout, showsThreeColumns, showThreeColumns } from "./diffPanes";
  import { changeRevisions, type DiffSource, panesKey, THREE_PANE_TITLES, threePaneKind } from "./diffSource";
  import DiffView from "./DiffView.svelte";
  import ThreePaneDiff from "./ThreePaneDiff.svelte";
  import type { ThreeWayPane } from "./threeWayBlame";
  import { WorkTreePane } from "./workTreePane.svelte";

  interface Props {
    source: DiffSource;
    /** The two-pane diff, loaded by the place that shows it. */
    diff: FileDiff;
    /** The path shown in the toolbar (repo-relative, maybe with the repository's name). */
    path: string;
    labels: { left: string; right: string };
    /** Who wrote each line of the newer side. */
    blame?: BlameTarget | null;
    revealLine?: { line: number; token: number } | null;
    previewSides?: PreviewSides | null;
    /** A plain diff's file for Open File; git sources find their own. */
    workingFile?: { filePath: string; sameLines: boolean } | null;
    /** The Changes diff's Stage, Unstage and Discard Selected Lines, and its band arrows. */
    onLines?: ((action: LineAction, selection: LineSelection, wholeChange?: boolean) => void) | null;
    onChange?: (target: "original" | "modified", content: string) => void;
  }

  let {
    source,
    diff,
    path,
    labels,
    blame = null,
    revealLine = null,
    previewSides = null,
    workingFile = null,
    onLines = null,
    onChange,
  }: Props = $props();

  const fileName = $derived(path.split("/").pop() ?? path);
  const repoRoot = $derived(source.kind === "plain" ? null : source.repoRoot);
  const kind = $derived(threePaneKind(source, diff));
  const key = $derived(panesKey(source));
  const threeOn = $derived(kind !== null && showsThreeColumns(key));
  const revisions = $derived(changeRevisions(source));
  /** The work tree file is gone (a deleted file in the Changes tab): nothing to revert or open. */
  const workTreeGone = $derived(
    source.kind === "head" && [source.status?.staged, source.status?.unstaged].includes("deleted"),
  );

  const mode = $derived(
    source.kind === "changes" ? (source.area === "staged" ? ("staged" as const) : ("unstaged" as const)) : "readonly",
  );

  const openTarget = $derived.by(() => {
    if (source.kind === "plain") {
      return workingFile;
    }
    if (workTreeGone) {
      return null;
    }
    const filePath = joinPath(source.repoRoot, source.filePath);
    switch (source.kind) {
      case "changes":
        return { filePath, sameLines: source.area !== "staged" };
      case "head":
        return { filePath, sameLines: true };
      case "commit":
        return { filePath, sameLines: false };
      case "revisions":
        return { filePath, sameLines: source.to === null };
    }
  });

  // The loaded third pane: the index and the work tree (staging), or the work tree against the newer side.
  const staging = new StagingDiffs();
  const workTree = new WorkTreePane();
  $effect(() => {
    const current = source;
    const shown = kind;
    const on = threeOn;
    const middle = diff.modified;
    if (!on || shown === "merge" || current.kind === "plain") {
      untrack(() => {
        staging.clear();
        workTree.clear();
      });
      return;
    }
    // A new status (after staging, or an edit) loads the panes again.
    void repoStore.statuses[current.repoRoot];
    void repoStore.fileVersions[current.repoRoot];
    untrack(() => {
      if (shown === "staging") {
        void staging.load(current.repoRoot, current.filePath);
      } else if (revisions?.newRevision) {
        void workTree.load(current.repoRoot, current.filePath, revisions.newRevision, middle);
      }
    });
  });

  /** The three panes to show, once loaded, with what they need. */
  const three = $derived.by(() => {
    if (!threeOn || source.kind === "plain") {
      return null;
    }
    // Panes still loaded for another file wait for this file's.
    const fileKey = `${source.repoRoot}\u0000${source.filePath}`;
    if (kind === "staging" && staging.staged && staging.workTree && staging.key === fileKey) {
      return {
        key: staging.key,
        left: staging.staged,
        right: staging.workTree,
        labels: { left: "HEAD", result: "Index (staged)", right: "Working Tree" },
        label: `Staging view of ${fileName}`,
        blamePane: "right" as ThreeWayPane,
        sameLines: true,
      };
    }
    if (kind === "merge" && source.kind === "commit" && source.secondParent) {
      return {
        key: `${source.commitId}\u0000${source.filePath}`,
        left: diff,
        right: source.secondParent,
        labels: {
          left: `Parent 1: ${(source.parents[0] ?? "").slice(0, 8)}`,
          result: source.commitId.slice(0, 8),
          right: `Parent 2: ${(source.parents[1] ?? "").slice(0, 8)}`,
        },
        label: `Diff of ${fileName} against both parents`,
        blamePane: "result" as ThreeWayPane,
        sameLines: false,
      };
    }
    if (kind === "workTree" && workTree.side && workTree.key === `${fileKey}\u0000${revisions?.newRevision}`) {
      return {
        key: workTree.key,
        left: diff,
        right: workTree.side,
        labels: { left: labels.left, result: labels.right, right: "Working Tree" },
        label: `${fileName}: ${labels.right} next to the working tree`,
        blamePane: "result" as ThreeWayPane,
        sameLines: true,
      };
    }
    return null;
  });

  function stagingApply(middle: string, side: "left" | "right"): void {
    if (repoRoot && source.kind !== "plain" && staging.staged) {
      writeIndex(repoRoot, source.filePath, middle, staging.staged, side === "right");
    }
  }

  /** Revert and Apply between the source's revisions; Apply only when the newer side is not the work tree. */
  const revertChange = $derived(
    revisions && !workTreeGone ? (selection: LineSelection) => void changeWorkTree(revisions, selection, true) : null,
  );
  const applyChange = $derived(
    revisions?.newRevision ? (selection: LineSelection) => void changeWorkTree(revisions, selection, false) : null,
  );
</script>

{#if three}
  {#key three.key}
    <ThreePaneDiff
      left={three.left}
      right={three.right}
      {path}
      labels={three.labels}
      label={three.label}
      options={kind === "merge" ? {} : { rightNewer: true, conflicts: false }}
      applyTitles={kind === "staging" ? { left: "Unstage this change", right: "Stage this change" } : null}
      onapply={kind === "staging" ? stagingApply : null}
      lineActions={kind === "workTree" && revertChange && applyChange
        ? { side: "left", onrevert: revertChange, onapply: applyChange }
        : null}
      onlayout={(layout) => setDiffLayout(key, layout)}
      workingFile={openTarget ? { filePath: openTarget.filePath, sameLines: three.sameLines } : null}
      blame={blame ? { target: blame, pane: three.blamePane } : null}
    />
  {/key}
{:else}
  <DiffView
    {diff}
    {path}
    {mode}
    leftLabel={labels.left}
    rightLabel={labels.right}
    {onChange}
    {onLines}
    blame={workTreeGone ? null : blame}
    {revealLine}
    workingFile={openTarget}
    {previewSides}
    threePanes={kind ? { title: THREE_PANE_TITLES[kind], open: () => showThreeColumns(key) } : null}
    onRevert={mode === "readonly" ? revertChange : null}
    onApply={mode === "readonly" ? applyChange : null}
  />
{/if}
