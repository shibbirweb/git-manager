// Adapted from Orca (github.com/stablyai/orca), MIT License: see LICENSE-ORCA.
import { Editor } from "@tiptap/core";
import { encodeRawMarkdownHtmlForRichEditor } from "./raw-markdown-html";
import { createRichMarkdownExtensions } from "./rich-markdown-extensions";
import { createRichMarkdownEditorCodec } from "./rich-markdown-source-transport";
import { normalizeEmptyListItems } from "./rich-markdown-normalize";

/**
 * Re-serializes markdown through a throwaway editor that REPLICATES the mounted
 * editor's post-load state: same extension set and normalizeEmptyListItems.
 * Reconciliation's safety re-parse must match the live getMarkdown() output, or
 * docs with empty list items would spuriously mismatch and silently fall back to
 * canonical. Returns null if serialization throws.
 */
export function serializeRichMarkdownForReconcile(content: string): string | null {
  try {
    const codec = createRichMarkdownEditorCodec();
    const editor = new Editor({
      element: null,
      extensions: createRichMarkdownExtensions({ codec }),
      content: encodeRawMarkdownHtmlForRichEditor(content, codec),
      contentType: "markdown",
    });
    try {
      normalizeEmptyListItems(editor);
      return editor.getMarkdown();
    } finally {
      editor.destroy();
    }
  } catch {
    return null;
  }
}
