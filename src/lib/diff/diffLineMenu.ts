// Stage, Unstage and Discard Selected Lines in a diff: their shortcuts, and the right-click menu of either side.
import { commandSpecs, currentPlatform, shortcutOverrides } from "$lib/commands/commandRuntime";
import { formatAccelerator } from "$lib/commands/keybinding";
import { effectiveShortcut } from "$lib/commands/registry";
import type { LineAction } from "$lib/types";
import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
import { toast } from "$lib/ui/toast.svelte";
import type { DiffEditors } from "./diffEditors.svelte";
import { selectionSize } from "./lineSelection";

const LINE_COMMANDS: Record<LineAction, "git.lines.stage" | "git.lines.unstage" | "git.lines.discard"> = {
  stage: "git.lines.stage",
  unstage: "git.lines.unstage",
  discard: "git.lines.discard",
};

/** The action's key as the platform writes it ("⌥⇧⌘S"), or null without one. */
export function lineShortcut(action: LineAction): string | null {
  const spec = commandSpecs().find((candidate) => candidate.id === LINE_COMMANDS[action]);
  const shortcut = spec ? effectiveShortcut(spec, shortcutOverrides()) : null;
  return shortcut ? formatAccelerator(shortcut, currentPlatform()) : null;
}

export function lineTitle(text: string, action: LineAction): string {
  const shortcut = lineShortcut(action);
  return shortcut ? `${text} (${shortcut})` : text;
}

/** Right-click in either side: the line actions for its selection, and Copy. */
export function openLineMenu(
  event: MouseEvent,
  editors: DiffEditors,
  lineMode: "unstaged" | "staged",
  run: (action: LineAction) => void,
): void {
  const node = event.target instanceof Node ? event.target : null;
  const oldEditor = editors.oldEditor();
  const shownNew = editors.newEditor();
  const editor =
    node && oldEditor?.dom.contains(node) ? oldEditor : node && shownNew?.dom.contains(node) ? shownNew : null;
  if (!editor) {
    return;
  }
  editors.activate(editor);
  // A click outside the selection moves the cursor there first, like other editors.
  const position = editor.posAtCoords({ x: event.clientX, y: event.clientY });
  if (
    position !== null &&
    !editor.state.selection.ranges.some((range) => position >= range.from && position <= range.to)
  ) {
    editor.dispatch({ selection: { anchor: position } });
  }
  const count = selectionSize(editors.currentSelection());
  const item = (label: string, action: LineAction, danger = false): MenuItem => ({
    label,
    action: () => run(action),
    disabled: count === 0,
    danger,
    hint: lineShortcut(action) ?? undefined,
  });
  const items: MenuItem[] =
    lineMode === "unstaged"
      ? [item("Stage Selected Lines", "stage"), item("Discard Selected Lines...", "discard", true)]
      : [item("Unstage Selected Lines", "unstage")];
  const { state } = editor;
  const copied = state.selection.ranges
    .filter((range) => !range.empty)
    .map((range) => state.sliceDoc(range.from, range.to));
  items.push(
    { separator: true },
    {
      label: "Copy",
      disabled: copied.length === 0,
      action: () => {
        navigator.clipboard.writeText(copied.join("\n")).catch(() => toast.error("Could not copy the selection"));
      },
    },
  );
  contextMenu.open(event, items);
}
