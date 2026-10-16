// What a key does in a List, or in the filter field that drives it, as one command the List carries out: move the
// current row, fold a tree row, open a row or its menu, select all, or move the focus into the list.
import { fieldAction, type FieldKeys } from "./listField";
import { isListKey, moveIndex, treeMove } from "./listNav";

export interface KeyState {
  /** The current row's index, -1 for none. */
  current: number;
  count: number;
  skip: (index: number) => boolean;
  tree: boolean;
  multiple: boolean;
  levels: () => number[];
  expanded: (index: number) => boolean | null;
}

/** What a List's row snippet is told about its row. */
export interface ListRowState {
  index: number;
  selected: boolean;
  current: boolean;
}

export interface KeyInput {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

export type ListCommand =
  | { kind: "move"; index: number; range: boolean }
  | { kind: "toggle"; index: number; open: boolean }
  | { kind: "activate"; index: number }
  | { kind: "menu"; index: number }
  | { kind: "selectAll" }
  | { kind: "enter"; index: number | null };

/** A key pressed in the list itself. */
export function listKeyCommand(event: KeyInput, state: KeyState): ListCommand | null {
  if (isListKey(event.key)) {
    const index = moveIndex(state.current, state.count, event.key, state.skip);
    return { kind: "move", index, range: state.multiple && event.shiftKey };
  }
  if (state.tree && (event.key === "ArrowLeft" || event.key === "ArrowRight") && state.current >= 0) {
    const move = treeMove(event.key, state.current, state.expanded(state.current), state.levels());
    if (move?.kind === "toggle") {
      return { kind: "toggle", index: state.current, open: move.open };
    }
    return move ? { kind: "move", index: move.index, range: false } : null;
  }
  if (event.key === "Enter" && state.current >= 0) {
    return { kind: "activate", index: state.current };
  }
  if (state.multiple && event.key === "a" && (event.metaKey || event.ctrlKey)) {
    return { kind: "selectAll" };
  }
  if ((event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) && state.current >= 0) {
    return { kind: "menu", index: state.current };
  }
  return null;
}

/** A key pressed in the field that drives the list (`fieldKeys`). */
export function fieldKeyCommand(event: KeyInput, mode: FieldKeys, state: KeyState): ListCommand | null {
  if (mode === "drive") {
    // Ctrl+N and Ctrl+P move like the arrows; Enter with Shift or Cmd still picks (the caller reads the keys).
    const ctrlOnly = event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
    if (ctrlOnly && (event.key === "n" || event.key === "p")) {
      const key = event.key === "n" ? "ArrowDown" : "ArrowUp";
      return { kind: "move", index: moveIndex(state.current, state.count, key, state.skip), range: false };
    }
    if (event.key === "Enter" && !event.altKey && (event.shiftKey || event.metaKey || event.ctrlKey)) {
      return state.current >= 0 ? { kind: "activate", index: state.current } : null;
    }
  }
  const modified = event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
  const action = fieldAction(event.key, mode, modified);
  if (action === null) {
    return null;
  }
  if (action.kind === "enter") {
    return { kind: "enter", index: state.current < 0 ? moveIndex(-1, state.count, "Home", state.skip) : null };
  }
  if (action.kind === "move") {
    return { kind: "move", index: moveIndex(state.current, state.count, action.key, state.skip), range: false };
  }
  return state.current >= 0 ? { kind: "activate", index: state.current } : null;
}

/** What a List does for a command. */
export interface ListHost {
  state: () => KeyState;
  move: (index: number, range: boolean) => void;
  toggle: (index: number, open: boolean) => void;
  /** `event` tells how it was asked for, such as with Shift or Cmd held. */
  activate: (index: number, event: KeyInput) => void;
  menu: (index: number) => void;
  selectAll: () => void;
  focus: () => void;
}

/** Handles a key in the list (or, `fromField`, in its field); returns whether the key was used. */
export function handleListKey(event: KeyInput, fromField: FieldKeys | null, host: ListHost): boolean {
  const state = host.state();
  const command = fromField ? fieldKeyCommand(event, fromField, state) : listKeyCommand(event, state);
  if (command === null) {
    return false;
  }
  if (command.kind === "move") {
    host.move(command.index, command.range);
  } else if (command.kind === "toggle") {
    host.toggle(command.index, command.open);
  } else if (command.kind === "activate") {
    host.activate(command.index, event);
  } else if (command.kind === "menu") {
    host.menu(command.index);
  } else if (command.kind === "selectAll") {
    host.selectAll();
  } else {
    host.focus();
    if (command.index !== null) {
      host.move(command.index, false);
    }
  }
  return true;
}

/** A row's menu opened from the keyboard shows under the row's start, like a right-click there. */
export function keyMenuEvent(row: Element | null): MouseEvent {
  const rect = row?.getBoundingClientRect();
  return new MouseEvent("contextmenu", { clientX: (rect?.left ?? 0) + 24, clientY: rect?.bottom ?? 0 });
}
