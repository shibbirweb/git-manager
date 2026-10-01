import { defaultKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { applyKeymap } from "./extensions";

function modEnterBindings(state: EditorState) {
  return state
    .facet(keymap)
    .flat()
    .filter((binding) => binding.key === "Mod-Enter");
}

describe("applyKeymap", () => {
  it("outranks the default Mod-Enter even when added first or last", () => {
    let applied = 0;
    const onApply = () => {
      applied++;
    };
    for (const extensions of [
      [applyKeymap(onApply), keymap.of(defaultKeymap)],
      [keymap.of(defaultKeymap), applyKeymap(onApply)],
    ]) {
      const bindings = modEnterBindings(EditorState.create({ extensions }));
      expect(bindings).toHaveLength(2);
      // The first binding in facet order is the one CodeMirror runs first.
      expect(bindings[0].run?.({} as EditorView)).toBe(true);
    }
    expect(applied).toBe(2);
  });

  it("also works from the search bar", () => {
    const [binding] = modEnterBindings(EditorState.create({ extensions: applyKeymap(() => undefined) }));
    expect(binding.scope?.split(" ")).toEqual(["editor", "search-panel"]);
    expect(binding.preventDefault).toBe(true);
  });
});
