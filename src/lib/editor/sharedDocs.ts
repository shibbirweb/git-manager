// One file open in both editor groups: two CodeMirror views, one document. Each view keeps
// its own state (caret, scroll, folds, undo history). A change made in one view is replayed in
// the other through the EditorView `dispatchTransactions` option (CodeMirror's split view
// example), marked so it is never sent back and never lands in the other view's undo history.
// The saved text, the disk version and the saving flag are kept here per file, so both views
// agree on unsaved changes and a save writes the file once. Moving a tab to the other group
// replaces its editor: the text of the editor that left is kept until the next one starts.

import { Annotation, type Text, Transaction, type TransactionSpec } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";

/** Marks a change replayed from another view of the same file. */
export const replayedChange = Annotation.define<boolean>();

/**
 * What the other views apply for `tr`: its changes, marked as a replay and kept out of their
 * undo history. Null when it changed no text or is a replay itself. The user event is left
 * off, so a replayed keystroke does not open completions in the other view.
 */
export function replaySpec(tr: Transaction): TransactionSpec | null {
  if (tr.changes.empty || tr.annotation(replayedChange) === true) {
    return null;
  }
  return { changes: tr.changes, annotations: [replayedChange.of(true), Transaction.addToHistory.of(false)] };
}

/** Every text change of `update` came from another view: the view that typed it handles dirty state, auto save and history. */
export function isReplay(update: Pick<ViewUpdate, "transactions">): boolean {
  const changing = update.transactions.filter((tr) => !tr.changes.empty);
  return changing.length > 0 && changing.every((tr) => tr.annotation(replayedChange) === true);
}

/** One file editor (FileView) taking part; `view` is set once its editor exists. */
export interface DocMember<V> {
  view: V | null;
}

export interface SharedDoc<V> {
  /** Text as last loaded or saved, for the dirty check. */
  baseline: Text | null;
  /** The file's state on disk as last read or saved. */
  diskVersion: string | null;
  /** A save (or Mark as Resolved) is writing the file. */
  saving: boolean;
  /** The text of the last editor that went away while no other editor had a view, for the next one. */
  text: Text | null;
  /** In the order they joined; the first one does the quiet reloads from disk. */
  members: DocMember<V>[];
}

export class SharedDocs<V> {
  private docs = new Map<string, SharedDoc<V>>();

  /**
   * `later` runs the clean-up after the last editor left. The default waits for the current
   * update to finish, since a moved tab's new editor joins in the same update as the old one leaves.
   */
  constructor(private later: (task: () => void) => void = (task) => void setTimeout(task, 0)) {}

  /** Adds an editor of `filePath`; the file's shared state is made by the first one. */
  join(filePath: string, member: DocMember<V>): SharedDoc<V> {
    let doc = this.docs.get(filePath);
    if (!doc) {
      doc = { baseline: null, diskVersion: null, saving: false, text: null, members: [] };
      this.docs.set(filePath, doc);
    }
    if (!doc.members.includes(member)) {
      doc.members.push(member);
    }
    return doc;
  }

  /** The editor went away with `text` on screen; the state goes soon after the last one, unless another joins. */
  leave(filePath: string, member: DocMember<V>, text: Text | null = null): void {
    const doc = this.docs.get(filePath);
    if (!doc) {
      return;
    }
    doc.members = doc.members.filter((candidate) => candidate !== member);
    if (text && !doc.members.some((candidate) => candidate.view !== null)) {
      doc.text = text;
    }
    if (doc.members.length === 0) {
      this.later(() => {
        if (doc.members.length === 0 && this.docs.get(filePath) === doc) {
          this.docs.delete(filePath);
        }
      });
    }
  }

  /** The views of the other editors of `filePath` that have one. */
  peers(filePath: string, member: DocMember<V>): V[] {
    const doc = this.docs.get(filePath);
    if (!doc) {
      return [];
    }
    return doc.members.filter((candidate) => candidate !== member && candidate.view !== null).map((candidate) => candidate.view as V);
  }

  /** The first editor of the file (or one that never joined): it alone reloads the file quietly. */
  isLeader(filePath: string, member: DocMember<V>): boolean {
    const doc = this.docs.get(filePath);
    return !doc || doc.members[0] === member || !doc.members.includes(member);
  }
}

export const sharedDocs = new SharedDocs<EditorView>();

/** The `dispatchTransactions` of a file editor: update it, then replay its text changes in the other views of the file. */
export function syncedDispatch(filePath: string, member: DocMember<EditorView>): (trs: readonly Transaction[], view: EditorView) => void {
  return (trs, view) => {
    view.update(trs);
    for (const tr of trs) {
      const spec = replaySpec(tr);
      if (!spec) {
        continue;
      }
      for (const peer of sharedDocs.peers(filePath, member)) {
        peer.dispatch(spec);
      }
    }
  };
}
