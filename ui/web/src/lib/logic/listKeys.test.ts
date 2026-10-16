import { describe, expect, it, vi } from "vitest";
import { fieldKeyCommand, handleListKey, listKeyCommand, type KeyState, type ListHost } from "./listKeys";

function key(name: string, extra: Partial<Record<"shiftKey" | "metaKey" | "ctrlKey" | "altKey", boolean>> = {}) {
  return { key: name, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, ...extra };
}

function state(extra: Partial<KeyState> = {}): KeyState {
  return {
    current: -1,
    count: 5,
    skip: (index) => index === 0,
    tree: false,
    multiple: false,
    levels: () => [0, 1, 1, 0, 1],
    expanded: () => null,
    ...extra,
  };
}

describe("listKeyCommand", () => {
  it("moves over skipped rows, and Shift extends with multiple", () => {
    expect(listKeyCommand(key("ArrowDown"), state())).toEqual({ kind: "move", index: 1, range: false });
    expect(listKeyCommand(key("ArrowDown", { shiftKey: true }), state({ current: 1, multiple: true }))).toEqual({
      kind: "move",
      index: 2,
      range: true,
    });
  });

  it("folds and moves in a tree", () => {
    const expanded = (index: number) => (index === 0 ? false : null);
    const tree = state({ tree: true, current: 0, skip: () => false, expanded });
    expect(listKeyCommand(key("ArrowRight"), tree)).toEqual({ kind: "toggle", index: 0, open: true });
    const fromChild = listKeyCommand(key("ArrowLeft"), { ...tree, current: 2 });
    expect(fromChild).toEqual({ kind: "move", index: 0, range: false });
  });

  it("opens with Enter, selects all with Cmd+A only when multiple", () => {
    expect(listKeyCommand(key("Enter"), state({ current: 2 }))).toEqual({ kind: "activate", index: 2 });
    expect(listKeyCommand(key("Enter"), state())).toBeNull();
    expect(listKeyCommand(key("a", { metaKey: true }), state({ multiple: true }))).toEqual({ kind: "selectAll" });
    expect(listKeyCommand(key("a", { metaKey: true }), state())).toBeNull();
  });

  it("opens the current row's menu with the menu key or Shift+F10", () => {
    expect(listKeyCommand(key("ContextMenu"), state({ current: 3 }))).toEqual({ kind: "menu", index: 3 });
    expect(listKeyCommand(key("F10", { shiftKey: true }), state({ current: 1 }))).toEqual({ kind: "menu", index: 1 });
    expect(listKeyCommand(key("F10"), state({ current: 1 }))).toBeNull();
    expect(listKeyCommand(key("ContextMenu"), state())).toBeNull();
  });
});

describe("fieldKeyCommand", () => {
  it("enters the list on the first pickable row, or keeps the current one", () => {
    expect(fieldKeyCommand(key("ArrowDown"), "enter", state())).toEqual({ kind: "enter", index: 1 });
    expect(fieldKeyCommand(key("Enter"), "enter", state({ current: 3 }))).toEqual({ kind: "enter", index: null });
  });

  it("drives the highlight and opens the highlighted row", () => {
    expect(fieldKeyCommand(key("ArrowDown"), "drive", state({ current: 1 }))).toEqual({
      kind: "move",
      index: 2,
      range: false,
    });
    expect(fieldKeyCommand(key("Enter"), "drive", state({ current: 1 }))).toEqual({ kind: "activate", index: 1 });
    expect(fieldKeyCommand(key("Enter"), "drive", state())).toBeNull();
  });
});

describe("handleListKey", () => {
  function host(current = -1): ListHost & Record<string, ReturnType<typeof vi.fn>> {
    return {
      state: () => state({ current }),
      move: vi.fn(),
      toggle: vi.fn(),
      activate: vi.fn(),
      menu: vi.fn(),
      selectAll: vi.fn(),
      focus: vi.fn(),
    } as unknown as ListHost & Record<string, ReturnType<typeof vi.fn>>;
  }

  it("focuses the list, then selects the first row, when a field enters it", () => {
    const target = host();
    expect(handleListKey(key("ArrowDown"), "enter", target)).toBe(true);
    expect(target.focus).toHaveBeenCalled();
    expect(target.move).toHaveBeenCalledWith(1, false);
  });

  it("leaves keys it does not use", () => {
    const target = host(2);
    expect(handleListKey(key("x"), null, target)).toBe(false);
    expect(handleListKey(key("Enter"), null, target)).toBe(true);
    expect(target.activate).toHaveBeenCalledWith(2, expect.objectContaining({ key: "Enter" }));
  });

  it("moves with Ctrl+N and Ctrl+P and picks with Shift+Enter when a field drives the list", () => {
    const state: KeyState = {
      current: 1,
      count: 4,
      skip: () => false,
      tree: false,
      multiple: false,
      levels: () => [],
      expanded: () => null,
    };
    expect(fieldKeyCommand({ ...key("n"), ctrlKey: true }, "drive", state)).toEqual({
      kind: "move",
      index: 2,
      range: false,
    });
    expect(fieldKeyCommand({ ...key("p"), ctrlKey: true }, "drive", state)).toEqual({
      kind: "move",
      index: 0,
      range: false,
    });
    expect(fieldKeyCommand({ ...key("Enter"), shiftKey: true }, "drive", state)).toEqual({
      kind: "activate",
      index: 1,
    });
    expect(fieldKeyCommand({ ...key("n"), ctrlKey: true }, "enter", state)).toBeNull();
  });
});
