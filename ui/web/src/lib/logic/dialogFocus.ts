// Where the focus goes when a Dialog opens: its first field (or button), else the dialog itself; when it closes,
// back to what had the focus before, if that is still in the page.
const FIRST = "[autofocus], input:not([type=checkbox]):not([type=radio]), textarea, select, button:not(:disabled)";

/** Moves the focus into `dialog` and returns the function that gives it back. */
export function focusInto(dialog: HTMLElement): () => void {
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  (dialog.querySelector<HTMLElement>(FIRST) ?? dialog).focus();
  return () => {
    if (returnFocus?.isConnected) {
      returnFocus.focus();
    }
  };
}
