// Blame in the three-pane diff, like the two-pane diff's Blame button: one pane shows who wrote each line, the work
// tree in the staging view and the merge result for a merge commit.

import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { type BlameTarget, blameExtension, loadBlame } from "$lib/editor/blame";
import { settings } from "$lib/stores/settings.svelte";
import type { Eol, FileDiff } from "$lib/types";

export type ThreeWayPane = "left" | "result" | "right";

export interface ThreeWayBlame {
  target: BlameTarget;
  /** The pane whose text the target describes. */
  pane: ThreeWayPane;
}

/** The blame field and display for the blamed pane, nothing for the others. */
export function paneBlame(name: ThreeWayPane, blame: ThreeWayBlame | null): Extension {
  return blame?.pane === name
    ? blameExtension({ inline: settings.currentLineBlame, gutter: settings.blameGutter })
    : [];
}

/** A pane's line ending: each side pane is a diff's original, the middle is their modified text. */
export function paneEol(name: ThreeWayPane, left: FileDiff, right: FileDiff): Eol {
  if (name === "result") {
    return left.modifiedEol;
  }
  return name === "left" ? left.originalEol : right.originalEol;
}

/** Loads the blame into its pane once the panes exist, and returns that pane. */
export function startBlame(
  views: Record<ThreeWayPane, EditorView>,
  blame: ThreeWayBlame | null,
  left: FileDiff,
  right: FileDiff,
): EditorView | null {
  if (!blame) {
    return null;
  }
  void loadBlame(views[blame.pane], blame.target, paneEol(blame.pane, left, right));
  return views[blame.pane];
}
