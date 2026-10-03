import { history, undo, undoDepth } from "@codemirror/commands";
import { EditorState, type Transaction } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { type DocMember, isReplay, replaySpec, SharedDocs } from "./sharedDocs";

function stateOf(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [history()] });
}

describe("replaying changes in the other view", () => {
  it("applies the same text change, kept out of the other view's undo history", () => {
    const left = stateOf("hello");
    const right = stateOf("hello");
    const typed = left.update({ changes: { from: 5, insert: " world" }, userEvent: "input.type" });
    const spec = replaySpec(typed);
    expect(spec).not.toBeNull();
    const replayed = right.update(spec ?? {});
    expect(replayed.state.doc.toString()).toBe("hello world");
    expect(undoDepth(typed.state)).toBe(1);
    expect(undoDepth(replayed.state)).toBe(0);
    expect(replayed.isUserEvent("input.type")).toBe(false);
  });

  it("never sends a replay back, nor a change without text", () => {
    const state = stateOf("abc");
    const replayed = state.update(replaySpec(state.update({ changes: { from: 0, insert: "x" } })) ?? {});
    expect(replaySpec(replayed)).toBeNull();
    expect(replaySpec(state.update({ selection: { anchor: 1 } }))).toBeNull();
  });

  it("keeps each view's own undo working after changes from the other", () => {
    const left = stateOf("one");
    let right = stateOf("one");
    // The right view types, then the left one does.
    const rightTyped = right.update({ changes: { from: 3, insert: " two" } });
    right = rightTyped.state;
    const leftAfter = left.update(replaySpec(rightTyped) ?? {}).state;
    const leftTyped = leftAfter.update({ changes: { from: 0, insert: "zero " } });
    right = right.update(replaySpec(leftTyped) ?? {}).state;
    expect(right.doc.toString()).toBe("zero one two");
    // Undo in the right view takes back only its own change.
    let undone: Transaction | null = null;
    undo({ state: right, dispatch: (tr) => (undone = tr) });
    expect((undone as Transaction | null)?.state.doc.toString()).toBe("zero one");
  });

  it("tells replayed updates from typed ones", () => {
    const state = stateOf("a");
    const typed = state.update({ changes: { from: 1, insert: "b" } });
    const replayed = state.update(replaySpec(typed) ?? {});
    expect(isReplay({ transactions: [typed] })).toBe(false);
    expect(isReplay({ transactions: [replayed] })).toBe(true);
    expect(isReplay({ transactions: [] })).toBe(false);
  });
});

describe("shared documents", () => {
  it("shares one state per file until the last editor leaves", () => {
    const docs = new SharedDocs<string>((task) => task());
    const first: DocMember<string> = { view: "left" };
    const second: DocMember<string> = { view: null };
    const doc = docs.join("/a.ts", first);
    doc.diskVersion = "v1";
    expect(docs.join("/a.ts", second)).toBe(doc);
    expect(docs.peers("/a.ts", second)).toEqual(["left"]);
    // An editor without a view yet gets no replays.
    expect(docs.peers("/a.ts", first)).toEqual([]);
    second.view = "right";
    expect(docs.peers("/a.ts", first)).toEqual(["right"]);
    expect(docs.isLeader("/a.ts", first)).toBe(true);
    expect(docs.isLeader("/a.ts", second)).toBe(false);
    docs.leave("/a.ts", first);
    expect(docs.isLeader("/a.ts", second)).toBe(true);
    docs.leave("/a.ts", second);
    expect(docs.join("/a.ts", first).diskVersion).toBeNull();
  });

  it("keeps the text of a moved tab for the editor that replaces it", () => {
    const pending: Array<() => void> = [];
    const docs = new SharedDocs<string>((task) => pending.push(task));
    const old: DocMember<string> = { view: "left" };
    const doc = docs.join("/a.ts", old);
    const text = EditorState.create({ doc: "unsaved" }).doc;
    docs.leave("/a.ts", old, text);
    // The new editor joins before the clean-up runs.
    const moved: DocMember<string> = { view: null };
    expect(docs.join("/a.ts", moved)).toBe(doc);
    pending.forEach((task) => task());
    expect(docs.join("/a.ts", moved).text?.toString()).toBe("unsaved");
  });

  it("forgets a file once its last editor is gone", () => {
    const pending: Array<() => void> = [];
    const docs = new SharedDocs<string>((task) => pending.push(task));
    const member: DocMember<string> = { view: null };
    const doc = docs.join("/a.ts", member);
    docs.leave("/a.ts", member);
    pending.forEach((task) => task());
    expect(docs.join("/a.ts", member)).not.toBe(doc);
  });
});
