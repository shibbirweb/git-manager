// Bracket pair colors without CodeMirror: which brackets of a range get which depth color.
// bracketColors.ts finds the brackets on screen with the syntax tree and draws them.

/** Depth colors, --bracket-1 to --bracket-3 in app.css, repeating. */
export const BRACKET_LEVELS = 3;

const OPENERS = "([{";
const CLOSERS = ")]}";

/** A bracket character at a document position. */
export interface BracketToken {
  from: number;
  char: string;
}

/** A bracket to color: its position and its color level (0-based), or -1 when nothing opened it. */
export interface ColoredBracket {
  from: number;
  level: number;
}

export function isOpenBracket(char: string): boolean {
  return char.length === 1 && OPENERS.includes(char);
}

export function isBracket(char: string): boolean {
  return char.length === 1 && (OPENERS.includes(char) || CLOSERS.includes(char));
}

/** Brackets in `text`, which starts at document position `offset`. */
export function bracketCandidates(text: string, offset: number): BracketToken[] {
  const tokens: BracketToken[] = [];
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (isBracket(char)) {
      tokens.push({ from: offset + index, char });
    }
  }
  return tokens;
}

/**
 * Colors `tokens` (in document order) by nesting depth, starting at `startDepth` brackets
 * already open before the first one. A pair shares its color; a closing bracket with
 * nothing open gets level -1 so it can be drawn as an error.
 */
export function colorBrackets(tokens: readonly BracketToken[], startDepth: number, levels = BRACKET_LEVELS): ColoredBracket[] {
  let depth = Math.max(0, startDepth);
  const colored: ColoredBracket[] = [];
  for (const token of tokens) {
    if (isOpenBracket(token.char)) {
      colored.push({ from: token.from, level: depth % levels });
      depth++;
      continue;
    }
    if (depth === 0) {
      colored.push({ from: token.from, level: -1 });
      continue;
    }
    depth--;
    colored.push({ from: token.from, level: depth % levels });
  }
  return colored;
}
