// The Markdown rich text editor (TipTap, on ProseMirror), the Rich Editor view: the rendered document is edited
// in place. The source text stays the truth, as in Orca's editor (rich/, MIT): a file is editable only
// when its Markdown survives the editor's round trip, and saving patches the edit onto the file's own text, so
// untouched text keeps its exact spelling (rich/rich-markdown-serialization-commit.ts). Source changes made
// elsewhere load again here. Loaded the first time a Markdown file shows its preview.

import { Editor } from "@tiptap/core";
import { Selection, TextSelection } from "@tiptap/pm/state";
import type { LinkContext } from "./links";
import { releaseMermaid } from "./mermaid";
import { NearScreen } from "./nearScreen";
import { getMarkdownRichModeUnsupportedMessage } from "./rich/markdown-rich-mode";
import { exceedsMarkdownRichModeSizeLimit } from "./rich/markdown-rich-size-limit";
import { encodeRawMarkdownHtmlForRichEditor } from "./rich/raw-markdown-html";
import { createRichMarkdownExtensions } from "./rich/rich-markdown-extensions";
import { normalizeEmptyListItems } from "./rich/rich-markdown-normalize";
import { serializeRichMarkdownForReconcile } from "./rich/rich-markdown-reconcile-serializer";
import { commitRichMarkdownSerialization } from "./rich/rich-markdown-serialization-commit";
import { createRichMarkdownEditorCodec, type RichMarkdownEditorCodec } from "./rich/rich-markdown-source-transport";
import { codeView, imageView, type NodeViewContext } from "./richNodeViews";
import { type SourceEdit, sourceEdit, splitFrontMatter } from "./richSync";

/** What the toolbar asks the rich editor to do. */
export type RichAction =
  | "bold"
  | "italic"
  | "strikethrough"
  | "code"
  | "bullet"
  | "ordered"
  | "task"
  | "quote"
  | "codeBlock"
  | "table"
  | "heading1"
  | "heading2"
  | "heading3"
  | "paragraph";

export interface RichEditorOptions {
  source: string;
  /** An edit made here, as a change to the source text. */
  onEdit: (edit: SourceEdit) => void;
  /** The document has Markdown this editor cannot keep exactly; editing is turned off. */
  onReadOnly: (reason: string) => void;
  linkContext: () => LinkContext;
  loadImage: (filePath: string) => Promise<string>;
  isDark: () => boolean;
}

/** The pause after typing before an edit is saved into the text (Orca's 300 ms: a save re-parses once). */
const SYNC_DELAY_MS = 300;
const TOO_LARGE = "This file is too large for the rich editor. Edit it in the text editor.";

export class RichMarkdownEditor {
  private editor: Editor | null = null;
  private readonly codec: RichMarkdownEditorCodec = createRichMarkdownEditorCodec();
  /** The whole text as the text editor has it, front matter included. */
  private source = "";
  private frontMatter = "";
  /** The save's state (Orca's refs): the body's own text, its round trip, and the text last written. */
  private readonly saved = {
    originalSourceRef: { current: "" },
    baseCanonicalRef: { current: "" },
    lastCommittedMarkdownRef: { current: "" },
  };
  private loading = false;
  /** A file was loaded once (later loads keep the caret). */
  private loaded = false;
  private syncTimer: ReturnType<typeof setTimeout> | undefined;
  private editable = true;
  /** Diagrams and images draw only near the visible part of the editor's scroller. */
  private nearScreen: NearScreen | null = null;

  private constructor(private readonly options: RichEditorOptions) {}

  static async create(root: HTMLElement, options: RichEditorOptions): Promise<RichMarkdownEditor> {
    const instance = new RichMarkdownEditor(options);
    instance.start(root);
    return instance;
  }

  private start(root: HTMLElement): void {
    // The scroller is the editor root's parent (RichMarkdownView).
    this.nearScreen = new NearScreen(root.parentElement);
    const views: NodeViewContext = { ...this.options, owner: this, nearScreen: () => this.nearScreen };
    this.editor = new Editor({
      element: root,
      extensions: createRichMarkdownExtensions({
        codec: this.codec,
        nodeViews: {
          image: ({ node }) => imageView(node, views),
          codeBlock: ({ node }) => codeView(node, views),
        },
      }),
      editable: false,
      onUpdate: ({ transaction }) => {
        if (!this.loading && transaction.docChanged) {
          this.scheduleSync();
        }
      },
      onBlur: () => this.flush(),
    });
    // Without CSS overflow-anchor (WebKit), ProseMirror keeps the view steady by hand: it moves the scrollTop of
    // every ancestor up to the page, which slid the whole window up when a file opened. Any value here ("auto" is
    // the default) makes it leave scrolling to the browser.
    this.editor.view.dom.style.overflowAnchor = "auto";
    this.load(this.options.source);
  }

  /** The source changed elsewhere (the text editor, Revert, a reload): show it. */
  setSource(source: string): void {
    if (source === this.source) {
      return;
    }
    clearTimeout(this.syncTimer);
    this.syncTimer = undefined;
    this.load(source);
  }

  /** Writes a pending edit at once, e.g. before saving. */
  flush(): void {
    if (this.syncTimer !== undefined) {
      clearTimeout(this.syncTimer);
      this.syncTimer = undefined;
      this.sync();
    }
  }

  /** Takes the keyboard where the caret is, without scrolling to it (the view keeps its place). */
  focus(): void {
    this.editor?.commands.focus(null, { scrollIntoView: false });
  }

  destroy(): void {
    clearTimeout(this.syncTimer);
    this.nearScreen?.disconnect();
    this.nearScreen = null;
    releaseMermaid(this);
    this.editor?.destroy();
    this.editor = null;
  }

  run(action: RichAction): void {
    const editor = this.editor;
    if (!editor || !this.editable) {
      return;
    }
    const chain = editor.chain().focus();
    const commands: Record<RichAction, () => boolean> = {
      bold: () => chain.toggleBold().run(),
      italic: () => chain.toggleItalic().run(),
      strikethrough: () => chain.toggleStrike().run(),
      code: () => chain.toggleCode().run(),
      bullet: () => chain.toggleBulletList().run(),
      ordered: () => chain.toggleOrderedList().run(),
      task: () => chain.toggleTaskList().run(),
      quote: () => chain.toggleBlockquote().run(),
      codeBlock: () => chain.toggleCodeBlock().run(),
      table: () => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      heading1: () => chain.toggleHeading({ level: 1 }).run(),
      heading2: () => chain.toggleHeading({ level: 2 }).run(),
      heading3: () => chain.toggleHeading({ level: 3 }).run(),
      paragraph: () => chain.setParagraph().run(),
    };
    commands[action]();
  }

  /** Adds a link to the selected text, or removes the link it is in. */
  toggleLink(href: string): void {
    const editor = this.editor;
    if (!editor || !this.editable) {
      return;
    }
    if (editor.isActive("link")) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
  }

  /** Ticks or clears a task item; `element` is inside its list item. */
  toggleTask(element: Element): void {
    const editor = this.editor;
    if (!editor || !this.editable) {
      return;
    }
    const view = editor.view;
    let position: number;
    try {
      position = view.posAtDOM(element, 0);
    } catch {
      return;
    }
    const resolved = view.state.doc.resolve(Math.min(position, view.state.doc.content.size));
    for (let depth = resolved.depth; depth > 0; depth--) {
      const node = resolved.node(depth);
      if (node.type.name === "taskItem") {
        const at = resolved.before(depth);
        view.dispatch(view.state.tr.setNodeMarkup(at, undefined, { ...node.attrs, checked: !node.attrs.checked }));
        return;
      }
    }
  }

  private load(source: string): void {
    const editor = this.editor;
    if (!editor) {
      return;
    }
    this.source = source;
    const { frontMatter, body } = splitFrontMatter(source);
    this.frontMatter = frontMatter;
    const reason = exceedsMarkdownRichModeSizeLimit(body) ? TOO_LARGE : getMarkdownRichModeUnsupportedMessage(body);
    const first = !this.loaded;
    const { from, to } = editor.state.selection;
    this.loading = true;
    try {
      // Not undoable here: the change came from the text, which has its own history.
      editor
        .chain()
        .command(({ tr }) => {
          tr.setMeta("addToHistory", false);
          return true;
        })
        .setContent(reason === TOO_LARGE ? "" : encodeRawMarkdownHtmlForRichEditor(body, this.codec), {
          contentType: "markdown",
          emitUpdate: false,
        })
        .run();
      // Hard-wrapped paragraphs stay one paragraph; an empty list item is not split on load (Orca's onCreate).
      normalizeEmptyListItems(editor);
      // A file opens with the caret at the top (TipTap leaves it at the end, and focusing scrolled there); text
      // reloaded from elsewhere keeps the caret where it was, as in Orca.
      const doc = editor.state.doc;
      const selection = first
        ? Selection.atStart(doc)
        : TextSelection.between(
            doc.resolve(Math.min(from, doc.content.size)),
            doc.resolve(Math.min(to, doc.content.size)),
          );
      editor.view.dispatch(editor.state.tr.setSelection(selection).setMeta("addToHistory", false));
      this.loaded = true;
      this.saved.originalSourceRef.current = body;
      this.saved.baseCanonicalRef.current = editor.getMarkdown();
      this.saved.lastCommittedMarkdownRef.current = body;
    } catch (error) {
      this.loading = false;
      this.setReadOnly(
        `This Markdown could not be read for rich editing: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    } finally {
      this.loading = false;
    }
    if (reason) {
      this.setReadOnly(reason);
    } else {
      this.editable = true;
      editor.setEditable(true, false);
    }
  }

  private setReadOnly(reason: string): void {
    this.editable = false;
    this.editor?.setEditable(false, false);
    this.options.onReadOnly(reason);
  }

  private scheduleSync(): void {
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = undefined;
      this.sync();
    }, SYNC_DELAY_MS);
  }

  /** Saves the edit into the text: patched onto the file's own spelling where that is proven safe. */
  private sync(): void {
    if (!this.editor || !this.editable) {
      return;
    }
    const commit = commitRichMarkdownSerialization(this.editor, this.saved, (markdown) =>
      serializeRichMarkdownForReconcile(markdown),
    );
    if (!commit.didSerialize) {
      return;
    }
    const next = this.frontMatter + commit.markdown;
    const edit = sourceEdit(this.source, next);
    this.source = next;
    if (edit) {
      this.options.onEdit(edit);
    }
  }
}
