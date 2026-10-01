// Word-level diff used to highlight the exact changes inside a chunk.

export interface TextSpan {
  from: number;
  to: number;
}

const TOKEN = /\w+|\s+|[^\w\s]/gu;
/** Skip inline highlighting when the token product gets expensive. */
const MAX_CELLS = 400_000;

function tokenize(text: string): string[] {
  return text.match(TOKEN) ?? [];
}

/**
 * Returns the spans of `after` that differ from `before`, as character
 * offsets into `after`. Whitespace-only differences are not highlighted.
 * Returns null when the inputs are too large or too different to be useful.
 */
export function changedSpans(before: string, after: string): TextSpan[] | null {
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length === 0 || b.length === 0 || a.length * b.length > MAX_CELLS) {
    return null;
  }

  // LCS table over tokens, filled from the end so we can walk forward.
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  const spans: TextSpan[] = [];
  let offset = 0;
  let i = 0;
  let j = 0;
  let words = 0;
  let keptWords = 0;
  const push = (from: number, to: number) => {
    const last = spans[spans.length - 1];
    if (last && last.to === from) {
      last.to = to;
    } else {
      spans.push({ from, to });
    }
  };
  while (j < b.length) {
    const isWord = b[j].trim().length > 0;
    if (i < a.length && a[i] === b[j]) {
      if (isWord) {
        words++;
        keptWords++;
      }
      offset += b[j].length;
      i++;
      j++;
    } else if (i < a.length && table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      i++;
    } else {
      if (isWord) {
        words++;
        push(offset, offset + b[j].length);
      }
      offset += b[j].length;
      j++;
    }
  }
  // Mostly rewritten text reads better with the whole chunk colored.
  if (words > 0 && keptWords < words * 0.3) {
    return null;
  }
  return spans;
}
