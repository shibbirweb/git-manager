// Text cut into plain and matched parts, from match ranges [start, end) (quick open, search results). Ranges may
// overlap or come unsorted; they are merged and clipped to the text.

export interface TextPart {
  text: string;
  match: boolean;
}

export function mergeRanges(ranges: [number, number][], length: number): [number, number][] {
  const clipped = ranges
    .map(([start, end]) => [Math.max(0, start), Math.min(length, end)] as [number, number])
    .filter(([start, end]) => end > start)
    .sort((left, right) => left[0] - right[0]);
  const merged: [number, number][] = [];
  for (const range of clipped) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push([...range]);
    }
  }
  return merged;
}

export function highlightParts(text: string, ranges: [number, number][]): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const [start, end] of mergeRanges(ranges, text.length)) {
    if (start > at) {
      parts.push({ text: text.slice(at, start), match: false });
    }
    parts.push({ text: text.slice(start, end), match: true });
    at = end;
  }
  if (at < text.length || !parts.length) {
    parts.push({ text: text.slice(at), match: false });
  }
  return parts;
}
