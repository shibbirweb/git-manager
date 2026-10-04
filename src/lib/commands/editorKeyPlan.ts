// What custom shortcuts change inside a text editor, as data for editor/commandKeys.ts.
// The editor binds its commands' default keys in CodeMirror's own keymaps (setup.ts, the
// find bar, editorCommands.ts); this plan goes in front of them, so it only has to name
// what differs: editor commands on new keys, default keys that were freed, custom keys of
// window commands that should also work while the caret is in an editor, and the window
// commands that always do (IN_EDITOR). Pure.

import { isEditorAction, type EditorAction, type MenuPlatform } from "$lib/menu/menuIds";
import { acceleratorId, codeMirrorKey } from "./keybinding";
import { type CommandId, type CommandSpec, effectiveShortcut, type ShortcutOverrides } from "./registry";

export interface EditorKeyPlan {
  /** Editor commands on their custom keys, in CodeMirror notation. */
  commands: { commandId: EditorAction; key: string }[];
  /** Keys the editor hands to a window command: its custom key, or an editor default it took over. */
  window: { commandId: CommandId; key: string }[];
  /** Default editor keys that were moved or removed and nothing took: they do nothing in an editor. */
  blocked: string[];
}

export const EMPTY_KEY_PLAN: EditorKeyPlan = { commands: [], window: [], blocked: [] };

function editorAction(spec: CommandSpec): EditorAction | null {
  return spec.scope === "editor" && spec.menuAction && isEditorAction(spec.menuAction) ? spec.menuAction : null;
}

/**
 * Window commands whose key also works in an editor, over the editor's own binding: like
 * JetBrains, Cmd+Up jumps to the Navigation Bar (Cmd+Home still goes to the top).
 */
const IN_EDITOR = new Set<CommandId>(["edit.navigationBar"]);

export function editorKeyPlan(specs: readonly CommandSpec[], overrides: ShortcutOverrides, platform: MenuPlatform): EditorKeyPlan {
  const plan: EditorKeyPlan = { commands: [], window: [], blocked: [] };
  const idOf = (accelerator: string | null) => (accelerator === null ? null : acceleratorId(accelerator, platform));
  // Every key an editor command answers to now: an editor key wins inside the editor.
  const editorKeys = new Set<string>();
  for (const spec of specs) {
    const keysId = editorAction(spec) ? idOf(effectiveShortcut(spec, overrides)) : null;
    if (keysId !== null) {
      editorKeys.add(keysId);
    }
  }
  const windowOwner = (keysId: string): CommandSpec | null =>
    specs.find((spec) => spec.scope === "global" && idOf(effectiveShortcut(spec, overrides)) === keysId) ?? null;
  const windowKeys = new Set<string>();
  const addWindow = (commandId: CommandId, accelerator: string, keysId: string) => {
    const key = codeMirrorKey(accelerator, platform);
    if (key !== null && !windowKeys.has(keysId)) {
      windowKeys.add(keysId);
      plan.window.push({ commandId, key });
    }
  };
  for (const spec of specs) {
    const action = editorAction(spec);
    if (!action || !Object.hasOwn(overrides, spec.id)) {
      continue;
    }
    const shortcut = effectiveShortcut(spec, overrides);
    const key = shortcut === null ? null : codeMirrorKey(shortcut, platform);
    if (key !== null) {
      plan.commands.push({ commandId: action, key });
    }
    const freed = spec.defaultShortcut;
    const freedId = idOf(freed);
    if (freed === null || freedId === null || editorKeys.has(freedId)) {
      continue;
    }
    const owner = windowOwner(freedId);
    if (owner) {
      addWindow(owner.id, freed, freedId);
    } else {
      const freedKey = codeMirrorKey(freed, platform);
      if (freedKey !== null) {
        plan.blocked.push(freedKey);
      }
    }
  }
  for (const spec of specs) {
    if (spec.scope !== "global" || (!IN_EDITOR.has(spec.id) && !Object.hasOwn(overrides, spec.id))) {
      continue;
    }
    const shortcut = effectiveShortcut(spec, overrides);
    const keysId = idOf(shortcut);
    if (shortcut !== null && keysId !== null && !editorKeys.has(keysId)) {
      addWindow(spec.id, shortcut, keysId);
    }
  }
  return plan;
}

/** Two plans bind the same keys the same way (open editors are reconfigured only on a change). */
export function sameKeyPlan(first: EditorKeyPlan, second: EditorKeyPlan): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}
