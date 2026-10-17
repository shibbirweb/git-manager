<!-- A file editor's slim bar (Settings > Appearance > File toolbar): the path and state pills at the start,
     the change arrows, Blame, Copy Path and the Markdown view switch at the end. As the editor gets narrow the
     counter goes first, then the pills become dots, then the dividers. Save and Revert live in the File menu. -->
<script lang="ts">
  import Divider from "@nibtree/ui/components/Divider.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import Pill from "@nibtree/ui/components/Pill.svelte";
  import Segmented from "@nibtree/ui/components/Segmented.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import ToggleButton from "@nibtree/ui/components/ToggleButton.svelte";
  import Toolbar from "@nibtree/ui/components/Toolbar.svelte";
  import type { IconName } from "@nibtree/ui/icons";
  import { localKeys } from "$lib/commands/commandRuntime";
  import NavigationBar from "$lib/navBar/NavigationBar.svelte";
  import { type MarkdownViewMode, settings } from "$lib/stores/settings.svelte";
  import type { FileToolbarParts } from "./fileToolbar";
  import type { FileTone } from "./tones";

  interface Props {
    filePath: string;
    parts: FileToolbarParts;
    /** This bar answers Jump to Navigation Bar. */
    claimed: boolean;
    dirty: boolean;
    tone: FileTone | null;
    conflictCount: number;
    /** Changes and conflicts the arrows move between. */
    sectionCount: number;
    sectionLabel: string;
    viewMode: MarkdownViewMode;
    onsection: (direction: 1 | -1) => void;
    onviewmode: (mode: MarkdownViewMode) => void;
    oncopypath: () => void;
  }

  let {
    filePath,
    parts,
    claimed,
    dirty,
    tone,
    conflictCount,
    sectionCount,
    sectionLabel,
    viewMode,
    onsection,
    onviewmode,
    oncopypath,
  }: Props = $props();

  const TONE_LABELS: Partial<Record<FileTone, { label: string; tone: "danger" | "success" | "accent" }>> = {
    conflict: { label: "Conflicted", tone: "danger" },
    added: { label: "New file", tone: "success" },
    modified: { label: "Modified", tone: "accent" },
  };

  const MARKDOWN_MODES: { value: MarkdownViewMode; icon: IconName; title: string }[] = [
    { value: "editor", icon: "editor-only", title: "Editor Only" },
    { value: "split", icon: "split-view", title: "Editor and Preview" },
    { value: "preview", icon: "rich-editor", title: "Rich Editor" },
  ];

  const toneMark = $derived(tone ? (TONE_LABELS[tone] ?? null) : null);
  const conflictText = $derived(`${conflictCount} ${conflictCount === 1 ? "conflict" : "conflicts"}`);
</script>

<Toolbar
  variant="file"
  label="File actions"
  placement={settings.fileToolbar === "bottom" ? "bottom" : "top"}
  responsive
>
  {#if parts.breadcrumbs}
    <NavigationBar targetPath={filePath} {claimed} />
  {/if}
  {#if parts.badges}
    {#if dirty}
      <Pill tone="warning" title="Unsaved changes" dotAt="compact">Unsaved</Pill>
    {/if}
    {#if toneMark}
      <Pill tone={toneMark.tone} title={toneMark.label} dotAt="compact">{toneMark.label}</Pill>
    {/if}
    {#if conflictCount > 0}
      <Pill tone="danger" title={conflictText} dotAt="compact">{conflictText}</Pill>
    {/if}
  {/if}
  {#snippet end()}
    {#if parts.changes}
      <IconButton
        icon="arrow-up"
        size="tool"
        iconSize="medium"
        label="Previous change or conflict"
        title="Previous change or conflict ({localKeys('Shift+F7')})"
        disabled={sectionCount === 0}
        onclick={() => onsection(-1)}
      />
      <IconButton
        icon="arrow-down"
        size="tool"
        iconSize="medium"
        label="Next change or conflict"
        title="Next change or conflict ({localKeys('F7')})"
        disabled={sectionCount === 0}
        onclick={() => onsection(1)}
      />
      <Text size="small" tone="dim" tabular hideAt="medium">{sectionLabel}</Text>
      {#if parts.blame || parts.copyPath || parts.markdownView}
        <Divider direction="vertical" hideAt="narrow" />
      {/if}
    {/if}
    {#if parts.blame}
      <ToggleButton
        variant="tool"
        icon="history"
        label="Blame"
        title="Blame: show who changed each line and when"
        pressed={settings.blameGutter}
        onchange={(pressed) => settings.setPreference("blameGutter", pressed)}
      />
    {/if}
    {#if parts.copyPath}
      <IconButton icon="copy" size="tool" iconSize="compact" label="Copy relative path" onclick={oncopypath} />
    {/if}
    {#if parts.markdownView}
      {#if parts.blame || parts.copyPath}
        <Divider direction="vertical" hideAt="narrow" />
      {/if}
      <Segmented
        size="small"
        label="Markdown view"
        options={MARKDOWN_MODES}
        bind:value={() => viewMode, (mode) => onviewmode(mode)}
      />
    {/if}
  {/snippet}
</Toolbar>
