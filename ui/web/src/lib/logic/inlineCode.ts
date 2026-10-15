// Plain text with `backtick` code words, split into parts so a component can draw the code words in the mono font
// (a setting's hint such as "Add `--signoff` to every commit").

export interface InlinePart {
  text: string;
  code: boolean;
}

export function inlineCodeParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pieces = text.split("`");
  // An odd number of backticks leaves the last one as plain text.
  const closed = pieces.length % 2 === 1 ? pieces.length : pieces.length - 1;
  pieces.forEach((piece, index) => {
    const code = index % 2 === 1 && index < closed;
    const value = index >= closed ? `\`${piece}` : piece;
    if (value !== "") {
      parts.push({ text: value, code });
    }
  });
  return parts;
}
