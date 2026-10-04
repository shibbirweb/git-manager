<!--
  Editor tab for a work tree file opened from the file explorer. With the editor split, the
  same file can have one of these in each group: they share one document (sharedDocs.ts).
-->
<script lang="ts">
  import { EditorState, type Text, type TransactionSpec } from "@codemirror/state";
  import { EditorView, keymap } from "@codemirror/view";
  import { onMount, tick, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { usesDefaultKeys } from "$lib/commands/commandRuntime";
  import { wordWrap } from "$lib/editor/wordWrap";
  import { editorIndent } from "$lib/editor/indentation";
  import { type AutoSaveTrigger, shouldAutoSave } from "$lib/editor/autoSave";
  import { caretLines, saveCleanupTransaction } from "$lib/editor/saveCleanup";
  import { blameExtension, loadBlame, setBlameDisplay } from "$lib/editor/blame";
  import { type DocMember, isReplay, type SharedDoc, sharedDocs, syncedDispatch } from "$lib/editor/sharedDocs";
  import { conflictField, conflictMarkers, resolveAllConflicts } from "$lib/editor/conflictDecorations";
  import type { ChangeMark } from "$lib/editor/lineDiff";
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
  import { folderFor, locateAbsolute, relativeTo } from "$lib/stores/workspacePaths";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { isMissingFileError } from "$lib/stores/navHistory";
  import { localHistory } from "$lib/localHistory/localHistory.svelte";
  import type { FileContent, HeadVersion } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import type { IconName } from "$lib/ui/icons";
  import ResizeHandle from "$lib/ui/ResizeHandle.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import NavigationBar from "$lib/navBar/NavigationBar.svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";
  import MarkdownToolbar from "./MarkdownToolbar.svelte";
  import RichMarkdownView from "./RichMarkdownView.svelte";
  import { tonesByPath } from "./tones";
  import { previewOf } from "./mediaPreview";
  import { fileToolbarParts } from "./fileToolbar";

  let { filePath, groupId }: { filePath: string; groupId: number } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let file = $state.raw<FileContent | null>(null);
  let loadError = $state<string | null>(null);
  let saving = $state(false);
  /** Conflict marker regions currently in the editor. */
  let conflictCount = $state(0);

  let view: EditorView | null = null;
  /** The same editor, for the Markdown preview's scroll sync. */
  let editorView = $state.raw<EditorView | null>(null);
  let marksTimer: ReturnType<typeof setTimeout> | undefined;
  /** This editor in the file's shared document: the saved text, the disk version and the saving flag live there. */
  const member: DocMember<EditorView> = { view: null };
  const shared: SharedDoc<EditorView> = joinShared();
  /** HEAD as last seen, and the text and HEAD the change marks and blame were made for. */
  let headVersion: HeadVersion | null = null;
  let marksFor: { doc: Text; blobId: string | null } | null = null;
  let blameFor: { doc: Text; commitId: string | null } | null = null;
  let requestId = 0;

  function joinShared(): SharedDoc<EditorView> {
    return sharedDocs.join(filePath, member);
  }

  const name = $derived(filePath.split("/").pop() ?? filePath);
  /** This tab is the one its editor group shows. */
  const shown = $derived(changesSelection.tabShown(groupId, filePath));
  /** ...in the focused group, so it feeds the status bar. */
  const isActive = $derived(shown && repoStore.focusedGroupId === groupId);

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
      indentTabs: editorIndent(state).useTabs,
      indentDetected: editorIndent(state).detected,
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
      preferred: () => repoStore.focusedGroupId === groupId,
      replaceText,
    });
    return () => {
      unregister();
      member.view = null;
      // Its text stays for a moment, for the editor that takes its place when the tab moves to the other group.
      sharedDocs.leave(filePath, member, view?.state.doc ?? null);
      // The file's editor in the other group keeps the status bar.
      if (sharedDocs.peers(filePath, member).length === 0) {
        editorStatus.clear(filePath);
      }
      clearTimeout(marksTimer);
      clearTimeout(positionTimer);
      clearTimeout(autoSaveTimer);
      // A closed tab keeps its caret for Reopen Closed Tab.
      notePosition();
      view?.destroy();
      view = null;
      editorView = null;
    };
  });

  // What the File and View menus may offer for this tab; the editor in the focused group reports last.
  $effect(() => {
    void isActive;
    const state = {
      editable: editable && loadError === null,
      markdownMode: isMarkdown && editable && loadError === null ? viewMode : null,
    };
    untrack(() => fileCommands.report(filePath, state));
  });

  // Pick up changes made outside the app while there are no local edits.
  let lastStatus: unknown = null;
  let lastFileVersion = 0;
  $effect(() => {
    // Changes in the owning repository, or anywhere in a folder without git.
    const status = location ? repoStatus : repoStore.workspaceVersion;
    // An unchanged status keeps its object, so a file edited again outside the app shows here instead.
    const fileVersion = location ? (repoStore.fileVersions[location.repo.root] ?? 0) : 0;
    const changed = status !== lastStatus || fileVersion !== lastFileVersion;
    if (lastStatus !== null && changed && !dirty && !saving && !shared.saving) {
      // One editor of a file reads it again; the other follows its text and updates its marks.
      if (sharedDocs.isLeader(filePath, member)) {
        void load(true);
      } else {
        void refreshGitInfo();
      }
    }
    lastStatus = status;
    lastFileVersion = fileVersion;
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
    // A refresh asks with the version on screen; Revert always reads the file again.
    const known = quiet && file && (view || file.binary || file.tooLarge) ? shared.diskVersion : null;
    try {
      const next = await api.readWorktreeFile(root, relative, known);
      if (request !== requestId) {
        return;
      }
      loadError = null;
      if (next.unchanged) {
        // Same text on disk: only HEAD may have moved (a commit), which the git info checks.
        void refreshGitInfo();
        return;
      }
      // A second editor starts from the first one's text, so it leaves the version that text came from.
      if (view || (sharedDocs.peers(filePath, member).length === 0 && !shared.text)) {
        shared.diskVersion = next.version;
      }
      const previousEol = file?.eol ?? next.eol;
      // The editor holds the text; the tab keeps only the file's details.
      file = { ...next, content: "" };
      if (next.binary || next.tooLarge) {
        view?.destroy();
        view = null;
        editorView = null;
        return;
      }
      if (view) {
        const previousText = view.state.doc.toString();
        if (previousText !== next.content) {
          // A change made outside the app: Local History keeps the text being replaced first
          // (Revert keeps the unsaved edits itself, in revert()).
          if (quiet) {
            localHistory.noteReload(filePath, previousText, previousEol, "external");
          }
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next.content } });
        }
        shared.baseline = view.state.doc;
        repoStore.setDirty(filePath, false);
        conflictCount = view.state.field(conflictField).length;
        void refreshGitInfo();
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

  /** The path HEAD has the file under: the old one for a staged rename. */
  function headPath(repoPath: string): string | null {
    return repoStatus?.files.find((entry) => entry.path === repoPath)?.origPath ?? null;
  }

  /**
   * Brings the change marks and blame up to date with the text and HEAD. Each runs only when
   * what it was made for changed, so a refresh of an unchanged tab costs one small call.
   */
  async function refreshGitInfo(): Promise<void> {
    const owner = location;
    const shown = view;
    if (!owner || !shown) {
      void updateMarks();
      return;
    }
    let head: HeadVersion;
    try {
      head = await api.headFileVersion(owner.repo.root, owner.repoPath, headPath(owner.repoPath));
    } catch {
      return;
    }
    if (view !== shown) {
      return;
    }
    headVersion = head;
    const doc = shown.state.doc;
    if (marksFor?.doc !== doc || marksFor.blobId !== head.blobId) {
      void updateMarks();
    }
    if (blameFor?.doc !== doc || blameFor.commitId !== head.commitId) {
      refreshBlame();
    }
  }

  /** Blames the text on screen; unsaved edits show as uncommitted. */
  function refreshBlame(): void {
    const owner = location;
    if (!view || !file || !owner) {
      return;
    }
    blameFor = { doc: view.state.doc, commitId: headVersion?.commitId ?? null };
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

  /** Changed lines against HEAD, computed by the backend; results for text edited since are dropped. */
  async function updateMarks(): Promise<void> {
    const owner = location;
    const shown = view;
    if (!shown) {
      return;
    }
    const doc = shown.state.doc;
    if (!owner) {
      marksFor = null;
      if (shown.state.field(changeMarkField).length > 0) {
        shown.dispatch({ effects: setChangeMarks.of([]) });
      }
      return;
    }
    if (marksFor?.doc === doc && marksFor.blobId === (headVersion?.blobId ?? null)) {
      return;
    }
    marksFor = { doc, blobId: headVersion?.blobId ?? null };
    let marks: ChangeMark[] = [];
    try {
      const result = await api.lineChangeMarks(owner.repo.root, owner.repoPath, headPath(owner.repoPath), doc.toString());
      marks = result.marks;
      if (view === shown && shown.state.doc === doc) {
        marksFor = { doc, blobId: result.head.blobId };
      }
    } catch {
      // No marks, e.g. while the repository is being changed; the next refresh tries again.
      marksFor = null;
    }
    // A newer edit schedules its own run.
    if (view !== shown || shown.state.doc !== doc) {
      return;
    }
    shown.dispatch({ effects: setChangeMarks.of(marks) });
  }

  function scheduleMarks(): void {
    clearTimeout(marksTimer);
    marksTimer = setTimeout(() => void updateMarks(), 200);
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
    if (request && request.filePath === filePath && request.groupId === groupId && view) {
      untrack(() => {
        const taken = navigation.takeReveal(filePath, groupId);
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
        // With a custom key for Save, Cmd+S is free and the custom key runs File > Save.
        run: () => {
          if (!usesDefaultKeys("file.save")) {
            return false;
          }
          void save();
          return true;
        },
      },
    ]);
    const navListener = EditorView.updateListener.of((update) => {
      if (update.docChanged || update.selectionSet || update.transactions.some((tr) => tr.effects.length > 0)) {
        updateNav(update.state);
      }
      // A changed Detect indentation or Tab size setting reads the file again.
      if (editorIndent(update.startState) !== editorIndent(update.state)) {
        reportStatus(update.state);
      }
      if (update.selectionSet || update.docChanged) {
        reportStatus(update.state);
        // A change replayed from the file's other editor is not a place the user went to.
        if (update.selectionSet || !isReplay(update)) {
          navigation.record({ filePath, line: update.state.doc.lineAt(update.state.selection.main.head).number - 1 });
        }
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
      // The editor that made the change reports unsaved edits, for both.
      if (update.docChanged && shared.baseline && !isReplay(update)) {
        repoStore.setDirty(filePath, !update.state.doc.eq(shared.baseline));
      }
      if (update.docChanged) {
        conflictCount = update.state.field(conflictField).length;
        scheduleMarks();
        docVersion++;
      }
    });
    // The file is open in the other group too, or its tab just moved here: start from that text,
    // unsaved edits included.
    const peer = sharedDocs.peers(filePath, member)[0] ?? null;
    const moved = !peer && shared.text && repoStore.isDirty(filePath) ? shared.text : null;
    shared.text = null;
    view = new EditorView({
      parent: host,
      dispatchTransactions: syncedDispatch(filePath, member),
      state: EditorState.create({
        doc: peer ? peer.state.doc : (moved ?? content),
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
          sessionExtension,
        ],
      }),
    });
    editorView = view;
    member.view = view;
    // The preview may have mounted before the editor existed; it renders the new text now.
    docVersion++;
    if ((!peer && !moved) || !shared.baseline) {
      shared.baseline = view.state.doc;
    }
    conflictCount = view.state.field(conflictField).length;
    void refreshGitInfo();
    updateNav(view.state);
    reportStatus();
    // Opened by Back / Forward or Go to File: go to that line; otherwise this is a new history entry.
    const reveal = navigation.takeReveal(filePath, groupId);
    // A tab restored at start or reopened comes back where it was, unless asked for a line.
    const restored = repoStore.takePendingPosition(filePath);
    if (reveal?.line != null) {
      revealLine(reveal.line, reveal.column ?? 0);
      initialLine = reveal.line;
    } else if (restored) {
      restorePosition(restored);
    }
    if (reveal?.focus) {
      view.focus();
    }
    navigation.record({ filePath, line: cursorLine() });
    repoStore.setDirty(filePath, !view.state.doc.eq(shared.baseline ?? view.state.doc));
  }

  /**
   * Writes the editor content; `quiet` skips the toast (Save All shows one for every file),
   * `auto` is an auto save, which leaves the lines with a caret alone in the clean-ups.
   */
  async function save(options: { quiet?: boolean; auto?: boolean } = {}): Promise<boolean> {
    const root = folder?.root;
    if (!view || !file || !root || saving || shared.saving) {
      return false;
    }
    // Preview mode: the rich editor's last keystrokes are in the text before it is written.
    richRef?.flush();
    applySaveCleanup(options.auto ?? false);
    const snapshot = view.state.doc;
    const eol = file.eol;
    saving = true;
    shared.saving = true;
    let saved = false;
    try {
      shared.diskVersion = await api.writeWorktreeFile(root, relativeTo(root, filePath), snapshot.toString(), eol);
      saved = true;
      if (!options.quiet) {
        toast.success(`Saved ${name}`);
      }
      refreshBlame();
      if (location) {
        // One status read: the watcher's event for this write, or a fallback if none comes.
        repoStore.fileSaved(location.repo.root);
      }
    } catch (error) {
      toast.error("Save failed", errorMessage(error));
    }
    saving = false;
    shared.saving = false;
    if (saved && view) {
      shared.baseline = snapshot;
      repoStore.setDirty(filePath, !view.state.doc.eq(snapshot));
    }
    return saved;
  }

  /** Local History > Revert: the version's text as one change, so Undo brings the edits back. */
  function replaceText(text: string): boolean {
    if (!view || !editable || loadError !== null) {
      return false;
    }
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, userEvent: "input.revert" });
    view.focus();
    return true;
  }

  /** Settings > Editor > Saving: trim whitespace and fix final newlines as one undoable change. */
  function applySaveCleanup(auto: boolean): void {
    if (!view) {
      return;
    }
    const spec = saveCleanupTransaction(view.state, {
      trimTrailingWhitespace: settings.trimTrailingWhitespace,
      insertFinalNewline: settings.insertFinalNewline,
      trimFinalNewlines: settings.trimFinalNewlines,
      markdown: isMarkdown,
      keepLines: auto ? caretLines(view.state) : undefined,
    });
    if (spec) {
      view.dispatch(spec);
    }
  }

  // Auto save (Settings > Editor > Saving): after a pause in typing, or when the focus leaves
  // this editor (another tab, another part of the window, another app). Conflicted files and
  // a file open in the merge tool are only saved by hand.
  let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;

  async function autoSave(trigger: AutoSaveTrigger): Promise<void> {
    clearTimeout(autoSaveTimer);
    const ok = shouldAutoSave({
      mode: settings.autoSave,
      trigger,
      dirty: repoStore.isDirty(filePath),
      editable: view !== null && editable && loadError === null,
      saving,
      conflicted: tone === "conflict",
      inMergeTool: location !== null && repoStore.repo?.root === location.repo.root && repoStore.mergeTarget === location.repoPath,
    });
    if (!ok) {
      return;
    }
    const saved = await save({ quiet: true, auto: true });
    // Typing went on while it was written.
    if (saved && repoStore.isDirty(filePath)) {
      scheduleAutoSave();
    }
  }

  function scheduleAutoSave(): void {
    clearTimeout(autoSaveTimer);
    if (settings.autoSave === "afterDelay") {
      autoSaveTimer = setTimeout(() => void autoSave("delay"), settings.autoSaveDelayMs);
    }
  }

  // Leaving this tab for another one is a focus change.
  let wasActive = false;
  $effect(() => {
    const active = shown;
    untrack(() => {
      if (wasActive && !active) {
        void autoSave("focus");
      }
      wasActive = active;
    });
  });

  // So is switching to another app.
  $effect(() => {
    if (settings.autoSave !== "onFocusChange") {
      return;
    }
    const onWindowBlur = () => void autoSave("focus");
    window.addEventListener("blur", onWindowBlur);
    return () => window.removeEventListener("blur", onWindowBlur);
  });

  // Tab session: where the caret and view are, for Reopen tabs on start and Reopen Closed Tab.
  let positionTimer: ReturnType<typeof setTimeout> | undefined;

  function notePosition(): void {
    if (!view) {
      return;
    }
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    // A hidden editor measures nothing; the last top line is kept then.
    const visible = view.scrollDOM.clientHeight > 0;
    repoStore.noteTabPosition(filePath, line.number - 1, head - line.from, visible ? editorTopLine(view) : null);
  }

  function schedulePosition(): void {
    clearTimeout(positionTimer);
    positionTimer = setTimeout(notePosition, 500);
  }

  function restorePosition(position: { line: number; column: number; topLine: number }): void {
    if (!view) {
      return;
    }
    const doc = view.state.doc;
    const target = doc.line(Math.max(1, Math.min(position.line + 1, doc.lines)));
    const top = doc.line(Math.max(1, Math.min(Math.floor(position.topLine) + 1, doc.lines)));
    view.dispatch({
      selection: { anchor: target.from + Math.min(position.column, target.length) },
      effects: EditorView.scrollIntoView(top.from, { y: "start" }),
    });
  }

  const sessionExtension = [
    EditorView.updateListener.of((update) => {
      if (update.selectionSet || update.docChanged) {
        schedulePosition();
      }
      if (update.docChanged && !isReplay(update)) {
        scheduleAutoSave();
      }
    }),
    EditorView.domEventObservers({
      scroll: () => schedulePosition(),
      blur: () => void autoSave("focus"),
    }),
  ];

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
    if (!view || !file || !owner || saving || shared.saving) {
      return;
    }
    const snapshot = view.state.doc;
    const eol = file.eol;
    saving = true;
    shared.saving = true;
    const done = await repoStore.run(
      "Mark resolved",
      (repoPath) => api.saveResolution(repoPath, owner.repoPath, snapshot.toString(), eol).then(() => true),
      { success: `Resolved ${name}`, repoPath: owner.repo.root },
    );
    saving = false;
    shared.saving = false;
    if (done && view) {
      shared.baseline = snapshot;
      repoStore.setDirty(filePath, !view.state.doc.eq(snapshot));
    }
  }

  /** Settings > Appearance > File toolbar: where the bar goes and which of its parts show for this file. */
  const toolbar = $derived(
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
      { gitTools: location !== null && editable, markdown: isMarkdown && editable && loadError === null },
    ),
  );

  const conflictText = $derived(`${conflictCount} ${conflictCount === 1 ? "conflict" : "conflicts"}`);

  const MARKDOWN_MODES: { value: MarkdownViewMode; icon: IconName; label: string }[] = [
    { value: "editor", icon: "editor-only", label: "Editor Only" },
    { value: "split", icon: "split-view", label: "Editor and Preview" },
    { value: "preview", icon: "eye", label: "Preview Only" },
  ];

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
      // Local History keeps the edits being thrown away.
      if (view && file) {
        localHistory.noteReload(filePath, view.state.doc.toString(), file.eol, "revert");
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

<!-- Settings > Appearance > File toolbar: Bottom moves the whole bar under the code (CSS order), Hidden or every part off leaves it out. -->
<div class="file-view" class:bar-bottom={settings.fileToolbar === "bottom"}>
  {#if toolbar.shown}
    <!-- One slim bar, like JetBrains: the path and badges on the left, compact actions on the right. -->
    <div class="file-bar">
      {#if toolbar.breadcrumbs}
        <NavigationBar targetPath={filePath} claimed={isActive} />
      {/if}
      {#if toolbar.badges}
        {#if dirty}
          <span class="badge unsaved" title="Unsaved changes"><span class="badge-text">Unsaved</span></span>
        {/if}
        {#if toneLabel}
          <span class="badge {tone}" title={toneLabel}><span class="badge-text">{toneLabel}</span></span>
        {/if}
        {#if conflictCount > 0}
          <span class="badge conflict" title={conflictText}><span class="badge-text">{conflictText}</span></span>
        {/if}
      {/if}

      <div class="actions" role="toolbar" aria-label="File actions">
        {#if toolbar.changes}
          <button
            class="tool"
            onclick={() => goToSection(-1)}
            disabled={navMarks.length === 0}
            title="Previous change or conflict (Shift+F7)"
            aria-label="Previous change or conflict"
          >
            <Icon name="arrow-up" size={13} />
          </button>
          <button
            class="tool"
            onclick={() => goToSection(1)}
            disabled={navMarks.length === 0}
            title="Next change or conflict (F7)"
            aria-label="Next change or conflict"
          >
            <Icon name="arrow-down" size={13} />
          </button>
          <span class="nav-label">{navLabel}</span>
          {#if toolbar.blame || toolbar.copyPath || toolbar.markdownView}
            <span class="divider" aria-hidden="true"></span>
          {/if}
        {/if}
        {#if toolbar.blame}
          <button
            class="tool"
            class:on={settings.blameGutter}
            onclick={() => settings.setPreference("blameGutter", !settings.blameGutter)}
            title="Blame: show who changed each line and when"
            aria-label="Blame"
            aria-pressed={settings.blameGutter}
          >
            <Icon name="history" size={13} />
          </button>
        {/if}
        <!-- Save and Revert live in the File menu (Cmd+S), not here. -->
        {#if toolbar.copyPath}
          <button class="tool" onclick={() => void copyPath()} title="Copy relative path" aria-label="Copy relative path">
            <Icon name="copy" size={12} />
          </button>
        {/if}
        {#if toolbar.markdownView}
          {#if toolbar.blame || toolbar.copyPath}
            <span class="divider" aria-hidden="true"></span>
          {/if}
          <div class="modes" role="radiogroup" aria-label="Markdown view">
            {#each MARKDOWN_MODES as mode (mode.value)}
              <button
                role="radio"
                aria-checked={viewMode === mode.value}
                class:on={viewMode === mode.value}
                onclick={() => void setViewMode(mode.value)}
                title={mode.label}
                aria-label={mode.label}
              >
                <Icon name={mode.icon} size={13} />
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Conflict actions are a tool for this file, so they get their own strip while it has conflicts. -->
  {#if conflictCount > 0 || tone === "conflict"}
    <div class="conflict-bar" role="toolbar" aria-label="Conflict actions">
      <span class="conflict-icon" aria-hidden="true"><Icon name="alert" size={13} /></span>
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

  {#if toolbar.markdownFormat}
    <MarkdownToolbar
      {viewMode}
      onFormat={applyFormat}
      onRichFormat={(action) => richRef?.format(action)}
      onRichLink={() => void richRef?.link()}
    />
  {/if}

  {#if preview}
    <!-- Only while the tab is on screen, so a hidden or closed tab frees the picture or document. -->
    {#if shown && folder}
      {#await import("./MediaPreview.svelte") then media}
        <media.default {filePath} {preview} reloadToken={previewToken} />
      {/await}
    {/if}
  {:else if loadError}
    <div class="message">
      <p>{loadError}</p>
      <button class="btn" onclick={() => void repoStore.closeTab(filePath, groupId)}>Close</button>
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
        {#if shown && viewMode === "preview"}
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
        {:else if shown}
          <MarkdownPreview
            bind:this={previewRef}
            {filePath}
            {docVersion}
            getSource={() => view?.state.doc.toString() ?? ""}
            view={editorView}
            visible={shown}
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

  /* About 28 px, like JetBrains' editor breadcrumbs, so the code starts right under the tabs. */
  .file-bar {
    flex: none;
    /* Container queries below collapse the bar's contents as the editor gets narrow. */
    container-type: inline-size;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 29px;
    min-width: 0;
    padding: 0 6px 0 10px;
    overflow: hidden;
    border-bottom: 1px solid var(--border-strong);
    background: var(--panel);
    color: var(--text-dim);
    font-size: 12px;
  }

  .badge {
    flex: none;
    padding: 0 6px;
    border-radius: 8px;
    font-size: 11px;
    line-height: 16px;
    white-space: nowrap;
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

  .actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: auto;
  }

  .tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .tool:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  .tool:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .tool.on {
    background: var(--selected-inactive);
    color: var(--text);
  }

  .nav-label {
    min-width: 58px;
    padding: 0 4px;
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--text-dim);
  }

  .divider {
    flex: none;
    width: 1px;
    height: 14px;
    margin: 0 4px;
    background: var(--border-strong);
  }

  .modes {
    flex: none;
    display: flex;
    padding: 1px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    background: var(--panel-alt);
  }

  .modes button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .modes button:hover:not(.on) {
    color: var(--text);
  }

  .modes button.on {
    background: var(--panel);
    color: var(--text);
    box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 18%, transparent);
  }

  /* Narrow editor: the counter goes first (still read by screen readers), then badges become dots, then dividers. */
  @container (max-width: 600px) {
    .nav-label {
      position: absolute;
      width: 1px;
      height: 1px;
      min-width: 0;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
    }
  }

  @container (max-width: 480px) {
    .badge {
      width: 8px;
      height: 8px;
      padding: 0;
      border-radius: 50%;
      background: currentColor;
    }

    .badge-text {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  }

  @container (max-width: 320px) {
    .actions .divider {
      display: none;
    }
  }

  .conflict-bar {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
    min-height: 30px;
    padding: 3px 8px 3px 10px;
    border-bottom: 1px solid var(--border-strong);
    background: color-mix(in srgb, var(--danger) 7%, var(--panel));
  }

  .conflict-bar .btn.small {
    height: 22px;
  }

  .conflict-icon {
    display: inline-flex;
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

  /* File toolbar Bottom: the whole bar goes under the code, also under a message or a preview. */
  .file-view.bar-bottom .file-bar {
    order: 1;
    margin-top: auto;
    border-top: 1px solid var(--border-strong);
    border-bottom: none;
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
