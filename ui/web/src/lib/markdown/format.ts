// Markdown formatting commands for the editor toolbar: inline styles and links here, line formats (headings,
// lists, quotes, code blocks, tables, tasks) in formatLines.ts. Each returns one transaction spec, so it works on
// every cursor at once and is a single undo step. Applying a format that is already there removes it.

import { EditorSelection, type ChangeSpec, type EditorState, type TransactionSpec } from "@codemirror/state";

export type InlineStyle = "bold" | "italic" | "strikethrough" | "code";

export const USER_EVENT = "input.format";

interface MarkerRule {
  /** What a new wrap inserts on each side. */
  marker: string;
  /** Characters a wrap may already use. */
  chars: string[];
  /** A run of `lead` and `trail` marker characters means the style is applied. */
  applies: (lead: number, trail: number) => boolean;
  /** How many characters to remove on each side when it is. */
  strip: (lead: number, trail: number) => number;
}

const RULES: Record<InlineStyle, MarkerRule> = {
  bold: {
    marker: "**",
    chars: ["*", "_"],
    applies: (lead, trail) => lead >= 2 && trail >= 2,
    strip: () => 2,
  },
  // A single star, or three (bold and italic); two stars are bold only.
  italic: {
    marker: "*",
    chars: ["*", "_"],
    applies: (lead, trail) => (lead === 1 || lead === 3) && (trail === 1 || trail === 3),
    strip: () => 1,
  },
  strikethrough: {
    marker: "~~",
    chars: ["~"],
    applies: (lead, trail) => lead >= 2 && trail >= 2,
    strip: () => 2,
  },
  code: {
    marker: "`",
    chars: ["`"],
    applies: (lead, trail) => lead >= 1 && trail >= 1,
    strip: (lead, trail) => Math.min(lead, trail),
  },
};

function runAtStart(text: string, char: string): number {
  let count = 0;
  while (count < text.length && text[count] === char) {
    count++;
  }
  return count;
}

function runAtEnd(text: string, char: string): number {
  let count = 0;
  while (count < text.length && text[text.length - 1 - count] === char) {
    count++;
  }
  return count;
}

/** Characters to strip on each side when `text` itself starts and ends with the style's markers. */
function innerMarkers(text: string, rule: MarkerRule): number {
  for (const char of rule.chars) {
    const lead = runAtStart(text, char);
    const trail = runAtEnd(text, char);
    if (lead + trail <= text.length && rule.applies(lead, trail)) {
      return rule.strip(lead, trail);
    }
  }
  return 0;
}

/** Characters to strip on each side when the markers sit just outside `from`..`to`. */
function outerMarkers(state: EditorState, from: number, to: number, rule: MarkerRule): number {
  const line = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(to);
  const before = state.doc.sliceString(line.from, from);
  const after = state.doc.sliceString(to, endLine.to);
  for (const char of rule.chars) {
    const lead = runAtEnd(before, char);
    const trail = runAtStart(after, char);
    if (rule.applies(lead, trail)) {
      return rule.strip(lead, trail);
    }
  }
  return 0;
}

/** Bold, italic, strikethrough or inline code around each selection, or around the word at each cursor. */
export function toggleInline(state: EditorState, style: InlineStyle): TransactionSpec {
  const rule = RULES[style];
  const size = rule.marker.length;
  const spec = state.changeByRange((range) => {
    let from = range.from;
    let to = range.to;
    const word = range.empty ? state.wordAt(range.head) : null;
    if (word) {
      from = word.from;
      to = word.to;
    }
    // Where the cursor sits inside the word, kept across the change.
    const caretOffset = range.empty ? range.head - from : 0;
    const text = state.sliceDoc(from, to);
    const inner = text.length > 0 ? innerMarkers(text, rule) : 0;
    if (inner > 0) {
      const changes: ChangeSpec[] = [
        { from, to: from + inner },
        { from: to - inner, to },
      ];
      const end = to - inner * 2;
      return {
        changes,
        range: range.empty
          ? EditorSelection.cursor(Math.max(from, Math.min(end, range.head - inner)))
          : EditorSelection.range(from, end),
      };
    }
    const outer = outerMarkers(state, from, to, rule);
    if (outer > 0) {
      const changes: ChangeSpec[] = [
        { from: from - outer, to: from },
        { from: to, to: to + outer },
      ];
      const start = from - outer;
      return {
        changes,
        range: range.empty ? EditorSelection.cursor(start + caretOffset) : EditorSelection.range(start, to - outer),
      };
    }
    const changes: ChangeSpec[] = [
      { from, insert: rule.marker },
      { from: to, insert: rule.marker },
    ];
    return {
      changes,
      range: range.empty
        ? EditorSelection.cursor(from + size + caretOffset)
        : EditorSelection.range(from + size, to + size),
    };
  });
  return { ...spec, scrollIntoView: true, userEvent: USER_EVENT };
}

const LINK = /^\[([^\]]*)\]\(([^)]*)\)$/;
const URL_LIKE = /^(https?:\/\/|mailto:|www\.)\S+$/i;

/** Inserts a link at each cursor, makes each selection a link, or turns a selected link back into its text. */
export function toggleLink(state: EditorState): TransactionSpec {
  const spec = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to);
    const link = LINK.exec(text);
    if (link) {
      return {
        changes: { from: range.from, to: range.to, insert: link[1] },
        range: EditorSelection.range(range.from, range.from + link[1].length),
      };
    }
    if (range.empty) {
      return {
        changes: { from: range.from, insert: "[]()" },
        range: EditorSelection.cursor(range.from + 1),
      };
    }
    if (URL_LIKE.test(text)) {
      return {
        changes: { from: range.from, to: range.to, insert: `[](${text})` },
        range: EditorSelection.cursor(range.from + 1),
      };
    }
    return {
      changes: { from: range.from, to: range.to, insert: `[${text}]()` },
      range: EditorSelection.cursor(range.from + text.length + 3),
    };
  });
  return { ...spec, scrollIntoView: true, userEvent: USER_EVENT };
}
