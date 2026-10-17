// The side by side diff's gutters, drawn like the merge tool's: the old side's line numbers on its right edge and the
// new side's on its left, so both face the connector; each change colored through the numbers (red old, green new);
// and the band's buttons (stage, unstage, apply, revert) beside the numbers of their side, never over them.
import type { Extension } from "@codemirror/state";
import { type ChunkActions, chunkActionGutter, sideLineNumbers } from "@nibtree/ui/editor/mergeGutters";
import { mergeGutterTheme } from "@nibtree/ui/editor/mergeGutterTheme";
import { splitChunks, type SplitSide, splitGutterColors } from "@nibtree/ui/editor/splitGutters";
import { noVerticalScrollbar } from "$lib/merge/extensions";

/** One side's gutters; `actions` puts the band's buttons on this side. */
export function splitGutters(side: SplitSide, actions: ChunkActions | null): Extension {
  const gutterSide = side === "a" ? "after" : "before";
  const buttons = actions ? chunkActionGutter(gutterSide, actions, (state) => splitChunks(state, side)) : [];
  // The old side's buttons sit between its text and its numbers, the new side's between its numbers and its text.
  return side === "a"
    ? [splitGutterColors(side), buttons, sideLineNumbers("after"), noVerticalScrollbar, mergeGutterTheme]
    : [splitGutterColors(side), sideLineNumbers("before"), buttons, mergeGutterTheme];
}
