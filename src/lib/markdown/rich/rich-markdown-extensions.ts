// Adapted from Orca (github.com/stablyai/orca, MIT, see LICENSE-ORCA): the rich Markdown editor's schema, the same
// for the editor on screen and for the throwaway editors that check a file's round trip and reconcile its edits.
// Left out from Orca: math, editable details blocks, wiki-style document links, superscript links, review
// annotations and lowlight code colors. The editor on screen passes its own node views for images and code blocks
// (local images, mermaid diagrams); node views never change the Markdown.

import type { AnyExtension, NodeViewRenderer } from "@tiptap/core";
import { Code } from "@tiptap/extension-code";
import { CodeBlock } from "@tiptap/extension-code-block";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import StarterKit from "@tiptap/starter-kit";
import {
  createRawMarkdownHtmlBlock,
  createRawMarkdownHtmlInline,
  createRichMarkdownLiteral,
} from "./raw-markdown-html-nodes";
import { createRichMarkdownExtension } from "./rich-markdown-extension";
import { RichMarkdownOrderedList } from "./rich-markdown-ordered-list";
import { RichMarkdownParagraph } from "./rich-markdown-paragraph";
import type { RichMarkdownEditorCodec } from "./rich-markdown-source-transport";
import { RichMarkdownTable } from "./rich-markdown-table";
import { RichMarkdownTaskList } from "./rich-markdown-task-list";
import { RichMarkdownTrailingParagraph } from "./rich-markdown-trailing-paragraph";

const RichMarkdownCode = Code.extend({
  // Why: Markdown supports linked code labels, so code cannot exclude the link
  // mark even though it should still stay exclusive with emphasis marks.
  excludes: "code bold italic strike underline",
});

/** Node views of the editor on screen; the round-trip editors use none. */
export interface RichMarkdownNodeViews {
  image?: NodeViewRenderer;
  codeBlock?: NodeViewRenderer;
}

export function createRichMarkdownExtensions({
  codec,
  nodeViews = {},
}: {
  codec: RichMarkdownEditorCodec;
  nodeViews?: RichMarkdownNodeViews;
}): AnyExtension[] {
  return [
    // Why: rich-mode detection must use the exact same markdown extension set as
    // the live editor. If these drift, a document can be claimed editable and
    // then still lose syntax on save.
    StarterKit.configure({
      link: false,
      code: false,
      codeBlock: false,
      orderedList: false,
      paragraph: false,
      trailingNode: false,
    }),
    RichMarkdownParagraph,
    RichMarkdownTrailingParagraph,
    RichMarkdownCode,
    CodeBlock.extend({
      addNodeView() {
        return nodeViews.codeBlock ?? null;
      },
    }).configure({ defaultLanguage: null }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
    }),
    Image.extend({
      addNodeView() {
        return nodeViews.image ?? null;
      },
    }).configure({
      allowBase64: true,
      // Why: the markdown parser nests images inside paragraphs, so a block image
      // node yields a schema-invalid document that only throws on the first edit
      // that reassembles the paragraph.
      inline: true,
    }),
    RichMarkdownOrderedList,
    RichMarkdownTaskList,
    TaskItem.configure({ nested: true }),
    RichMarkdownTable.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    createRichMarkdownLiteral(codec.transport),
    createRawMarkdownHtmlInline(codec.transport),
    createRawMarkdownHtmlBlock(codec.transport),
    createRichMarkdownExtension(codec).configure({
      marked: codec.marked,
      markedOptions: { gfm: true },
    }),
  ];
}
