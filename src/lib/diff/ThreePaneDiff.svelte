<!-- A file in three read-only panes, like JetBrains IDEs: a merge commit's parent 1, merge result and parent 2, or the
     staging view's HEAD, index and work tree, with bands joining each side's changes to the middle. With `onapply`
     the bands carry arrows that take a change into the middle (stage or unstage); with `workingFile`, Open File
     opens the real file. threeWayEditors.svelte.ts builds the editors. -->
<script lang="ts">
  import Button from "@git-manager/ui/components/Button.svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import MergeFrame from "@git-manager/ui/components/MergeFrame.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import ToggleButton from "@git-manager/ui/components/ToggleButton.svelte";
  import Toolbar from "@git-manager/ui/components/Toolbar.svelte";
  import { localKeys } from "$lib/commands/commandRuntime";
  import type { DiffLayout } from "$lib/stores/settings.svelte";
  import type { FileDiff } from "$lib/types";
  import { openWorkingFile } from "./openWorkingFile";
  import { diffPrefs } from "./prefs.svelte";
  import type { ParentSide, ThreeWayOptions } from "./threeWay";
  import { ThreeWayEditors } from "./threeWayEditors.svelte";

  interface Props {
    /** The left pane (original) against the middle (modified). */
    left: FileDiff;
    /** The right pane (original) against the middle (modified). */
    right: FileDiff;
    path: string;
    labels: { left: string; result: string; right: string };
    /** What the three panes show, for screen readers. */
    label: string;
    options?: ThreeWayOptions;
    /** The middle text with one side's change taken into it (the band's arrow). */
    onapply?: ((middle: string, side: ParentSide) => void) | null;
    applyTitles?: { left: string; right: string } | null;
    /** Side by side or Inline in the layout buttons: back to the two-pane diff. */
    onlayout: (layout: DiffLayout) => void;
    /** The file in the work tree (absolute path), for Open File; `sameLines` when the right pane is the work tree. */
    workingFile?: { filePath: string; sameLines: boolean } | null;
  }

  let {
    left,
    right,
    path,
    labels,
    label,
    options = {},
    onapply = null,
    applyTitles = null,
    onlayout,
    workingFile = null,
  }: Props = $props();

  const editors = new ThreeWayEditors();
  /** The middle pane's place when new texts rebuild the panes (after staging a change). */
  let keptScroll: number | null = null;
  const fileName = $derived(path.split("/").pop() ?? path);
  const directory = $derived(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
  const counter = $derived(
    editors.changeCount === 0
      ? "No changes"
      : editors.current < 0
        ? editors.summary
        : `${editors.current + 1} of ${editors.changeCount}`,
  );

  /** Opens the real file in an editor tab, at the right pane's line when that pane is the work tree. */
  function openFile(): void {
    if (workingFile) {
      void openWorkingFile(workingFile.filePath, workingFile.sameLines ? editors.lineOnScreen("right") : null);
    }
  }

  function apply(index: number, side: ParentSide): void {
    const middle = editors.taken(side, index);
    if (middle !== null) {
      onapply?.(middle, side);
    }
  }
</script>

<Stack grow gap="none">
  <Toolbar variant="editor" label="Diff" responsive>
    <IconButton
      icon="arrow-up"
      iconSize="normal"
      size="compact"
      label="Previous change"
      title="Previous change ({localKeys('Shift+F7')})"
      disabled={editors.changeCount === 0}
      onclick={() => editors.goToChange(-1)}
    />
    <IconButton
      icon="arrow-down"
      iconSize="normal"
      size="compact"
      label="Next change"
      title="Next change ({localKeys('F7')})"
      disabled={editors.changeCount === 0}
      onclick={() => editors.goToChange(1)}
    />
    <Text tone="dim" size="small" tabular truncate>{counter}</Text>
    <Stack direction="row" gap="none" role="group" label="Diff layout">
      <ToggleButton
        icon="split-three"
        label="Three panes"
        title="Three panes: {labels.left}, {labels.result} and {labels.right}"
        bind:pressed={() => true, () => undefined}
      />
      <ToggleButton
        icon="split-view"
        label="Side by side"
        title="Side by side: two panes"
        bind:pressed={() => false, (on) => on && onlayout("sideBySide")}
      />
      <ToggleButton
        icon="split-rows"
        label="Inline"
        title="Inline: removed lines above the lines that replace them"
        bind:pressed={() => false, (on) => on && onlayout("inline")}
      />
    </Stack>
    <ToggleButton
      icon="list-tree"
      text="Collapse unchanged"
      label="Collapse unchanged"
      title="Collapse the lines that match on every side"
      bind:pressed={() => diffPrefs.collapseUnchanged, () => diffPrefs.toggleCollapse()}
    />
    {#if workingFile}
      <Button
        variant="ghost"
        size="small"
        icon="external-link"
        title="Open the file itself in an editor tab"
        onclick={openFile}
      >
        Open File
      </Button>
    {/if}
    {#snippet end()}
      <Stack direction="row" gap="sm" shrink="first" align="baseline">
        <Text tone="dim" size="small" truncate hideAt="compact">{editors.summary}</Text>
        <Text truncate giveWay size="small" weight="semibold" title={path}>{fileName}</Text>
        {#if directory}
          <Text truncate giveWay tone="dim" size="small" hideAt="compact">{directory}</Text>
        {/if}
      </Stack>
    {/snippet}
  </Toolbar>
  {#key diffPrefs.collapseUnchanged}
    {#key left}
      {#key right}
        <MergeFrame
          {label}
          {labels}
          leftRibbons={editors.leftRibbons}
          rightRibbons={editors.rightRibbons}
          onapply={onapply ? apply : undefined}
          {applyTitles}
          onready={(parts) => {
            const collapse = diffPrefs.collapseUnchanged;
            void editors.build({ parts, left, right, path, collapse, options, scrollTop: keptScroll });
            return () => {
              keptScroll = editors.scrollTop();
              editors.destroy();
            };
          }}
        />
      {/key}
    {/key}
  {/key}
</Stack>
