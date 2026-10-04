// The Markdown rich text editor (Milkdown, on ProseMirror and remark), shown in Preview mode so
// the rendered document can be edited in place. The source text stays the truth: every edit is
// written back block by block (richSync.ts), and source changes made elsewhere load again here.
// Loaded the first time a Markdown file shows its preview.

import {
  Editor,
  editorViewCtx,
  editorViewOptionsCtx,
  parserCtx,
  remarkCtx,
  remarkStringifyOptionsCtx,
  rootCtx,
  schemaCtx,
  serializerCtx,
} from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { history } from "@milkdown/kit/plugin/history";
import {
  codeBlockSchema,
  commonmark,
  createCodeBlockCommand,
  imageSchema,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { gfm, insertTableCommand, toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { NodeView } from "@milkdown/kit/prose/view";
import { $prose, $remark, $view, callCommand } from "@milkdown/kit/utils";
import { classifyImage, type LinkContext } from "./links";
import { releaseMermaid, renderMermaid } from "./mermaid";
import { NearScreen, releaseDiagram, restoreDiagramHeight } from "./nearScreen";
import {
  applyEdit,
  blockEdit,
  dropNullImageFields,
  type MarkdownTreeNode,
  type PositionedTree,
  rangesAfterEdit,
  type SourceBlock,
  type SourceEdit,
  splitFrontMatter,
  topLevelRangesOf,
} from "./richSync";
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

const SYNC_DELAY_MS = 120;
const MERMAID_DELAY_MS = 400;

/** How written blocks are spelled; the common GitHub style. Untouched blocks keep their own. */
const STRINGIFY_OPTIONS = {
  bullet: "-",
  bulletOther: "*",
  emphasis: "*",
  strong: "*",
  fence: "`",
  rule: "-",
  listItemIndent: "one",
} as const;

export class RichMarkdownEditor {
  private editor: Editor | null = null;
  private source = "";
  private frontMatter = "";
  /** Block ranges in the body (the source after the front matter). */
  private ranges: SourceBlock[] = [];
  /** Each top-level node of the editor's document as the serializer writes it. */
  private blocks: string[] = [];
  /**
   * Each top-level node as written, by node: ProseMirror keeps the nodes an edit did not touch,
   * so a sync writes only the edited blocks again (all of them took 30 ms or more in a big file).
   */
  private readonly written = new WeakMap<ProseNode, string>();
  /** The block ranges of the latest text the editor's parser read (loading or pasting). */
  private parsed: { text: string; ranges: SourceBlock[] } | null = null;
  private loadingSource = false;
  private syncTimer: ReturnType<typeof setTimeout> | undefined;
  private editable = true;
  /** Diagrams draw only near the visible part of the editor's scroller. */
  private nearScreen: NearScreen | null = null;

  private constructor(private readonly options: RichEditorOptions) {}

  static async create(root: HTMLElement, options: RichEditorOptions): Promise<RichMarkdownEditor> {
    const instance = new RichMarkdownEditor(options);
    await instance.start(root);
    return instance;
  }

  private async start(root: HTMLElement): Promise<void> {
    // The scroller is the editor root's parent (RichMarkdownView).
    this.nearScreen = new NearScreen(root.parentElement);
    const watcher = $prose(
      () =>
        new Plugin({
          key: new PluginKey("gm-source-sync"),
          view: () => ({
            update: (view, previous) => {
              if (!this.loadingSource && !view.state.doc.eq(previous.doc)) {
                this.scheduleSync();
              }
            },
          }),
        }),
    );
    // Runs first on every parse (loading, pasting), before other plugins change the tree, so
    // loading needs no second parse for the block ranges.
    const blockRanges = $remark("gmBlockRanges", () => () => (tree, file) => {
      this.parsed = { text: String(file.value), ranges: topLevelRangesOf(tree as PositionedTree) };
    });
    // Runs on every parse before the tree becomes editor nodes.
    const imageDefaults = $remark("gmImageDefaults", () => () => (tree) => {
      dropNullImageFields(tree as unknown as MarkdownTreeNode);
    });
    const imageView = $view(imageSchema.node, () => (node) => this.imageView(node));
    const codeView = $view(codeBlockSchema.node, () => (node) => this.codeView(node));
    this.editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.update(remarkStringifyOptionsCtx, (previous) => ({ ...previous, ...STRINGIFY_OPTIONS }));
        ctx.update(editorViewOptionsCtx, (previous) => ({ ...previous, editable: () => this.editable }));
      })
      .use(blockRanges)
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(imageDefaults)
      .use(watcher)
      .use(imageView)
      .use(codeView)
      .create();
    this.load(this.options.source);
  }

  /** The source changed elsewhere (the text editor, Revert, a reload): show it. */
  setSource(source: string): void {
    if (source === this.source) {
      return;
    }
    clearTimeout(this.syncTimer);
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

  focus(): void {
    this.withCtx((ctx) => ctx.get(editorViewCtx).focus());
  }

  destroy(): void {
    clearTimeout(this.syncTimer);
    this.nearScreen?.disconnect();
    this.nearScreen = null;
    releaseMermaid(this);
    void this.editor?.destroy();
    this.editor = null;
  }

  run(action: RichAction): void {
    const editor = this.editor;
    if (!editor || !this.editable) {
      return;
    }
    const commands: Record<RichAction, () => (ctx: Ctx) => boolean> = {
      bold: () => callCommand(toggleStrongCommand.key),
      italic: () => callCommand(toggleEmphasisCommand.key),
      strikethrough: () => callCommand(toggleStrikethroughCommand.key),
      code: () => callCommand(toggleInlineCodeCommand.key),
      bullet: () => callCommand(wrapInBulletListCommand.key),
      ordered: () => callCommand(wrapInOrderedListCommand.key),
      task: () => (ctx) => callCommand(wrapInBulletListCommand.key)(ctx) && this.markTask(ctx),
      quote: () => callCommand(wrapInBlockquoteCommand.key),
      codeBlock: () => callCommand(createCodeBlockCommand.key),
      table: () => callCommand(insertTableCommand.key, { row: 3, col: 3 }),
      heading1: () => callCommand(wrapInHeadingCommand.key, 1),
      heading2: () => callCommand(wrapInHeadingCommand.key, 2),
      heading3: () => callCommand(wrapInHeadingCommand.key, 3),
      paragraph: () => callCommand(turnIntoTextCommand.key),
    };
    editor.action(commands[action]());
    this.focus();
  }

  /** Adds a link to the selected text, or removes the link it is in. */
  toggleLink(href: string): void {
    this.editor?.action(callCommand(toggleLinkCommand.key, { href }));
    this.focus();
  }

  /** Ticks or clears a task item; `element` is its list item. */
  toggleTask(element: Element): void {
    this.withCtx((ctx) => {
      const view = ctx.get(editorViewCtx);
      let position: number;
      try {
        position = view.posAtDOM(element, 0);
      } catch {
        return;
      }
      const resolved = view.state.doc.resolve(position);
      for (let depth = resolved.depth; depth > 0; depth--) {
        const node = resolved.node(depth);
        if (node.type.name === "list_item" && node.attrs.checked !== null && node.attrs.checked !== undefined) {
          const at = resolved.before(depth);
          view.dispatch(view.state.tr.setNodeMarkup(at, undefined, { ...node.attrs, checked: !node.attrs.checked }));
          return;
        }
      }
    });
  }

  private markTask(ctx: Ctx): boolean {
    const view = ctx.get(editorViewCtx);
    const resolved = view.state.selection.$from;
    for (let depth = resolved.depth; depth > 0; depth--) {
      const node = resolved.node(depth);
      if (node.type.name === "list_item") {
        view.dispatch(view.state.tr.setNodeMarkup(resolved.before(depth), undefined, { ...node.attrs, checked: false }));
        return true;
      }
    }
    return false;
  }

  private withCtx(work: (ctx: Ctx) => void): void {
    this.editor?.action(work);
  }

  private load(source: string): void {
    this.source = source;
    const { frontMatter, body } = splitFrontMatter(source);
    this.frontMatter = frontMatter;
    this.withCtx((ctx) => {
      const view = ctx.get(editorViewCtx);
      let doc: ProseNode;
      try {
        doc = ctx.get(parserCtx)(body);
      } catch (error) {
        this.setReadOnly(`This Markdown could not be read for rich editing: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      this.loadingSource = true;
      try {
        // Not undoable here: the change came from the text, which has its own history.
        view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content).setMeta("addToHistory", false));
      } finally {
        this.loadingSource = false;
      }
      this.realign(ctx, body);
    });
  }

  /** Block ranges of the body and the editor's own blocks; they must line up to write back. */
  private realign(ctx: Ctx, body: string): void {
    const parsed = this.parsed;
    this.parsed = null;
    this.ranges = parsed && parsed.text === body ? parsed.ranges : topLevelRanges(ctx, body);
    this.blocks = serializeBlocks(ctx, ctx.get(editorViewCtx).state.doc, this.written);
    if (this.ranges.length !== this.blocks.length) {
      this.setReadOnly("This file uses Markdown the rich editor cannot keep exactly. Edit it in the text editor.");
    } else if (!this.editable) {
      this.editable = true;
      ctx.get(editorViewCtx).setProps({});
    }
  }

  private setReadOnly(reason: string): void {
    this.editable = false;
    this.withCtx((ctx) => ctx.get(editorViewCtx).setProps({}));
    this.options.onReadOnly(reason);
  }

  private scheduleSync(): void {
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = undefined;
      this.sync();
    }, SYNC_DELAY_MS);
  }

  private sync(): void {
    this.withCtx((ctx) => {
      if (!this.editable) {
        return;
      }
      const next = serializeBlocks(ctx, ctx.get(editorViewCtx).state.doc, this.written);
      const body = this.source.slice(this.frontMatter.length);
      const edit = blockEdit(body, this.ranges, this.blocks, next);
      if (!edit) {
        return;
      }
      const newBody = applyEdit(body, edit);
      this.source = this.frontMatter + newBody;
      this.options.onEdit({ from: edit.from + this.frontMatter.length, to: edit.to + this.frontMatter.length, insert: edit.insert });
      this.ranges = rangesAfterEdit(newBody, this.ranges, edit, (text) => topLevelRanges(ctx, text)) ?? topLevelRanges(ctx, newBody);
      this.blocks = next;
      if (this.ranges.length !== this.blocks.length) {
        // A written block reads back as more (or fewer) blocks: start again from the text.
        this.load(this.source);
      }
    });
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

/** Where each top-level block of `body` is, from the same remark parser the editor uses. */
function topLevelRanges(ctx: Ctx, body: string): SourceBlock[] {
  return topLevelRangesOf(ctx.get(remarkCtx).parse(body) as PositionedTree);
}

/**
 * Each top-level node written on its own, as it would appear in the file. Empty paragraphs
 * write nothing and are not blocks of the text either (an empty file still has one). `written`
 * keeps what each node gave, as a node never changes.
 */
function serializeBlocks(ctx: Ctx, doc: ProseNode, written: WeakMap<ProseNode, string>): string[] {
  const serializer = ctx.get(serializerCtx);
  const schema = ctx.get(schemaCtx);
  const blocks: string[] = [];
  doc.forEach((node) => {
    let text = written.get(node);
    if (text === undefined) {
      text = serializer(schema.topNodeType.create(null, node)).replace(/\n+$/, "");
      written.set(node, text);
    }
    if (text !== "") {
      blocks.push(text);
    }
  });
  return blocks;
}
