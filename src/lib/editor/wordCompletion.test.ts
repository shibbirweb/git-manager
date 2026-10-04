import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { MAX_WORDS, WINDOW_LINES, windowWords, wordPattern } from "./wordCompletion";

const words = wordPattern("");

describe("windowWords", () => {
  it("lists distinct words nearest to the cursor first", () => {
    const doc = Text.of(["far away", "near here", "cursor line", "below near"]);
    const pos = doc.line(3).to;
    expect(windowWords(doc, pos, words)).toEqual(["cursor", "line", "below", "near", "here", "far", "away"]);
  });

  it("skips the word being typed", () => {
    const doc = Text.of(["value valueOf", "val"]);
    const from = doc.line(2).from;
    expect(windowWords(doc, doc.line(2).to, words, from)).toEqual(["value", "valueOf"]);
  });

  it("reads only a window of lines around the cursor", () => {
    const lines = Array.from({ length: WINDOW_LINES * 3 }, () => "same");
    lines[0] = "faraway";
    lines[WINDOW_LINES * 3 - WINDOW_LINES] = "nearby";
    const doc = Text.of(lines);
    expect(windowWords(doc, doc.length, words, -1)).toEqual(["same", "nearby"]);
  });

  it("keeps a bounded list from the lines nearest the cursor", () => {
    const doc = Text.of(Array.from({ length: 2000 }, (_, index) => `alpha${index} beta${index}`));
    const found = windowWords(doc, doc.line(1).from, words, -1);
    expect(found).toHaveLength(MAX_WORDS);
    expect(found.slice(0, 3)).toEqual(["alpha0", "beta0", "alpha1"]);
  });

  it("honours a language's extra word characters", () => {
    const doc = Text.of(["$scope my-var"]);
    expect(windowWords(doc, doc.length, wordPattern("$-"), -1)).toEqual(["$scope", "my-var"]);
  });
});
