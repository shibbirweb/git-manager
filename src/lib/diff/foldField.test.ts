// @vitest-environment happy-dom
import { MergeView } from "@codemirror/merge";
import { afterEach, describe, expect, it } from "vitest";
import { foldedLines, splitFolds } from "./foldField";

const lines = (count: number, prefix: string) => Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`);

describe("side by side folds", () => {
  let view: MergeView | null = null;
  afterEach(() => {
    view?.destroy();
    view = null;
  });

  it("folds the unchanged lines around a change on both sides", () => {
    // 40 lines with line 20 changed: the runs before and after it fold, a few lines of context stay.
    const original = lines(40, "line");
    const modified = original.slice();
    modified[19] = "changed 20";
    view = new MergeView({
      a: { doc: original.join("\n"), extensions: [splitFolds()] },
      b: { doc: modified.join("\n"), extensions: [splitFolds()] },
      parent: document.body,
    });
    const left = foldedLines(view.a.state);
    const right = foldedLines(view.b.state);
    expect(left.length).toBe(2);
    expect(right).toEqual(left);
    expect(left[0].first).toBe(1);
    expect(left[1].last).toBe(40);
    for (const range of left) {
      expect(range.first > 20 || range.last < 20).toBe(true);
    }
  });
});
