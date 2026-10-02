<!-- Editor tab for a work tree file opened from the file explorer. -->
<script lang="ts">
  import { EditorState, type Text, type TransactionSpec } from "@codemirror/state";
  import { EditorView, keymap } from "@codemirror/view";
  import { onMount, tick, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { wordWrap } from "$lib/editor/wordWrap";
  import { blameExtension, loadBlame, setBlameDisplay } from "$lib/editor/blame";
  import { conflictField, conflictMarkers, resolveAllConflicts } from "$lib/editor/conflictDecorations";
  import { type ChangeMark, changeMarks } from "$lib/editor/lineDiff";
  import { sectionAt, sectionTarget } from "$lib/editor/navigation";
  import {
    changeGutter,
    changeMarkField,
    type MarkSource,
    scrollMarkers,
    setChangeMarks,
  } from "$lib/editor/scrollMarkers";
  import { baseExtensions, languageFor, languageName } from "$lib/editor/setup";
  import { editorTopLine, scrollEditorToLine } from "$lib/markdown/editorScroll";
  import { toggleInline, toggleLink, toggleTaskAt } from "$lib/markdown/format";
  import type { SourceEdit } from "$lib/markdown/richSync";
  import { isMarkdownPath, rememberViewMode, sessionViewMode } from "$lib/markdown/viewMode";
  import { editorStatus } from "$lib/stores/editorStatus.svelte";
  import { fileCommands } from "$lib/stores/fileCommands.svelte";
  import { selectionInfo } from "$lib/editor/selectionInfo";
  import { changesSelection } from "../changes/selection.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { MARKDOWN_PREVIEW_RATIO_RANGE, type MarkdownViewMode, settings } from "$lib/stores/settings.svelte";
  import { folderFor, joinPath, locateAbsolute, relativeTo } from "$lib/stores/workspacePaths";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { isMissingFileError } from "$lib/stores/navHistory";
  import type { FileContent } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import ResizeHandle from "$lib/ui/ResizeHandle.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";
  import MarkdownToolbar from "./MarkdownToolbar.svelte";
  import RichMarkdownView from "./RichMarkdownView.svelte";
  import { tonesByPath } from "./tones";
  import { previewOf } from "./mediaPreview";

  let { filePath }: { filePath: string } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let file = $state.raw<FileContent | null>(null);
  let loadError = $state<string | null>(null);
  let saving = $state(false);
  /** Conflict marker regions currently in the editor. */
  let conflictCount = $state(0);

  let view: EditorView | null = null;
  /** The same editor, for the Markdown preview's scroll sync. */
  let editorView = $state.raw<EditorView | null>(null);
  /** The file as of the last commit, split into lines; null when unavailable. */
  let headLines: string[] | null = null;
  let marksTimer: ReturnType<typeof setTimeout> | undefined;
  /** Text as last loaded or saved, for the dirty check. */
  let baseline: Text | null = null;
  let requestId = 0;

  const name = $derived(filePath.split("/").pop() ?? filePath);
  /** This tab is the one on screen, so it feeds the status bar. */
  const isActive = $derived(repoStore.openFilePath === filePath && changesSelection.shownView === "file");

  function reportStatus(state: EditorState | undefined = view?.state): void {
    if (!state || !file || !isActive) {
      return;
    }
    const selection = state.selection.main;
    const line = state.doc.lineAt(selection.head);
    editorStatus.report({
      filePath,
      line: line.number,
      column: selection.head - line.from + 1,
      selected: selection.to - selection.from,
      selectedLines: selection.empty ? 0 : state.doc.lineAt(selection.to).number - state.doc.lineAt(selection.from).number + 1,
      eol: file.eol,
      tabSize: state.tabSize,
      language: languageName(filePath),
    });
  }

  // Taking over the status bar when this tab becomes visible.
  $effect(() => {
    if (isActive) {
      untrack(() => reportStatus());
    }
  });

  /** This tab has unsaved edits. */
  const dirty = $derived(repoStore.isDirty(filePath));
  /** The repository owning this file, if any; git features need it. */
  /** The workspace folder holding this file; reads and writes go through it. */
  const folder = $derived(folderFor(repoStore.workspace?.folders ?? [], filePath));
  /** Path inside the workspace folder, for display and copying. */
  const folderPath = $derived(folder ? relativeTo(folder.root, filePath) : filePath);
  const location = $derived(
    locateAbsolute(repoStore.repos, filePath),
  );
  const repoStatus = $derived(location ? (repoStore.statuses[location.repo.root] ?? null) : null);
  const tone = $derived(
    location ? (tonesByPath(repoStatus?.files ?? []).get(location.repoPath) ?? null) : null,
  );
  const toneLabel = $derived(
    tone === "conflict" ? "Conflicted" : tone === "added" ? "New file" : tone === "modified" ? "Modified" : null,
  );
  const editable = $derived(file !== null && !file.binary && !file.tooLarge);
  /** Images and PDFs open in the preview instead of the editor. */
  const preview = $derived(previewOf(filePath));
  /** Bumped when the previewed file may have changed on disk. */
  let previewToken = $state(0);

  // Markdown: source, preview or both, like JetBrains. Each file keeps its mode for the session.
  const isMarkdown = $derived(isMarkdownPath(filePath));
  let viewMode = $state<MarkdownViewMode>(initialViewMode());
  /** Bumped on every edit so the preview knows to render again. */
  let docVersion = $state(0);
  /** Source line the preview starts at when it opens. */
  let initialLine = $state(0);
  /** Where the rich editor was scrolled when its tab was last on screen. */
  let richScroll = $state(0);
  let previewRef = $state<ReturnType<typeof MarkdownPreview> | null>(null);
  let richRef = $state<ReturnType<typeof RichMarkdownView> | null>(null);
  let areaWidth = $state(0);
  const showPreview = $derived(isMarkdown && editable && loadError === null && viewMode !== "editor");
  const previewWidth = $derived(Math.round(settings.markdownPreviewRatio * areaWidth));

  function initialViewMode(): MarkdownViewMode {
    return sessionViewMode(filePath, settings.markdownViewMode);
  }

  async function setViewMode(next: MarkdownViewMode): Promise<void> {
    if (next === viewMode) {
      return;
    }
    // Stay at the same place in the document across the switch.
    const fromPreview = viewMode === "preview";
    if (fromPreview) {
      // A rich edit still waiting for a pause in typing goes into the text first.
      richRef?.flush();
    }
    const line = fromPreview ? 0 : view ? editorTopLine(view) : 0;
    initialLine = line;
    viewMode = next;
    rememberViewMode(filePath, next);
    if (fromPreview && view) {
      await tick();
      const shown = view;
      requestAnimationFrame(() => {
        shown.requestMeasure();
        scrollEditorToLine(shown, line);
      });
    }
  }

  /** Runs a Markdown toolbar command on the editor as one undoable change. */
  function applyFormat(command: (state: EditorState) => TransactionSpec): void {
    if (!view || viewMode === "preview") {
      return;
    }
    view.dispatch(command(view.state));
    view.focus();
  }

  /** An edit in the rich text editor (Preview mode), applied to the text so it saves and undoes as usual. */
  function applyRichEdit(edit: SourceEdit): void {
    if (!view) {
      return;
    }
    const length = view.state.doc.length;
    if (edit.from < 0 || edit.to > length || edit.from > edit.to) {
      return;
    }
    view.dispatch({ changes: edit, userEvent: "input.rich" });
  }

  /** A task box clicked in the preview ticks its line in the source. */
  function toggleTask(lineIndex: number): void {
    const spec = view ? toggleTaskAt(view.state, lineIndex) : null;
    if (view && spec) {
      view.dispatch(spec);
    }
  }

  function resizePreview(size: number, persist: boolean): void {
    if (areaWidth > 0) {
      settings.setMarkdownPreviewRatio(size / areaWidth, persist);
    }
  }

  onMount(() => {
    void load(false);
    // File > Save / Revert and View > Markdown act on the active tab through this.
    const unregister = fileCommands.register(filePath, {
      save: (options) => save(options),
      revert,
      setViewMode: (mode) => void setViewMode(mode),
      text: () => view?.state.doc.toString() ?? null,
      selection: () => (view ? selectionInfo(view.state) : null),
      focus: () => view?.focus(),
    });
    return () => {
      unregister();
      editorStatus.clear(filePath);
      clearTimeout(marksTimer);
      view?.destroy();
      view = null;
      editorView = null;
    };
  });

  // What the File and View menus may offer for this tab.
  $effect(() => {
    const state = {
      editable: editable && loadError === null,
      markdownMode: isMarkdown && editable && loadError === null ? viewMode : null,
    };
    untrack(() => fileCommands.report(filePath, state));
  });

  // Pick up changes made outside the app while there are no local edits.
  let lastStatus: unknown = null;
  $effect(() => {
    // Changes in the owning repository, or anywhere in a folder without git.
    const status = location ? repoStatus : repoStore.workspaceVersion;
    if (lastStatus !== null && status !== lastStatus && !dirty && !saving) {
      void load(true);
    }
    lastStatus = status;
  });

  async function load(quiet: boolean): Promise<void> {
    const root = folder?.root;
    if (!root) {
      return;
    }
    if (preview) {
      // The preview reads the file itself; nothing here holds its bytes.
      previewToken++;
      return;
    }
    const relative = relativeTo(root, filePath);
    const request = ++requestId;
    try {
      const next = await api.readWorktreeFile(root, relative);
      if (request !== requestId) {
        return;
      }
      loadError = null;
      file = next;
      void loadHead();
      if (next.binary || next.tooLarge) {
        view?.destroy();
        view = null;
        editorView = null;
        return;
      }
      if (view) {
        if (view.state.doc.toString() !== next.content) {
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next.content } });
        }
        baseline = view.state.doc;
        repoStore.setDirty(filePath, false);
        conflictCount = view.state.field(conflictField).length;
        return;
      }
      await createEditor(next.content);
    } catch (error) {
      if (request !== requestId) {
        return;
      }
      const missing = isMissingFileError(error);
      if (missing) {
        // Back / Forward must not lead to a file that is gone.
        navigation.forget(filePath);
      }
      if (missing || (quiet && file)) {
        loadError = "This file no longer exists on disk.";
      } else {
        loadError = errorMessage(error);
      }
    }
  }

  /** Fetches the committed version to compare against for change markers. */
  async function loadHead(): Promise<void> {
    const owner = location;
    if (!owner) {
      headLines = null;
      updateMarks();
      return;
    }
    refreshBlame();
    const origPath = repoStatus?.files.find((entry) => entry.path === owner.repoPath)?.origPath ?? null;
    try {
      const committed = await api.getFileDiff(owner.repo.root, owner.repoPath, origPath, "staged");
      headLines = committed.binary || committed.tooLarge ? null : committed.original.split("\n");
    } catch {
      headLines = null;
    }
    updateMarks();
  }

  /** Blames the text on screen; unsaved edits show as uncommitted. */
  function refreshBlame(): void {
    const owner = location;
    if (!view || !file || !owner) {
      return;
    }
    void loadBlame(
      view,
      { repoRoot: owner.repo.root, filePath: owner.repoPath, revision: null, origin: (line) => ({ filePath, line }) },
      file.eol,
    );
  }

  // Apply the blame preferences to the open editor as they change.
  $effect(() => {
    const display = { inline: settings.currentLineBlame, gutter: settings.blameGutter };
    if (view) {
      setBlameDisplay(view, display);
    }
  });

  function updateMarks(): void {
    if (!view) {
      return;
    }
    const marks = headLines ? changeMarks(headLines, view.state.doc.toString().split("\n")) : [];
    view.dispatch({ effects: setChangeMarks.of(marks) });
  }

  function scheduleMarks(): void {
    clearTimeout(marksTimer);
    marksTimer = setTimeout(updateMarks, 200);
  }

  // Conflict regions win over plain changes in the ruler and gutter.
  let markMemo: { changes: readonly ChangeMark[]; conflicts: unknown; result: ChangeMark[] } | null = null;
  const markSource: MarkSource = (state) => {
    const changes = state.field(changeMarkField, false) ?? [];
    const conflicts = state.field(conflictField, false) ?? [];
    if (markMemo && markMemo.changes === changes && markMemo.conflicts === conflicts) {
      return markMemo.result;
    }
    const conflictMarks: ChangeMark[] = conflicts.map((region) => ({
      from: region.start,
      to: region.end + 1,
      kind: "conflict",
    }));
    const outside = changes.filter(
      (mark) => !conflictMarks.some((conflict) => mark.from < conflict.to && Math.max(mark.to, mark.from + 1) > conflict.from),
    );
    const result = [...outside, ...conflictMarks].sort((a, b) => a.from - b.from);
    markMemo = { changes, conflicts, result };
    return result;
  };

  // Navigation between important sections (conflicts and changes since the last commit).
  let navMarks = $state.raw<ChangeMark[]>([]);
  let navIndex = $state(-1);

  function updateNav(state: EditorState): void {
    const marks = markSource(state) as ChangeMark[];
    if (marks !== navMarks) {
      navMarks = marks;
    }
    navIndex = sectionAt(marks, state.doc.lineAt(state.selection.main.head).number - 1);
  }

  /** Moves the cursor to a 0-based line (and column) and centers it. */
  function revealLine(line: number, column = 0): void {
    if (!view) {
      return;
    }
    const doc = view.state.doc;
    const target = doc.line(Math.max(1, Math.min(line + 1, doc.lines)));
    const position = target.from + Math.max(0, Math.min(column, target.length));
    view.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: "center" }) });
  }

  function cursorLine(): number {
    return view ? view.state.doc.lineAt(view.state.selection.main.head).number - 1 : 0;
  }

  // Back / Forward to a location in this file while it is already open.
  $effect(() => {
    const request = navigation.reveal;
    if (request && request.filePath === filePath && view) {
      untrack(() => {
        const taken = navigation.takeReveal(filePath);
        if (taken) {
          if (taken.line !== null) {
            revealLine(taken.line, taken.column ?? 0);
            if (viewMode === "preview") {
              previewRef?.scrollToLine(taken.line);
            }
          }
          view?.focus();
        }
      });
    }
  });

  function goToSection(direction: 1 | -1): boolean {
    if (!view) {
      return false;
    }
    const line = view.state.doc.lineAt(view.state.selection.main.head).number - 1;
    const target = sectionTarget(navMarks, line, direction);
    if (!target) {
      return false;
    }
    const doc = view.state.doc;
    const position = doc.line(Math.min(target.from + 1, doc.lines)).from;
    view.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: "center" }) });
    view.focus();
    return true;
  }

  const navLabel = $derived.by(() => {
    if (navMarks.length === 0) {
      return "No changes";
    }
    const noun = conflictCount > 0 ? "sections" : navMarks.length === 1 ? "change" : "changes";
    return navIndex >= 0 ? `${navIndex + 1} of ${navMarks.length}` : `${navMarks.length} ${noun}`;
  });

  async function createEditor(content: string): Promise<void> {
    const language = await languageFor(filePath);
    // Wait for the editor host to render after `file` was set.
    await Promise.resolve();
    if (!host || view) {
      return;
    }
    const saveKeys = keymap.of([
      {
        key: "Mod-s",
        preventDefault: true,
        run: () => {
          void save();
          return true;
        },
      },
    ]);
    const navListener = EditorView.updateListener.of((update) => {
      if (update.docChanged || update.selectionSet || update.transactions.some((tr) => tr.effects.length > 0)) {
        updateNav(update.state);
      }
      if (update.selectionSet || update.docChanged) {
        reportStatus(update.state);
        navigation.record({ filePath, line: update.state.doc.lineAt(update.state.selection.main.head).number - 1 });
      }
    });
    // Cmd+B makes text bold here, like the rich editor: CodeMirror prevents the key's default,
    // so the window's sidebar toggle and the View > Sidebar item skip it. Cmd+I replaces Select
    // Parent Syntax and Cmd+K (Git > Commit elsewhere) is seen here first.
    const markdownKeys = isMarkdown
      ? keymap.of([
          {
            key: "Mod-b",
            preventDefault: true,
            run: (target) => {
              target.dispatch(toggleInline(target.state, "bold"));
              return true;
            },
          },
          {
            key: "Mod-i",
            preventDefault: true,
            run: (target) => {
              target.dispatch(toggleInline(target.state, "italic"));
              return true;
            },
          },
          {
            key: "Mod-k",
            preventDefault: true,
            run: (target) => {
              target.dispatch(toggleLink(target.state));
              return true;
            },
          },
        ])
      : [];
    const navKeys = keymap.of([
      { key: "F7", run: () => goToSection(1) },
      { key: "Shift-F7", run: () => goToSection(-1) },
    ]);
    const dirtyListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && baseline) {
        repoStore.setDirty(filePath, !update.state.doc.eq(baseline));
      }
      if (update.docChanged) {
        conflictCount = update.state.field(conflictField).length;
        scheduleMarks();
        docVersion++;
      }
    });
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: content,
        extensions: [
          saveKeys,
          markdownKeys,
          navKeys,
          navListener,
          baseExtensions({ readOnly: false }),
          wordWrap(settings.wordWrap),
          language,
          conflictMarkers({ onOpenMergeTool: () => void openMergeTool() }),
          changeMarkField,
          blameExtension({ inline: settings.currentLineBlame, gutter: settings.blameGutter }),
          changeGutter(markSource),
          scrollMarkers(markSource),
          dirtyListener,
        ],
      }),
    });
    editorView = view;
    // The preview may have mounted before the editor existed; it renders the new text now.
    docVersion++;
    baseline = view.state.doc;
    conflictCount = view.state.field(conflictField).length;
    updateMarks();
    refreshBlame();
    updateNav(view.state);
    reportStatus();
    // Opened by Back / Forward or Go to File: go to that line; otherwise this is a new history entry.
    const reveal = navigation.takeReveal(filePath);
    if (reveal?.line != null) {
      revealLine(reveal.line, reveal.column ?? 0);
      initialLine = reveal.line;
    }
    if (reveal?.focus) {
      view.focus();
    }
    navigation.record({ filePath, line: cursorLine() });
    repoStore.setDirty(filePath, false);
  }

  /** Writes the editor content; `quiet` skips the toast (Save All shows one for every file). */
  async function save(options: { quiet?: boolean } = {}): Promise<boolean> {
    const root = folder?.root;
    if (!view || !file || !root || saving) {
      return false;
    }
    // Preview mode: the rich editor's last keystrokes are in the text before it is written.
    richRef?.flush();
    const snapshot = view.state.doc;
    const eol = file.eol;
    saving = true;
    let saved = false;
    try {
      await api.writeWorktreeFile(root, relativeTo(root, filePath), snapshot.toString(), eol);
      saved = true;
      if (!options.quiet) {
        toast.success(`Saved ${name}`);
      }
      refreshBlame();
      if (location) {
        void repoStore.refreshRepoStatus(location.repo.root);
      }
    } catch (error) {
      toast.error("Save failed", errorMessage(error));
    }
    saving = false;
    if (saved && view) {
      baseline = snapshot;
      repoStore.setDirty(filePath, !view.state.doc.eq(snapshot));
    }
    return saved;
  }

  async function openMergeTool(): Promise<void> {
    if (tone !== "conflict") {
      toast.info("Git does not list this file as conflicted", "Resolve the markers here, then save.");
      return;
    }
    if (dirty) {
      const ok = await dialogs.confirm({
        title: "Open Merge Tool",
        message: "The merge tool starts from git's versions of the file, so your unsaved edits here will be discarded.",
        confirmLabel: "Discard and Open",
        danger: true,
      });
      if (!ok) {
        return;
      }
      repoStore.setDirty(filePath, false);
    }
    if (location) {
      void repoStore.openMerge(location.repoPath, location.repo.root);
    }
  }

  function acceptAll(choice: "current" | "incoming"): void {
    if (view) {
      resolveAllConflicts(view, choice);
      view.focus();
    }
  }

  /** Writes the editor content and stages it, which clears the conflict in git. */
  async function markResolved(): Promise<void> {
    const owner = location;
    if (!view || !file || !owner || saving) {
      return;
    }
    const snapshot = view.state.doc;
    const eol = file.eol;
    saving = true;
    const done = await repoStore.run(
      "Mark resolved",
      (repoPath) => api.saveResolution(repoPath, owner.repoPath, snapshot.toString(), eol).then(() => true),
      { success: `Resolved ${name}`, repoPath: owner.repo.root },
    );
    saving = false;
    if (done && view) {
      baseline = snapshot;
      repoStore.setDirty(filePath, !view.state.doc.eq(snapshot));
    }
  }

  // Breadcrumbs: every folder of the path, marking repository roots.
  const crumbs = $derived.by(() => {
    const root = folder?.root ?? "";
    const repoRoots = new Set(repoStore.repos.map((repo) => repo.root));
    const parts = folderPath.split("/").filter(Boolean);
    const segments = parts.map((part, index) => {
      const path = parts.slice(0, index + 1).join("/");
      const isFile = index === parts.length - 1;
      return { name: part, path, isRepo: !isFile && repoRoots.has(joinPath(root, path)) };
    });
    return { rootIsRepo: repoRoots.has(root), segments };
  });


  async function copyPath(): Promise<void> {
    try {
      await navigator.clipboard.writeText(folderPath);
      toast.success("Copied relative path");
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  async function revert(): Promise<void> {
    if (dirty) {
      const ok = await dialogs.confirm({
        title: "Revert File",
        message: `Discard your unsaved changes to ${name}?`,
        confirmLabel: "Discard",
        danger: true,
      });
      if (!ok) {
        return;
      }
    }
    repoStore.setDirty(filePath, false);
    await load(false);
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
</script>

<div class="file-view">
  <div class="title-row" title={filePath}>
    <div class="crumbs">
      <span class="crumb root">
        <Icon name={crumbs.rootIsRepo ? "folder-git" : "folder"} size={12} />
        {folder?.name ?? ""}
      </span>
      {#each crumbs.segments as segment, index (segment.path)}
        <!-- The separator travels with its segment so wrapped lines never end in a chevron. -->
        <span class="crumb" class:repo={segment.isRepo} class:file={index === crumbs.segments.length - 1}>
          <span class="sep"><Icon name="chevron-right" size={11} /></span>
          {#if segment.isRepo}
            <Icon name="folder-git" size={12} />
          {:else if index === crumbs.segments.length - 1}
            <Icon name="file" size={12} />
          {/if}
          {segment.name}
        </span>
      {/each}
    </div>
    {#if dirty}
      <span class="badge unsaved" title="Unsaved changes">Unsaved</span>
    {/if}
    {#if toneLabel}
      <span class="badge {tone}">{toneLabel}</span>
    {/if}
    {#if conflictCount > 0}
      <span class="badge conflict">{conflictCount} {conflictCount === 1 ? "conflict" : "conflicts"}</span>
    {/if}
    <button class="copy-path" onclick={() => void copyPath()} title="Copy relative path" aria-label="Copy relative path">
      <Icon name="copy" size={12} />
    </button>
  </div>

  <!-- Actions wrap onto more lines instead of hiding when the editor is narrow. -->
  <div class="actions" role="toolbar" aria-label="File actions">
    {#if location && editable}
      <div class="group nav">
        <button
          class="btn small icon-only"
          onclick={() => goToSection(-1)}
          disabled={navMarks.length === 0}
          title="Previous change or conflict (Shift+F7)"
          aria-label="Previous change or conflict"
        >
          <Icon name="arrow-up" size={13} />
        </button>
        <button
          class="btn small icon-only"
          onclick={() => goToSection(1)}
          disabled={navMarks.length === 0}
          title="Next change or conflict (F7)"
          aria-label="Next change or conflict"
        >
          <Icon name="arrow-down" size={13} />
        </button>
        <span class="nav-label">{navLabel}</span>
      </div>
    {/if}
    {#if conflictCount > 0 || tone === "conflict"}
      <div class="group">
        {#if conflictCount > 0}
          <button class="btn small" onclick={() => acceptAll("current")} disabled={saving} title="Resolve every conflict with the current side">
            Accept All Current
          </button>
          <button class="btn small" onclick={() => acceptAll("incoming")} disabled={saving} title="Resolve every conflict with the incoming side">
            Accept All Incoming
          </button>
        {/if}
        {#if tone === "conflict"}
          <button class="btn small" onclick={() => void openMergeTool()} disabled={saving}>
            <Icon name="merge" size={13} />
            Resolve in Merge Tool
          </button>
          {#if conflictCount === 0 && editable}
            <button class="btn small primary" onclick={markResolved} disabled={saving} title="Save the file and stage it">
              <Icon name="check" size={13} />
              Mark as Resolved
            </button>
          {/if}
        {/if}
      </div>
    {/if}
    <div class="group end">
      {#if location && editable}
        <button
          class="btn small"
          class:toggled={settings.blameGutter}
          onclick={() => settings.setPreference("blameGutter", !settings.blameGutter)}
          title="Show who changed each line and when (git blame)"
          aria-pressed={settings.blameGutter}
        >
          <Icon name="history" size={13} />
          Blame
        </button>
      {/if}
      <!-- Save and Revert live in the File menu (Cmd+S), not on the toolbar. -->
    </div>
  </div>

  {#if isMarkdown && editable && loadError === null}
    <MarkdownToolbar
      {viewMode}
      onViewMode={(next) => void setViewMode(next)}
      onFormat={applyFormat}
      onRichFormat={(action) => richRef?.format(action)}
      onRichLink={() => void richRef?.link()}
    />
  {/if}

  {#if preview}
    <!-- Only while the tab is on screen, so a hidden or closed tab frees the picture or document. -->
    {#if isActive && folder}
      {#await import("./MediaPreview.svelte") then media}
        <media.default {filePath} rootPath={folder.root} relativePath={folderPath} {preview} reloadToken={previewToken} />
      {/await}
    {/if}
  {:else if loadError}
    <div class="message">
      <p>{loadError}</p>
      <button class="btn" onclick={() => void repoStore.closeTab(filePath)}>Close</button>
    </div>
  {:else if file?.tooLarge}
    <div class="message dim">This file is too large to open here ({formatSize(file.size)}).</div>
  {:else if file?.binary}
    <div class="message dim">Binary file ({formatSize(file.size)}), not shown.</div>
  {:else if !file}
    <div class="message dim">Loading...</div>
  {/if}
  <div class="editor-area" class:hidden={!editable || loadError !== null} bind:clientWidth={areaWidth}>
    <div class="editor" class:hidden={showPreview && viewMode === "preview"} bind:this={host}></div>
    {#if showPreview}
      {#if viewMode === "split"}
        <ResizeHandle
          label="Resize Markdown preview"
          panel="right"
          size={previewWidth}
          min={Math.round(areaWidth * MARKDOWN_PREVIEW_RATIO_RANGE[0])}
          max={Math.round(areaWidth * MARKDOWN_PREVIEW_RATIO_RANGE[1])}
          defaultSize={Math.round(areaWidth / 2)}
          onResize={(size) => resizePreview(size, false)}
          onCommit={(size) => resizePreview(size, true)}
        />
      {/if}
      <div
        class="preview-pane"
        class:full={viewMode === "preview"}
        style:width={viewMode === "split" ? `${settings.markdownPreviewRatio * 100}%` : null}
      >
        <!--
          Only the tab on screen keeps its rendered document: a hidden tab frees it (with its
          diagrams and images) and draws it again when shown, at the same place.
        -->
        {#if isActive && viewMode === "preview"}
          <!-- Preview mode is the rendered document, editable in place. -->
          <RichMarkdownView
            bind:this={richRef}
            {filePath}
            {docVersion}
            getSource={() => view?.state.doc.toString() ?? ""}
            initialScroll={richScroll}
            onLeave={(scrollTop) => (richScroll = scrollTop)}
            onEdit={applyRichEdit}
            onSave={() => void save()}
          />
        {:else if isActive}
          <MarkdownPreview
            bind:this={previewRef}
            {filePath}
            {docVersion}
            getSource={() => view?.state.doc.toString() ?? ""}
            view={editorView}
            visible={isActive}
            syncScroll={viewMode === "split"}
            {initialLine}
            onLeave={(topLine) => (initialLine = topLine)}
            onToggleTask={toggleTask}
            onSave={() => void save()}
          />
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .file-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--editor-bg);
  }

  .title-row {
    flex: none;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-height: 32px;
    min-width: 0;
    padding: 4px 6px 4px 12px;
    background: var(--panel);
    color: var(--text-faint);
    font-size: 12.5px;
  }

  .title-row > :global(*) {
    flex: none;
  }

  .title-row > .badge,
  .title-row > .copy-path,
  .title-row > .close {
    margin-top: 1px;
  }

  .crumbs {
    flex: 1 1 auto !important;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 3px;
    padding-top: 3px;
    line-height: 18px;
  }

  .sep {
    display: inline-flex;
    color: var(--text-faint);
  }

  .crumb {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    max-width: 100%;
    color: var(--text-dim);
    /* A single very long folder or file name still breaks instead of overflowing. */
    overflow-wrap: anywhere;
  }

  .crumb.repo {
    color: var(--accent);
  }

  .crumb.file {
    color: var(--text);
    font-weight: 600;
  }





  .copy-path {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
  }

  .copy-path:hover {
    background: var(--hover);
    color: var(--text);
  }

  .close {
    height: 24px;
    min-width: 24px;
  }

  .actions {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 5px 10px 6px 12px;
    border-bottom: 1px solid var(--border-strong);
    background: var(--panel);
  }

  .group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  /* Save and friends sit on the right, and move to their own line when needed. */
  .group.end {
    margin-left: auto;
  }

  .actions :global(.btn) {
    white-space: nowrap;
  }

  .btn.icon-only {
    width: 26px;
    padding: 0;
    justify-content: center;
  }

  .nav-label {
    min-width: 64px;
    font-size: 12px;
    color: var(--text-dim);
  }

  .badge {
    flex: none;
    padding: 0 7px;
    border-radius: 9px;
    font-size: 11px;
    line-height: 18px;
    background: var(--hover);
    color: var(--text-dim);
  }

  .badge.unsaved {
    background: color-mix(in srgb, var(--warning) 18%, transparent);
    color: var(--warning);
  }

  .badge.modified {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
  }

  .badge.added {
    background: color-mix(in srgb, var(--success) 15%, transparent);
    color: var(--success);
  }

  .badge.conflict {
    background: color-mix(in srgb, var(--danger) 15%, transparent);
    color: var(--danger);
  }

  .editor-area {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .editor {
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }

  .editor-area.hidden,
  .editor.hidden {
    display: none;
  }

  .preview-pane {
    flex: none;
    min-width: 0;
    height: 100%;
    border-left: 1px solid var(--border-strong);
  }

  .preview-pane.full {
    flex: 1;
    border-left: none;
  }

  .editor :global(.cm-editor) {
    height: 100%;
  }

  .message {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 24px;
    text-align: center;
  }

  .message p {
    margin: 0;
  }
</style>
