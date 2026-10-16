// A Markdown file's view: the text editor, the editor with a preview beside it, or the Rich Editor. Each file
// keeps its mode for the session, and a switch stays at the same place in the document.
import type { EditorState, TransactionSpec } from "@codemirror/state";
import { tick } from "svelte";
import { editorTopLine, scrollEditorToLine } from "$lib/markdown/editorScroll";
import { toggleTaskAt } from "$lib/markdown/format";
import type { SourceEdit } from "$lib/markdown/richSync";
import { rememberViewMode, sessionViewMode } from "$lib/markdown/viewMode";
import { type MarkdownViewMode, settings } from "$lib/stores/settings.svelte";
import type MarkdownPreview from "./MarkdownPreview.svelte";
import type RichMarkdownView from "./RichMarkdownView.svelte";
import type { FileEditor } from "./fileEditor.svelte";

export class MarkdownPane {
  mode = $state<MarkdownViewMode>("editor");
  /** Source line the preview starts at when it opens. */
  initialLine = $state(0);
  /** Where the rich editor was scrolled when its tab was last on screen. */
  richScroll = $state(0);
  preview = $state.raw<ReturnType<typeof MarkdownPreview> | null>(null);
  rich = $state.raw<ReturnType<typeof RichMarkdownView> | null>(null);
  #editor: FileEditor | null = null;

  constructor(private readonly filePath: string) {
    this.mode = sessionViewMode(filePath, settings.markdownViewMode);
  }

  attach(editor: FileEditor): void {
    this.#editor = editor;
  }

  async setMode(next: MarkdownViewMode): Promise<void> {
    if (next === this.mode) {
      return;
    }
    const view = this.#editor?.view ?? null;
    const fromPreview = this.mode === "preview";
    if (fromPreview) {
      // A rich edit still waiting for a pause in typing goes into the text first.
      this.rich?.flush();
    }
    const line = fromPreview ? 0 : view ? editorTopLine(view) : 0;
    this.initialLine = line;
    if (next === "preview") {
      // The text editor is hidden in the Rich Editor, but WebKit keeps the keyboard in it: typing on a read-only page
      // went into the file unseen.
      view?.contentDOM.blur();
    }
    this.mode = next;
    rememberViewMode(this.filePath, next);
    if (fromPreview && view) {
      await tick();
      requestAnimationFrame(() => {
        view.requestMeasure();
        scrollEditorToLine(view, line);
      });
    }
  }

  /** Runs a Markdown toolbar command on the editor as one undoable change. */
  applyFormat(command: (state: EditorState) => TransactionSpec): void {
    const view = this.#editor?.view;
    if (!view || this.mode === "preview") {
      return;
    }
    view.dispatch(command(view.state));
    view.focus();
  }

  /** An edit in the Rich Editor, applied to the text so it saves and undoes as usual. */
  applyRichEdit(edit: SourceEdit): void {
    const view = this.#editor?.view;
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
  toggleTask(lineIndex: number): void {
    const view = this.#editor?.view;
    const spec = view ? toggleTaskAt(view.state, lineIndex) : null;
    if (view && spec) {
      view.dispatch(spec);
    }
  }
}
