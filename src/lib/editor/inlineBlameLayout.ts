// Where the current-line blame note goes, like GitLens and Zed: right after the end of the
// cursor line's last visual row. It is drawn in its own layer, so it never takes room in the
// text: lines never wrap or move because of it.
// - Word wrap off: the note always follows the code, past the visible edge on a long line
//   (scroll right to read it), never hidden.
// - Word wrap on: there is no scrolling sideways, so a note that does not fit on the last row
//   is cut short with an ellipsis; it keeps a small minimum so it never just disappears.

/** The gap between the end of the code and the note, like GitLens. */
export const NOTE_GAP = 36;
/** With word wrap on, the note keeps at least this width, even when part of it is cut off. */
export const MIN_NOTE_WIDTH = 72;
/** Space kept free at the right edge of the editor. */
const RIGHT_MARGIN = 12;

export interface LineEndBox {
  /** The right edge of the line's last visual row, in layer coordinates. */
  right: number;
  top: number;
  bottom: number;
}

export interface NotePlacement {
  left: number;
  top: number;
  height: number;
  /** null: no limit, the note runs past the edge (word wrap off). */
  maxWidth: number | null;
}

/** The note's box beside the line end. */
export function placeNote(lineEnd: LineEndBox, visibleRight: number, lineWrapping: boolean): NotePlacement {
  const left = lineEnd.right + NOTE_GAP;
  const top = lineEnd.top;
  const height = Math.max(0, lineEnd.bottom - lineEnd.top);
  if (!lineWrapping) {
    return { left, top, height, maxWidth: null };
  }
  return { left, top, height, maxWidth: Math.max(MIN_NOTE_WIDTH, visibleRight - RIGHT_MARGIN - left) };
}
