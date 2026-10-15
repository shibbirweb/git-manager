<!-- The bar over a diff: change arrows and count, the layout, Collapse unchanged, Blame, Open File, the line actions
     of the Changes diff, and the file's name at the end. -->
<script lang="ts">
  import Button from "@git-manager/ui/components/Button.svelte";
  import Divider from "@git-manager/ui/components/Divider.svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import ToggleButton from "@git-manager/ui/components/ToggleButton.svelte";
  import Toolbar from "@git-manager/ui/components/Toolbar.svelte";
  import { localKeys } from "$lib/commands/commandRuntime";
  import { settings } from "$lib/stores/settings.svelte";
  import type { LineAction } from "$lib/types";
  import type { DiffEditors } from "./diffEditors.svelte";
  import { lineTitle } from "./diffLineMenu";
  import { diffPrefs } from "./prefs.svelte";

  interface Props {
    editors: DiffEditors;
    /** A text diff with changes: the arrows, layout and collapse work. */
    textDiff: boolean;
    inline: boolean;
    showBlame: boolean;
    showOpenFile: boolean;
    lineMode: "unstaged" | "staged" | null;
    path: string;
    onopenfile: () => void;
    onlines: (action: LineAction) => void;
  }

  let { editors, textDiff, inline, showBlame, showOpenFile, lineMode, path, onopenfile, onlines }: Props = $props();

  const fileName = $derived(path.split("/").pop() ?? path);
  const directory = $derived(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
  const noChunks = $derived(!textDiff || editors.chunkCount === 0);
  const counterLabel = $derived.by(() => {
    const count = editors.chunkCount;
    if (count === 0) {
      return "No changes";
    }
    if (editors.current < 0) {
      return count === 1 ? "1 change" : `${count} changes`;
    }
    return `${editors.current + 1} of ${count}`;
  });
</script>

<Toolbar variant="editor" label="Diff" responsive>
  <IconButton
    icon="arrow-up"
    iconSize="normal"
    size="compact"
    label="Previous change"
    title="Previous change ({localKeys('Shift+F7')})"
    disabled={noChunks}
    onclick={() => editors.goToChunk(-1)}
  />
  <IconButton
    icon="arrow-down"
    iconSize="normal"
    size="compact"
    label="Next change"
    title="Next change ({localKeys('F7')})"
    disabled={noChunks}
    onclick={() => editors.goToChunk(1)}
  />
  {#if textDiff}
    <Text tone="dim" size="small" tabular>{counterLabel}</Text>
  {/if}
  <Divider direction="vertical" />
  <Stack direction="row" gap="none" role="group" label="Diff layout">
    <ToggleButton
      icon="split-view"
      label="Side by side"
      title="Side by side: old text on the left, new on the right"
      disabled={!textDiff}
      bind:pressed={() => !inline, (on) => on && settings.setPreference("diffLayout", "sideBySide")}
    />
    <ToggleButton
      icon="split-rows"
      label="Inline"
      title="Inline: removed lines above the lines that replace them"
      disabled={!textDiff}
      bind:pressed={() => inline, (on) => on && settings.setPreference("diffLayout", "inline")}
    />
  </Stack>
  <ToggleButton
    icon="list-tree"
    text="Collapse unchanged"
    label="Collapse unchanged"
    title="Collapse unchanged fragments"
    disabled={!textDiff}
    bind:pressed={() => diffPrefs.collapseUnchanged, () => diffPrefs.toggleCollapse()}
  />
  {#if showBlame && textDiff}
    <ToggleButton
      icon="history"
      text="Blame"
      label="Blame"
      title="Show who changed each line and when (git blame)"
      bind:pressed={() => settings.blameGutter, (on) => settings.setPreference("blameGutter", on)}
    />
  {/if}
  {#if showOpenFile}
    <Button
      variant="ghost"
      size="small"
      icon="external-link"
      title="Open the file itself in an editor tab"
      onclick={onopenfile}
    >
      Open File
    </Button>
  {/if}
  {#if lineMode}
    <Divider direction="vertical" />
    {#if lineMode === "unstaged"}
      <Button
        variant="ghost"
        size="small"
        icon="plus"
        disabled={editors.selectedLines === 0}
        title={lineTitle("Stage the selected lines, or the change at the cursor", "stage")}
        onclick={() => onlines("stage")}
      >
        Stage Lines
      </Button>
      <Button
        variant="ghost"
        size="small"
        icon="discard"
        disabled={editors.selectedLines === 0}
        title={lineTitle("Discard the selected lines in the work tree", "discard")}
        onclick={() => onlines("discard")}
      >
        Discard Lines
      </Button>
    {:else}
      <Button
        variant="ghost"
        size="small"
        icon="minus"
        disabled={editors.selectedLines === 0}
        title={lineTitle("Unstage the selected lines, or the change at the cursor", "unstage")}
        onclick={() => onlines("unstage")}
      >
        Unstage Lines
      </Button>
    {/if}
  {/if}
  {#snippet end()}
    <Stack direction="row" gap="sm" shrink="first" align="baseline">
      <Text truncate giveWay size="small" weight="semibold" title={path}>{fileName}</Text>
      {#if directory}
        <Text truncate giveWay tone="dim" size="small" hideAt="compact">{directory}</Text>
      {/if}
    </Stack>
  {/snippet}
</Toolbar>
