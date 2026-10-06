// The smallest edit that turns the text on screen into the text on disk, so a file another
// app changed (a log growing at the end) reloads without moving the caret or the scroll.

export interface ReloadChange {
  from: number;
  to: number;
  insert: string;
}

/** Null when nothing changed; else the range of `previous` to replace and its new text. */
export function reloadChange(previous: string, next: string): ReloadChange | null {
  if (previous === next) {
    return null;
  }
  const shorter = Math.min(previous.length, next.length);
  let start = 0;
  while (start < shorter && previous.charCodeAt(start) === next.charCodeAt(start)) {
    start++;
  }
  let end = 0;
  while (end < shorter - start && previous.charCodeAt(previous.length - 1 - end) === next.charCodeAt(next.length - 1 - end)) {
    end++;
  }
  return { from: start, to: previous.length - end, insert: next.slice(start, next.length - end) };
}
