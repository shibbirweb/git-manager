// Custom keyboard shortcuts in the editors: the plan from commands/editorKeyPlan.ts as a
// keymap in front of CodeMirror's own, in a compartment, so a change in Settings reaches
// the open editors without rebuilding them. Without custom keys the compartment is empty.

import { Compartment, type Extension, Prec } from "@codemirror/state";
import { type EditorView, type KeyBinding, keymap, ViewPlugin } from "@codemirror/view";
import { EMPTY_KEY_PLAN, type EditorKeyPlan, sameKeyPlan } from "$lib/commands/editorKeyPlan";
import type { CommandId } from "$lib/commands/registry";
import { EDITOR_COMMANDS } from "./editorCommands";

type CommandRunner = (commandId: CommandId, view: EditorView) => void;

const compartment = new Compartment();
const views = new Set<EditorView>();

/** Remembers each editor so changed shortcuts reach the ones already open. */
const registry = ViewPlugin.define((view) => {
  views.add(view);
  return {
    destroy() {
      views.delete(view);
    },
  };
});

let plan: EditorKeyPlan = EMPTY_KEY_PLAN;
let runWindowCommand: CommandRunner = () => undefined;

// Find and its friends also work from the find bar's fields, like their default keys.
const FIND_SCOPE = "editor search-panel";

function planExtension(current: EditorKeyPlan): Extension {
  if (current.commands.length + current.window.length + current.blocked.length === 0) {
    return [];
  }
  const bindings: KeyBinding[] = [
    ...current.commands.map(({ commandId, key }) => {
      const entry = EDITOR_COMMANDS[commandId];
      return { key, run: entry.run, scope: entry.inText ? "editor" : FIND_SCOPE, preventDefault: true };
    }),
    ...current.window.map(({ commandId, key }) => ({
      key,
      scope: FIND_SCOPE,
      run: (view: EditorView) => {
        runWindowCommand(commandId, view);
        return true;
      },
    })),
    // Handled, so the editor's default binding behind it never runs.
    ...current.blocked.map((key) => ({ key, scope: FIND_SCOPE, run: () => true })),
  ];
  return Prec.highest(keymap.of(bindings));
}

/** The custom keys for a new editor. */
export function commandKeys(): Extension {
  return [registry, compartment.of(planExtension(plan))];
}

/** Applies changed shortcuts to every open editor; `runner` runs a window command from one. */
export function setCommandKeys(next: EditorKeyPlan, runner: CommandRunner): void {
  runWindowCommand = runner;
  if (sameKeyPlan(plan, next)) {
    return;
  }
  plan = next;
  const extension = planExtension(plan);
  for (const view of views) {
    view.dispatch({ effects: compartment.reconfigure(extension) });
  }
}
