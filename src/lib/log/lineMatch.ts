// Finds a line of a commit's version of a file, e.g. the one a blame note was
// clicked on, when only an approximate line number is known.

/**
 * The 0-based line of `text` to reveal: the line reading `lineText` nearest
 * to `hintLine` (earlier lines win a tie, as code is usually added above
 * later on), or `hintLine` itself when no line matches or no text is given.
 */
export function findLine(text: string, hintLine: number, lineText: string | null): number {
  const lines = text.split("\n");
  const hint = Math.max(0, Math.min(Math.floor(hintLine), lines.length - 1));
  if (lineText === null) {
    return hint;
  }
  const wanted = lineText.replace(/\r$/, "");
  const matches = (index: number) => (lines[index] ?? "").replace(/\r$/, "") === wanted;
  for (let distance = 0; distance < lines.length; distance++) {
    if (hint - distance >= 0 && matches(hint - distance)) {
      return hint - distance;
    }
    if (distance > 0 && hint + distance < lines.length && matches(hint + distance)) {
      return hint + distance;
    }
  }
  return hint;
}
