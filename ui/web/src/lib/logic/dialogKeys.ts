// What a key pressed inside a Dialog does: Esc closes it, Cmd+Enter (Ctrl+Enter) submits it, and with
// `enterSubmits` a plain Enter in a one-line field submits it too, like a form (a one-field prompt, a password).

export type DialogKeyAction = "close" | "submit" | null;

export interface DialogKey {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
}

export interface DialogKeyOptions {
  dismissible: boolean;
  canSubmit: boolean;
  enterSubmits: boolean;
  /** The focus is in a one-line text field (see `isLineField`). */
  inLineField: boolean;
}

const NOT_TEXT = ["button", "checkbox", "color", "file", "image", "radio", "range", "reset", "submit"];

/** An input that takes one line of text, where Enter submits a form. */
export function isLineField(element: { tagName: string; type?: string } | null): boolean {
  return element?.tagName.toLowerCase() === "input" && !NOT_TEXT.includes((element.type ?? "text").toLowerCase());
}

export function dialogKeyAction(event: DialogKey, options: DialogKeyOptions): DialogKeyAction {
  if (event.defaultPrevented || event.isComposing) {
    return null;
  }
  if (event.key === "Escape") {
    return options.dismissible ? "close" : null;
  }
  if (event.key !== "Enter" || !options.canSubmit) {
    return null;
  }
  if (event.metaKey || event.ctrlKey) {
    return "submit";
  }
  const plain = !event.altKey && !event.shiftKey;
  return plain && options.enterSubmits && options.inLineField ? "submit" : null;
}

/** Runs what `event` asks of a Dialog: close it or submit it, taking the key from the page. */
export function runDialogKey(
  event: KeyboardEvent,
  options: { dismissible: boolean; enterSubmits: boolean },
  actions: { close: () => void; submit?: () => void },
): void {
  const inLineField = isLineField(event.target as HTMLInputElement | null);
  const action = dialogKeyAction(event, { ...options, canSubmit: actions.submit !== undefined, inLineField });
  if (action) {
    event.preventDefault();
    (action === "close" ? actions.close : actions.submit)?.();
  }
}
