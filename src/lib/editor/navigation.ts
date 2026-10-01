// Next / previous navigation between marked sections (changes, conflicts).

import type { ChangeMark } from "./lineDiff";

/** Index of the section containing `line` (0-based), or -1. Deletions count as one line. */
export function sectionAt(marks: readonly ChangeMark[], line: number): number {
  for (let index = 0; index < marks.length; index++) {
    const mark = marks[index];
    if (line >= mark.from && line < Math.max(mark.to, mark.from + 1)) {
      return index;
    }
    if (mark.from > line) {
      break;
    }
  }
  return -1;
}

/**
 * The section to jump to from `line`, wrapping around the file. `marks` must
 * be sorted by `from`. Previous always moves off the section the cursor is in.
 */
export function sectionTarget(marks: readonly ChangeMark[], line: number, direction: 1 | -1): ChangeMark | null {
  if (marks.length === 0) {
    return null;
  }
  if (direction === 1) {
    return marks.find((mark) => mark.from > line) ?? marks[0];
  }
  const inside = sectionAt(marks, line);
  if (inside >= 0) {
    return marks[(inside - 1 + marks.length) % marks.length];
  }
  let previous: ChangeMark | null = null;
  for (const mark of marks) {
    if (mark.from < line) {
      previous = mark;
    }
  }
  return previous ?? marks[marks.length - 1];
}
