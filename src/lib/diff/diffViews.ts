// The editors of a diff, built into a DiffFrame's body: one EditorView for the inline layout (inlineDoc.ts) or a
// MergeView side by side with the stage or unstage arrows between the sides.
import type { Chunk } from "@codemirror/merge";
import { MergeView } from "@codemirror/merge";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { ChangeMark } from "$lib/editor/lineDiff";
import type { DiffBuild } from "./diffEditors.svelte";
import { splitFolds } from "./foldField";
import { hunkDiff, hunkRanges, SCAN_LIMIT } from "./hunkDiff";
import { applyBlock, buildInlineDoc, fallbackHunks, type InlineDoc } from "./inlineDoc";
import { inlineDiffExtensions } from "./inlineView";
import type { DiffSide } from "./lineSelection";
import { revertButton } from "./mergeExtensions";

/** A side's extensions: with `changes`, its revert listener; its find bar goes into `findHost`. */
export type SideExtensions = (
  changes: boolean,
  findHost: HTMLElement,
  side: DiffSide,
  numbered?: boolean,
) => Extension[];

export function inlineEditor(
  request: DiffBuild,
  sideExtensions: SideExtensions,
  blameExtensions: Extension,
): { editor: EditorView; doc: InlineDoc } {
  const { diff: fileDiff, mode } = request;
  // Hunks that do not fit the texts (or an older payload without them) are found again here.
  const fits = fileDiff.hunks && hunkRanges(fileDiff.original, fileDiff.modified, fileDiff.hunks) !== null;
  const hunks = fits && fileDiff.hunks ? fileDiff.hunks : fallbackHunks(fileDiff.original, fileDiff.modified);
  const doc = buildInlineDoc(fileDiff.original, fileDiff.modified, hunks);
  const control = mode === "unstaged" ? "stage" : mode === "staged" ? "unstage" : null;
  const editor = new EditorView({
    doc: doc.text,
    parent: request.parts.body,
    extensions: [
      sideExtensions(false, request.parts.findModified, "new", false),
      blameExtensions,
      inlineDiffExtensions({
        doc,
        collapse: request.collapse,
        control,
        onControl: (block) => {
          if (control) {
            const next = applyBlock(fileDiff.original, fileDiff.modified, block, control);
            request.onChange?.(next.target, next.text);
          }
        },
      }),
    ],
  });
  return { editor, doc };
}

export function splitEditors(
  request: DiffBuild,
  sideExtensions: SideExtensions,
  blameExtensions: Extension,
): MergeView {
  const { diff: fileDiff, mode, parts } = request;
  // The backend's line hunks, refined to characters inside each one; without them (an older payload) CodeMirror
  // diffs the whole texts itself.
  const diffConfig = fileDiff.hunks
    ? { scanLimit: SCAN_LIMIT, override: hunkDiff(fileDiff.original, fileDiff.modified, fileDiff.hunks) }
    : { scanLimit: SCAN_LIMIT };
  const folds = request.collapse ? splitFolds() : [];
  return new MergeView({
    a: { doc: fileDiff.original, extensions: [sideExtensions(mode === "unstaged", parts.findOriginal, "old"), folds] },
    b: {
      doc: fileDiff.modified,
      extensions: [sideExtensions(mode === "staged", parts.findModified, "new"), blameExtensions, folds],
    },
    parent: parts.body,
    diffConfig,
    gutter: true,
    highlightChanges: true,
    revertControls: mode === "unstaged" ? "b-to-a" : mode === "staged" ? "a-to-b" : undefined,
    renderRevertControl:
      mode === "unstaged"
        ? () => revertButton("Stage this change", "chevrons-left")
        : () => revertButton("Unstage this change", "chevrons-right"),
  });
}

/** Change marks in the new text's line numbers, for the overview ruler. */
export function diffMarks(editor: EditorView, chunks: readonly Chunk[]): ChangeMark[] {
  const doc = editor.state.doc;
  return chunks.map((chunk) => {
    const from = doc.lineAt(Math.min(chunk.fromB, doc.length)).number - 1;
    if (chunk.fromB === chunk.toB) {
      return { from, to: from, kind: "deleted" };
    }
    const last = doc.lineAt(Math.max(chunk.fromB, Math.min(chunk.toB - 1, doc.length))).number;
    return { from, to: last, kind: chunk.fromA === chunk.toA ? "added" : "modified" };
  });
}
