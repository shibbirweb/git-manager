// The Markdown rich text editor (TipTap, on ProseMirror), the Rich Editor view: the rendered document is edited
// in place. The source text stays the truth, as in Orca's editor (rich/, MIT): a file is editable only
// when its Markdown survives the editor's round trip, and saving patches the edit onto the file's own text, so
// untouched text keeps its exact spelling (rich/rich-markdown-serialization-commit.ts). Source changes made
// elsewhere load again here. Loaded the first time a Markdown file shows its preview.

import { Editor } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { Selection, TextSelection } from "@tiptap/pm/state";
import type { NodeView } from "@tiptap/pm/view";
import { classifyImage, type LinkContext } from "./links";
import { releaseMermaid, renderMermaid } from "./mermaid";
import { NearScreen, releaseDiagram, restoreDiagramHeight } from "./nearScreen";
import { getMarkdownRichModeUnsupportedMessage } from "./rich/markdown-rich-mode";
import { exceedsMarkdownRichModeSizeLimit } from "./rich/markdown-rich-size-limit";
import { encodeRawMarkdownHtmlForRichEditor } from "./rich/raw-markdown-html";
import { createRichMarkdownExtensions } from "./rich/rich-markdown-extensions";
import { normalizeEmptyListItems } from "./rich/rich-markdown-normalize";
import { serializeRichMarkdownForReconcile } from "./rich/rich-markdown-reconcile-serializer";
import { commitRichMarkdownSerialization } from "./rich/rich-markdown-serialization-commit";
import { createRichMarkdownEditorCodec, type RichMarkdownEditorCodec } from "./rich/rich-markdown-source-transport";
import { type SourceEdit, sourceEdit, splitFrontMatter } from "./richSync";
import { sanitizeSvg } from "./sanitize";

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
const MERMAID_DELAY_MS = 400;
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
    this.editor = new Editor({
      element: root,
      extensions: createRichMarkdownExtensions({
        codec: this.codec,
        nodeViews: {
          image: ({ node }) => this.imageView(node),
          codeBlock: ({ node }) => this.codeView(node),
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

  private imageView(node: ProseNode): NodeView {
    const dom = document.createElement("img");
    let shown = "";
    const show = (current: ProseNode) => {
      const src = String(current.attrs.src ?? "");
      dom.alt = String(current.attrs.alt ?? "");
      dom.title = String(current.attrs.title ?? "");
      if (src === shown) {
        return;
      }
      shown = src;
      dom.removeAttribute("src");
      dom.classList.remove("md-image-blocked");
      const target = classifyImage(src, this.options.linkContext());
      if (target.kind === "data") {
        dom.src = target.url;
      } else if (target.kind === "local") {
        const load = () => {
          void this.options
            .loadImage(target.filePath)
            .then((url) => {
              if (shown === src) {
                dom.src = url;
              }
            })
            .catch((error: unknown) => {
              dom.classList.add("md-image-blocked");
              dom.title = error instanceof Error ? error.message : String(error);
            });
        };
        // Loaded once scrolled near, like the preview's images.
        const nearScreen = this.nearScreen;
        if (nearScreen) {
          nearScreen.unwatch(dom);
          nearScreen.watch(dom, () => {
            nearScreen.unwatch(dom);
            load();
          });
        } else {
          load();
        }
      } else {
        dom.classList.add("md-image-blocked");
        dom.title = target.kind === "remote" ? "Remote images are not loaded" : target.reason;
      }
    };
    show(node);
    return {
      dom,
      update: (updated) => {
        if (updated.type !== node.type) {
          return false;
        }
        show(updated);
        return true;
      },
      destroy: () => this.nearScreen?.unwatch(dom),
    };
  }

  /**
   * Code blocks; a mermaid block also shows its diagram under the code. The diagram is drawn
   * only while it is near the screen and freed when scrolled far away (see nearScreen.ts).
   */
  private codeView(node: ProseNode): NodeView {
    const dom = document.createElement("div");
    dom.className = "md-rich-code";
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    pre.appendChild(code);
    dom.appendChild(pre);
    const diagram = document.createElement("div");
    diagram.className = "md-mermaid";
    diagram.contentEditable = "false";
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest = "";
    let drawn: string | null = null;
    let near = false;
    let watching = false;

    const render = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const text = latest;
        drawn = text;
        void renderMermaid(this, text, this.options.isDark()).then((result) => {
          if (drawn !== text || !near) {
            return;
          }
          restoreDiagramHeight(diagram);
          if ("svg" in result) {
            // Sanitized like the preview's diagrams: a document's diagram is untrusted input.
            diagram.replaceChildren(sanitizeSvg(result.svg));
            diagram.classList.remove("md-mermaid-error");
          } else {
            diagram.textContent = result.error;
            diagram.classList.add("md-mermaid-error");
          }
        });
      }, delay);
    };

    const update = (current: ProseNode) => {
      const language = String(current.attrs.language ?? "");
      code.className = language ? `language-${language}` : "";
      pre.dataset.language = language;
      if (language !== "mermaid") {
        if (watching) {
          this.nearScreen?.unwatch(diagram);
          watching = false;
        }
        clearTimeout(timer);
        diagram.remove();
        drawn = null;
        return;
      }
      latest = current.textContent;
      if (!diagram.isConnected) {
        dom.appendChild(diagram);
      }
      if (!watching) {
        watching = true;
        this.nearScreen?.watch(
          diagram,
          () => {
            near = true;
            if (drawn !== latest || diagram.childElementCount === 0) {
              render(0);
            }
          },
          () => {
            near = false;
            clearTimeout(timer);
            drawn = null;
            releaseDiagram(diagram);
          },
        );
      } else if (near && latest !== drawn) {
        // Typing in the diagram's code draws it again after a pause.
        render(MERMAID_DELAY_MS);
      }
    };
    update(node);
    return {
      dom,
      contentDOM: code,
      update: (updated) => {
        if (updated.type !== node.type) {
          return false;
        }
        update(updated);
        return true;
      },
      // The diagram is drawn by us, not typed in.
      ignoreMutation: (mutation) => !code.contains(mutation.target),
      destroy: () => {
        clearTimeout(timer);
        this.nearScreen?.unwatch(diagram);
      },
    };
  }
}
