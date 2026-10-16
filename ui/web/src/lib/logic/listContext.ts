// A List that owns the keyboard, the selection and the row semantics (a listbox or a tree) tells the Rows inside it,
// so a Row there draws only its look and takes no focus of its own. In a plain list (role list) a Row with onclick
// stays a button, so it can be reached and pressed with the keyboard.
import { getContext, setContext } from "svelte";

const LIST_KEY = Symbol("gm-list");

export function markInsideList(ownsKeys: boolean): void {
  setContext(LIST_KEY, ownsKeys);
}

export function isInsideList(): boolean {
  return getContext<boolean | undefined>(LIST_KEY) ?? false;
}

/** Clicks on a control inside a row (an action button, a rename field) belong to that control, not the row. */
export function onRowControl(event: MouseEvent): boolean {
  const target = event.target as Element | null;
  const control = target?.closest("button, a, input, select, textarea, [role='button']");
  return control !== null && control !== undefined && control !== event.currentTarget;
}
