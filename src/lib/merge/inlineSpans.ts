// Word-level highlights of the merge tool's read-only sides: what a chunk changed against the base (or, with no
// base text, against the other side of a conflict). The sides never change, so each chunk's spans are worked out
// once. The side texts are read from their editors' documents, so each text is held once more at most.
import type { Text } from "@codemirror/state";
import { changedSpans, type TextSpan } from "./inline";
import { type ChunkState, lineStarts, rangeOfString, rangeText, type SideName, sideRange } from "./model";

export class InlineSpans {
  sides: { ours: Text; theirs: Text } | null = null;
  readonly #baseStarts: Uint32Array;
  readonly #cache = new Map<string, TextSpan[] | null>();

  constructor(private readonly base: string) {
    this.#baseStarts = lineStarts(base);
  }

  of(chunk: ChunkState, side: SideName): TextSpan[] | null {
    const key = `${side}:${chunk.id}`;
    if (this.#cache.has(key)) {
      return this.#cache.get(key) ?? null;
    }
    const sides = this.sides;
    if (!sides) {
      return null;
    }
    const range = sideRange(chunk, side);
    const other: SideName = side === "ours" ? "theirs" : "ours";
    const otherRange = sideRange(chunk, other);
    let reference: string | null = null;
    if (chunk.base.start < chunk.base.end) {
      reference = rangeOfString(this.base, this.#baseStarts, chunk.base);
    } else if (chunk.kind === "conflict" && otherRange.start < otherRange.end) {
      reference = rangeText(sides[other], otherRange);
    }
    const spans =
      range.start < range.end && reference !== null ? changedSpans(reference, rangeText(sides[side], range)) : null;
    this.#cache.set(key, spans);
    return spans;
  }
}
