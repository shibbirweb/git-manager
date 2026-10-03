// Detect Indentation without CodeMirror: how a file indents, read from its own lines, like
// VS Code's editor.detectIndentation. indentation.ts applies the answer to the editor.

/** Lines read from the top of a file; enough to decide, and quick on huge files. */
export const MAX_DETECT_LINES = 10_000;

/** The largest step counted as one indent level; wider steps are alignment, not nesting. */
const MAX_INDENT_SIZE = 8;

export interface DetectedIndent {
  /** The file indents with tab characters (their width stays the Tab size setting). */
  useTabs: boolean;
  /** Spaces per indent level; null when the file indents with tabs. */
  size: number | null;
}

/**
 * Tabs when more lines start with a tab than with spaces; else the most common step by which
 * the indentation grows from one line to the next (ties go to the smaller step). Blank lines,
 * one-space steps (comment stars, alignment) and lines mixing tabs and spaces are skipped.
 * Null when the file shows no indentation to follow.
 */
export function detectIndentation(lines: Iterable<string>, maxLines = MAX_DETECT_LINES): DetectedIndent | null {
  let tabLines = 0;
  let spaceLines = 0;
  const steps = new Map<number, number>();
  // Spaces before the previous line with code; null after a tab-indented or mixed line.
  let previous: number | null = 0;
  let read = 0;
  for (const line of lines) {
    if (read++ >= maxLines) {
      break;
    }
    let spaces = 0;
    let tabs = 0;
    let index = 0;
    for (; index < line.length; index++) {
      const char = line[index];
      if (char === " ") {
        spaces++;
      } else if (char === "\t") {
        tabs++;
      } else {
        break;
      }
    }
    if (index === line.length) {
      continue;
    }
    if (tabs > 0) {
      if (line[0] === "\t" && spaces === 0) {
        tabLines++;
      }
      previous = null;
      continue;
    }
    if (spaces > 0) {
      spaceLines++;
    }
    if (previous !== null) {
      const step = spaces - previous;
      if (step >= 2 && step <= MAX_INDENT_SIZE) {
        steps.set(step, (steps.get(step) ?? 0) + 1);
      }
    }
    previous = spaces;
  }
  if (tabLines === 0 && spaceLines === 0) {
    return null;
  }
  if (tabLines > spaceLines) {
    return { useTabs: true, size: null };
  }
  let size: number | null = null;
  let best = 0;
  for (const [step, count] of [...steps.entries()].sort(([a], [b]) => a - b)) {
    if (count > best) {
      size = step;
      best = count;
    }
  }
  return size === null ? null : { useTabs: false, size };
}
