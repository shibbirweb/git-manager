// The minimap without the DOM: which lines it draws, where its slider sits, where a click
// or a drag scrolls to, and the colored runs of one line. minimap.ts draws them on a canvas.
// Everything is in lines (not pixels of the editor), so folds and wrapping only shift it a little.

/** Pixels of minimap per document line (blocks, not characters). */
export const MINIMAP_ROW = 2;

/** Pixels of minimap per character. */
export const MINIMAP_CHAR = 0.6;

/** Width of the minimap in CSS pixels. */
export const MINIMAP_WIDTH = 72;

export interface MinimapInput {
  lineCount: number;
  /** 0-based line at the top of the editor, with a fraction for a half-scrolled line. */
  topLine: number;
  /** Lines that fit on the editor's screen. */
  visibleLines: number;
  /** Height of the minimap in CSS pixels. */
  height: number;
  row?: number;
}

export interface MinimapLayout {
  /** First 0-based line drawn and the number of lines drawn. */
  firstLine: number;
  lineCount: number;
  /** Pixels the drawn lines are shifted up, so the first one may be cut. */
  offset: number;
  sliderTop: number;
  sliderHeight: number;
  /** Pixels of the whole document in the minimap. */
  documentHeight: number;
}

/**
 * Lays the minimap out. A file that fits is drawn whole from the top; a longer one scrolls
 * with the editor so the top of the file is at the top and the end at the end.
 */
export function minimapLayout({ lineCount, topLine, visibleLines, height, row = MINIMAP_ROW }: MinimapInput): MinimapLayout {
  const lines = Math.max(1, lineCount);
  const documentHeight = lines * row;
  const maxTop = Math.max(0, lines - visibleLines);
  const top = Math.min(Math.max(0, topLine), maxTop);
  const scrolled = documentHeight > height && maxTop > 0 ? (top / maxTop) * (documentHeight - height) : 0;
  const firstLine = Math.floor(scrolled / row);
  return {
    firstLine,
    lineCount: Math.min(lines - firstLine, Math.ceil(height / row) + 1),
    offset: scrolled - firstLine * row,
    sliderTop: top * row - scrolled,
    sliderHeight: Math.max(row * 2, Math.min(visibleLines, lines) * row),
    documentHeight,
  };
}

/** The 0-based line under a point of the minimap. */
export function lineAtMinimapY(layout: MinimapLayout, y: number, lineCount: number, row = MINIMAP_ROW): number {
  const line = Math.floor((y + layout.firstLine * row + layout.offset) / row);
  return Math.min(Math.max(0, line), Math.max(0, lineCount - 1));
}

/** The top line a click puts on screen: the clicked line in the middle. */
export function topLineForClick(layout: MinimapLayout, y: number, lineCount: number, visibleLines: number, row = MINIMAP_ROW): number {
  const line = lineAtMinimapY(layout, y, lineCount, row);
  return Math.min(Math.max(0, line - Math.floor(visibleLines / 2)), Math.max(0, lineCount - visibleLines));
}

/**
 * The top line while the slider is dragged `deltaY` pixels from where the drag started at
 * `startTopLine`. In a long file the slider runs over the minimap's height, not the file's.
 */
export function topLineForDrag(
  startTopLine: number,
  deltaY: number,
  lineCount: number,
  visibleLines: number,
  height: number,
  row = MINIMAP_ROW,
): number {
  const maxTop = Math.max(0, lineCount - visibleLines);
  if (maxTop === 0) {
    return 0;
  }
  const sliderHeight = Math.max(row * 2, Math.min(visibleLines, lineCount) * row);
  const track = Math.min(lineCount * row, height) - sliderHeight;
  const linesPerPixel = track > 0 ? maxTop / track : 1 / row;
  return Math.min(Math.max(0, startTopLine + deltaY * linesPerPixel), maxTop);
}

/** A styled stretch of a line, from the syntax highlighter: document positions and a class. */
export interface StyledRange {
  from: number;
  to: number;
  className: string;
}

/** A block to paint: start column, length in columns and the class whose color it takes ("" for plain text). */
export interface MinimapRun {
  column: number;
  length: number;
  className: string;
}

/**
 * Paint runs of a line that starts at `lineFrom`: each stretch of non-space characters with
 * one style, tabs expanded, cut at `maxColumns`. `styles` are sorted and may cover other lines.
 */
export function lineRuns(text: string, lineFrom: number, styles: readonly StyledRange[], tabSize: number, maxColumns: number): MinimapRun[] {
  const runs: MinimapRun[] = [];
  let column = 0;
  let styleIndex = 0;
  let current: MinimapRun | null = null;
  for (let index = 0; index < text.length && column < maxColumns; index++) {
    const char = text[index];
    if (char === "\t") {
      current = null;
      column += tabSize - (column % tabSize);
      continue;
    }
    if (char === " ") {
      current = null;
      column++;
      continue;
    }
    const position = lineFrom + index;
    while (styleIndex < styles.length && styles[styleIndex].to <= position) {
      styleIndex++;
    }
    const style = styles[styleIndex];
    const className = style && style.from <= position ? style.className : "";
    if (current && current.className === className && current.column + current.length === column) {
      current.length++;
    } else {
      current = { column, length: 1, className };
      runs.push(current);
    }
    column++;
  }
  return runs;
}

/** Lines painted above and below the ones shown, so scrolling moves the canvas instead of painting it. */
export const PAINT_MARGIN = 100;

/** The lines a canvas holds: 0-based first line and count. */
export interface PaintWindow {
  firstLine: number;
  lineCount: number;
}

/** The painted lines still hold every line the layout shows. */
export function windowCovers(painted: PaintWindow | null, layout: MinimapLayout): boolean {
  return (
    painted !== null &&
    layout.firstLine >= painted.firstLine &&
    layout.firstLine + layout.lineCount <= painted.firstLine + painted.lineCount
  );
}

/** The lines to paint for a layout: the ones shown plus a margin each way. */
export function paintWindow(layout: MinimapLayout, totalLines: number, margin = PAINT_MARGIN): PaintWindow {
  const firstLine = Math.max(0, layout.firstLine - margin);
  const end = Math.min(Math.max(1, totalLines), layout.firstLine + layout.lineCount + margin);
  return { firstLine, lineCount: Math.max(0, end - firstLine) };
}

/** How far the painted canvas moves up so the layout's first line sits at the top. */
export function canvasShift(painted: PaintWindow, layout: MinimapLayout, row = MINIMAP_ROW): number {
  return (layout.firstLine - painted.firstLine) * row + layout.offset;
}
