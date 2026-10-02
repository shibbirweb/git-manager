// Word wrap in the file editor, like VS Code's View > Word Wrap (Option+Z). Open editors follow
// the setting through a compartment. Diffs and the merge tool never wrap, so their sides stay lined up.

import { Compartment, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

const compartment = new Compartment();
const views = new Set<EditorView>();

const registry = ViewPlugin.define((view) => {
  views.add(view);
  return {
    destroy() {
      views.delete(view);
    },
  };
});

/** Word wrap for a new file editor, starting with the current setting. */
export function wordWrap(on: boolean): Extension {
  return [registry, compartment.of(on ? EditorView.lineWrapping : [])];
}

/** Turns word wrap on or off in every open file editor; CodeMirror keeps the top line in place. */
export function setWordWrap(on: boolean): void {
  const effects = compartment.reconfigure(on ? EditorView.lineWrapping : []);
  for (const view of views) {
    view.dispatch({ effects });
  }
}
