<!--
  Editor tab for a work tree file opened from the file explorer. With the editor split, the
  same file can have one of these in each group: they share one document (sharedDocs.ts).
  The editor itself is fileEditor.svelte.ts; this frame lays out the bar, the conflict strip and the panes.
-->
<script lang="ts">
  import Button from "@git-manager/ui/components/Button.svelte";
  import ElementHost from "@git-manager/ui/components/ElementHost.svelte";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Icon from "@git-manager/ui/components/Icon.svelte";
  import SplitPane from "@git-manager/ui/components/SplitPane.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Toolbar from "@git-manager/ui/components/Toolbar.svelte";
  import { onMount, untrack } from "svelte";
  import { setBlameDisplay } from "$lib/editor/blame";
  import { resolveAllConflicts } from "$lib/editor/conflictDecorations";
  import { isMarkdownPath } from "$lib/markdown/viewMode";
  import { fileCommands } from "$lib/stores/fileCommands.svelte";
  import { selectionInfo } from "$lib/editor/selectionInfo";
  import { changesSelection } from "../changes/selection.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { MARKDOWN_PREVIEW_RATIO_RANGE, settings } from "$lib/stores/settings.svelte";
  import { folderFor, locateAbsolute } from "$lib/stores/workspacePaths";
  import FileBar from "./FileBar.svelte";
  import { FileEditor } from "./fileEditor.svelte";
  import { fileMenus } from "./fileMenus";
  import { formatSize, sectionLabel } from "./filePosition";
  import { fileToolbarParts } from "./fileToolbar";
  import { MarkdownPane } from "./markdownPane.svelte";
  import MarkdownToolbar from "./MarkdownToolbar.svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";
  import { previewOf } from "./mediaPreview";
  import RichMarkdownView from "./RichMarkdownView.svelte";
  import { tonesByPath } from "./tones";
  import { watchFile } from "./watchFile.svelte";

  let { filePath, groupId }: { filePath: string; groupId: number } = $props();

  /** This tab is the one its editor group shows. */
  const shown = $derived(changesSelection.tabShown(groupId, filePath));
  /** ...in the focused group, so it feeds the status bar. */
  const isActive = $derived(shown && repoStore.focusedGroupId === groupId);
  const dirty = $derived(repoStore.isDirty(filePath));
  /** The workspace folder holding this file; reads and writes go through it. */
  const folder = $derived(folderFor(repoStore.workspace?.folders ?? [], filePath));
  const location = $derived(locateAbsolute(repoStore.repos, filePath));
  const repoStatus = $derived(location ? (repoStore.statuses[location.repo.root] ?? null) : null);
  const tone = $derived(location ? (tonesByPath(repoStatus?.files ?? []).get(location.repoPath) ?? null) : null);
  /** Images and PDFs open in the preview instead of the editor. */
  const preview = $derived(previewOf(filePath));
  /** Bumped when the previewed file may have changed on disk. */
  let previewToken = $state(0);

  const markdown = new MarkdownPane(untrack(() => filePath));
  const editor = new FileEditor(
    untrack(() => ({
      filePath,
      groupId,
      isMarkdown: isMarkdownPath(filePath),
      folder: () => folder,
      location: () => location,
      repoStatus: () => repoStatus,
      isActive: () => isActive,
      conflicted: () => tone === "conflict",
      flushRich: () => markdown.rich?.flush(),
      openMergeTool: () => void menus.openMergeTool(),
      onOpenedAt: (line: number) => (markdown.initialLine = line),
    })),
  );
  markdown.attach(editor);
  const saver = editor.saver;
  const menus = fileMenus(editor, { dirty: () => dirty, tone: () => tone, reload: (quiet) => reload(quiet) });

  const editable = $derived(editor.editable);
  const ready = $derived(editable && editor.loadError === null);
  const showPreview = $derived(editor.ctx.isMarkdown && ready && markdown.mode !== "editor");
  let areaWidth = $state(0);
  const previewWidth = $derived(Math.round(settings.markdownPreviewRatio * areaWidth));

  function reload(quiet: boolean): Promise<void> {
    if (preview) {
      // The preview reads the file itself; nothing here holds its bytes.
      previewToken++;
      return Promise.resolve();
    }
    return editor.load(quiet);
  }

  onMount(() => {
    void reload(false);
    // File > Save / Revert and View > Markdown act on the active tab through this.
    const unregister = fileCommands.register(filePath, {
      save: (options) => saver.save(options),
      revert: menus.revert,
      setViewMode: (mode) => void markdown.setMode(mode),
      text: () => editor.view?.state.doc.toString() ?? null,
      selection: () => (editor.view ? selectionInfo(editor.view.state) : null),
      focus: () => editor.view?.focus(),
      preferred: () => repoStore.focusedGroupId === groupId,
      replaceText: (text) => saver.replaceText(text),
    });
    return () => {
      unregister();
      editor.destroy();
    };
  });

  watchFile(editor, {
    isActive: () => isActive,
    shown: () => shown,
    dirty: () => dirty,
    location: () => location,
    repoStatus: () => repoStatus,
    reload: (quiet) => void reload(quiet),
    reveal: (line) => markdown.mode === "preview" && markdown.preview?.scrollToLine(line),
  });

  // What the File and View menus may offer for this tab; the editor in the focused group reports last.
  $effect(() => {
    void isActive;
    const state = { editable: ready, markdownMode: editor.ctx.isMarkdown && ready ? markdown.mode : null };
    untrack(() => fileCommands.report(filePath, state));
  });

  // Apply the blame preferences to the open editor as they change.
  $effect(() => {
    const display = { inline: settings.currentLineBlame, gutter: settings.blameGutter };
    if (editor.editorView) {
      setBlameDisplay(editor.editorView, display);
    }
  });

  /** Settings > Appearance > File toolbar: where the bar goes and which of its parts show for this file. */
  const parts = $derived(
    fileToolbarParts(
      settings.fileToolbar,
      {
        breadcrumbs: settings.fileToolbarBreadcrumbs,
        badges: settings.fileToolbarBadges,
        changes: settings.fileToolbarChanges,
        blame: settings.fileToolbarBlame,
        copyPath: settings.fileToolbarCopyPath,
        markdownView: settings.fileToolbarMarkdownView,
        markdownFormat: settings.fileToolbarMarkdownFormat,
      },
      { gitTools: location !== null && editable, markdown: editor.ctx.isMarkdown && ready },
    ),
  );
  const barBottom = $derived(settings.fileToolbar === "bottom");

  function acceptAll(choice: "current" | "incoming"): void {
    if (editor.view) {
      resolveAllConflicts(editor.view, choice);
      editor.view.focus();
    }
  }

  function resizePreview(size: number, persist: boolean): void {
    if (areaWidth > 0) {
      settings.setMarkdownPreviewRatio(size / areaWidth, persist);
    }
  }
</script>

{#snippet bar()}
  <FileBar
    {filePath}
    {parts}
    claimed={isActive}
    {dirty}
    {tone}
    conflictCount={editor.conflictCount}
    sectionCount={editor.navMarks.length}
    sectionLabel={sectionLabel(editor.navMarks.length, editor.navIndex, editor.conflictCount > 0)}
    viewMode={markdown.mode}
    onsection={(direction) => editor.goToSection(direction)}
    onviewmode={(mode) => void markdown.setMode(mode)}
    oncopypath={() => void menus.copyPath()}
  />
{/snippet}

{#snippet splitPreview()}
  <!-- Only the tab on screen keeps its rendered document: a hidden tab frees it and draws it again when shown. -->
  {#if shown}
    <MarkdownPreview
      bind:this={markdown.preview}
      {filePath}
      docVersion={editor.docVersion}
      getSource={() => editor.view?.state.doc.toString() ?? ""}
      view={editor.editorView}
      visible={shown}
      syncScroll
      initialLine={markdown.initialLine}
      onLeave={(topLine) => (markdown.initialLine = topLine)}
      onToggleTask={(lineIndex) => markdown.toggleTask(lineIndex)}
      onSave={() => void saver.save()}
    />
  {/if}
{/snippet}

<Stack gap="none" grow surface="editor">
  {#if parts.shown && !barBottom}{@render bar()}{/if}
  <!-- Conflict actions are a tool for this file, so they get their own strip while it has conflicts. -->
  {#if editor.conflictCount > 0 || tone === "conflict"}
    <Toolbar variant="conflict" label="Conflict actions">
      <Icon name="alert" size="medium" tone="danger" />
      {#if editor.conflictCount > 0}
        <Button size="tiny" onclick={() => acceptAll("current")} disabled={saver.saving}>Accept All Current</Button>
        <Button size="tiny" onclick={() => acceptAll("incoming")} disabled={saver.saving}>Accept All Incoming</Button>
      {/if}
      {#if tone === "conflict"}
        <Button size="tiny" icon="merge" onclick={() => void menus.openMergeTool()} disabled={saver.saving}>
          Resolve in Merge Tool
        </Button>
        {#if editor.conflictCount === 0 && editable}
          <Button
            size="tiny"
            variant="primary"
            icon="check"
            onclick={() => void saver.markResolved()}
            disabled={saver.saving}
            title="Save the file and stage it"
          >
            Mark as Resolved
          </Button>
        {/if}
      {/if}
    </Toolbar>
  {/if}
  {#if parts.markdownFormat}
    <MarkdownToolbar
      viewMode={markdown.mode}
      onFormat={(command) => markdown.applyFormat(command)}
      onRichFormat={(action) => markdown.rich?.format(action)}
      onRichLink={() => void markdown.rich?.link()}
    />
  {/if}
  <SplitPane
    sized="second"
    label="Resize Markdown preview"
    bind:size={() => previewWidth, (size) => resizePreview(size, false)}
    bind:extent={areaWidth}
    max={Math.round(areaWidth * MARKDOWN_PREVIEW_RATIO_RANGE[1])}
    oncommit={(size) => resizePreview(size, true)}
    second={showPreview && markdown.mode === "split" ? splitPreview : undefined}
  >
    {#snippet first()}
      {#if preview}
        <!-- Only while the tab is on screen, so a hidden or closed tab frees the picture or document. -->
        {#if shown && folder}
          {#await import("./MediaPreview.svelte") then media}
            <media.default {filePath} {preview} reloadToken={previewToken} />
          {/await}
        {/if}
      {:else if editor.loadError}
        <EmptyState title={editor.loadError}>
          {#snippet action()}
            <Button onclick={() => void repoStore.closeTab(filePath, groupId)}>Close</Button>
          {/snippet}
        </EmptyState>
      {:else if editor.file?.tooLarge}
        <EmptyState title="This file is too large to open here ({formatSize(editor.file.size)})." titleTone="dim" />
      {:else if editor.file?.binary}
        <EmptyState title="Binary file ({formatSize(editor.file.size)}), not shown." titleTone="dim" />
      {:else if !editor.file}
        <EmptyState title="Loading..." titleTone="dim" delayed />
      {/if}
      <ElementHost
        fill="grow"
        clip
        stretch
        hidden={!ready || (showPreview && markdown.mode === "preview")}
        onready={(element) => void (editor.host = element)}
      />
      <!-- Rich Editor: the rendered document, editable in place, while the tab is on screen. -->
      {#if showPreview && markdown.mode === "preview" && shown}
        <RichMarkdownView
          bind:this={markdown.rich}
          {filePath}
          docVersion={editor.docVersion}
          getSource={() => editor.view?.state.doc.toString() ?? ""}
          initialScroll={markdown.richScroll}
          onLeave={(scrollTop) => (markdown.richScroll = scrollTop)}
          onEdit={(edit) => markdown.applyRichEdit(edit)}
          onSave={() => void saver.save()}
        />
      {/if}
    {/snippet}
  </SplitPane>
  {#if parts.shown && barBottom}{@render bar()}{/if}
</Stack>
