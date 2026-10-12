// A List tells the Rows inside it that it owns the keyboard, the selection and the row semantics, so a Row there
// draws only its look and takes no focus of its own.
import { getContext, setContext } from "svelte";

const LIST_KEY = Symbol("gm-list");

export function markInsideList(): void {
  setContext(LIST_KEY, true);
}

export function isInsideList(): boolean {
  return getContext<boolean | undefined>(LIST_KEY) ?? false;
}
