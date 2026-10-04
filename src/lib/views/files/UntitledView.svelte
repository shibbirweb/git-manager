<!--
  Editor tab of an Untitled tab (File > New File): text not saved to a file yet. Save asks
  where to write it; inside the workspace the tab then shows that file, outside it the tab
  closes. With Remember unsaved changes the text is kept across restarts (unsavedText.svelte.ts).
-->
<script lang="ts">
  import { EditorState } from "@codemirror/state";
  import { EditorView, keymap } from "@codemirror/view";
  import { save as saveDialog } from "@tauri-apps/plugin-dialog";
  import { onMount, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { usesDefaultKeys } from "$lib/commands/commandRuntime";
  import { editorIndent } from "$lib/editor/indentation";
  import { selectionInfo } from "$lib/editor/selectionInfo";
  import { baseExtensions } from "$lib/editor/setup";
  import { wordWrap } from "$lib/editor/wordWrap";
  import { editorStatus } from "$lib/stores/editorStatus.svelte";
  import { fileCommands } from "$lib/stores/fileCommands.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { unsavedText } from "$lib/stores/unsavedText.svelte";
  import { suggestedFileName, untitledTitle } from "$lib/stores/untitledTabs";
  import { baseName, folderFor, fromNativePath, joinPath, parentOf, relativeTo } from "$lib/stores/workspacePaths";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { changesSelection } from "../changes/selection.svelte";

  let { tabPath, groupId }: { tabPath: string; groupId: number } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let view: EditorView | null = null;
  let saving = false;
  let ready = $state(false);

  const shown = $derived(changesSelection.tabShown(groupId, tabPath));
  const isActive = $derived(shown && repoStore.focusedGroupId === groupId);

  function reportStatus(state: EditorState | undefined = view?.state): void {
    if (!state || !isActive) {
      return;
    }
    const selection = state.selection.main;
    const line = state.doc.lineAt(selection.head);
    editorStatus.report({
      filePath: tabPath,
      line: line.number,
      column: selection.head - line.from + 1,
      selected: selection.to - selection.from,
      selectedLines: selection.empty ? 0 : state.doc.lineAt(selection.to).number - state.doc.lineAt(selection.from).number + 1,
      eol: "lf",
      tabSize: state.tabSize,
      indentTabs: editorIndent(state).useTabs,
      indentDetected: editorIndent(state).detected,
      language: "Plain Text",
    });
  }

  $effect(() => {
    if (isActive) {
      untrack(() => reportStatus());
    }
  });

  // File > Save, Save All and Revert reach this tab like a file's.
  $effect(() => {
    void isActive;
    const editable = ready;
    untrack(() => fileCommands.report(tabPath, { editable, markdownMode: null }));
  });

  onMount(() => {
    void start();
    const unregister = fileCommands.register(tabPath, {
      save: () => save(),
      revert,
      setViewMode: () => undefined,
      text: () => view?.state.doc.toString() ?? null,
      selection: () => (view ? selectionInfo(view.state) : null),
      focus: () => view?.focus(),
      preferred: () => repoStore.focusedGroupId === groupId,
      replaceText,
    });
    return () => {
      unregister();
      // A waiting write goes now, while the text is still here.
      unsavedText.writeNow(tabPath);
      // Moved to the other group: the next editor of the tab starts from this text.
      if (view && repoStore.tabs.some((tab) => tab.path === tabPath)) {
        unsavedText.park(tabPath, view.state.doc.toString());
      }
      editorStatus.clear(tabPath);
      view?.destroy();
      view = null;
    };
  });

  /** The text to start from: the editor it moved from, else the text kept from last time. */
  async function start(): Promise<void> {
    let text = unsavedText.takeParked(tabPath);
    if (text === null && unsavedText.has(tabPath)) {
      text = await unsavedText.read(tabPath);
    }
    if (!host || view) {
      return;
    }
    createEditor(text ?? "");
  }

  function createEditor(text: string): void {
    if (!host) {
      return;
    }
    const saveKeys = keymap.of([
      {
        key: "Mod-s",
        run: () => {
          if (!usesDefaultKeys("file.save")) {
            return false;
          }
          void save();
          return true;
        },
      },
    ]);
    const listener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        textChanged(update.state);
      }
      if (update.docChanged || update.selectionSet) {
        reportStatus(update.state);
      }
    });
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: text,
        extensions: [saveKeys, baseExtensions({ readOnly: false }), wordWrap(settings.wordWrap), listener],
      }),
    });
    unsavedText.setTitle(tabPath, text);
    repoStore.setDirty(tabPath, text.length > 0);
    ready = true;
    reportStatus();
    if (shown) {
      view.focus();
    }
  }

  /** An Untitled tab has unsaved changes while it has any text. */
  function textChanged(state: EditorState): void {
    const empty = state.doc.length === 0;
    unsavedText.setTitle(tabPath, empty ? "" : state.doc.sliceString(0, 4096));
    repoStore.setDirty(tabPath, !empty);
    if (!empty) {
      unsavedText.schedule(tabPath, () => view?.state.doc.toString() ?? null);
    }
  }

  /** Asks where to write the text; inside the workspace the tab becomes that file's tab. */
  async function save(): Promise<boolean> {
    if (!view || saving) {
      return false;
    }
    saving = true;
    try {
      return await saveAs(view.state.doc.toString());
    } finally {
      saving = false;
    }
  }

  async function saveAs(text: string): Promise<boolean> {
    const folders = repoStore.workspace?.folders ?? [];
    const startFolder = repoStore.repo?.root ?? folders[0]?.root ?? null;
    const name = suggestedFileName(text);
    let target: string | null;
    try {
      target = await saveDialog({ title: "Save File", defaultPath: startFolder ? joinPath(startFolder, name) : name });
    } catch (error) {
      toast.error("Could not open the save dialog", errorMessage(error));
      return false;
    }
    if (!target) {
      return false;
    }
    target = fromNativePath(target);
    const folder = folderFor(folders, target);
    try {
      if (folder) {
        await api.writeWorktreeFile(folder.root, relativeTo(folder.root, target), text, "lf");
      } else {
        await api.writeWorktreeFile(parentOf(target), baseName(target), text, "lf");
      }
    } catch (error) {
      toast.error("Save failed", errorMessage(error));
      return false;
    }
    if (folder) {
      repoStore.replaceUntitledTab(tabPath, target);
      toast.success(`Saved ${baseName(target)}`);
    } else {
      // A tab shows files of the workspace only.
      repoStore.setDirty(tabPath, false);
      await repoStore.closeTab(tabPath);
      toast.success(`Saved ${baseName(target)}`, `${target} is outside the workspace, so its tab closed.`);
    }
    return true;
  }

  /** File > Revert: the whole text goes, after asking. */
  async function revert(): Promise<void> {
    if (!view || view.state.doc.length === 0) {
      return;
    }
    const ok = await dialogs.confirm({
      title: "Revert File",
      message: `Discard the text of ${untitledTitle(view.state.doc.sliceString(0, 4096))}?`,
      confirmLabel: "Discard",
      danger: true,
    });
    if (ok && view) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" } });
    }
  }

  /** Local History and the MCP tools replace the whole text as one undoable change. */
  function replaceText(text: string): boolean {
    if (!view) {
      return false;
    }
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, userEvent: "input.revert" });
    view.focus();
    return true;
  }
</script>

<div class="untitled-view">
  <div class="editor" bind:this={host}></div>
</div>

<style>
  .untitled-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--editor-bg);
  }

  .editor {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .editor :global(.cm-editor) {
    height: 100%;
  }
</style>
