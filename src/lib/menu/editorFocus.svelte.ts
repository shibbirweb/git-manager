// Whether a CodeMirror editor has the keyboard focus, for enabling the Code and Find menu
// items. Updated on focus changes only, so typing costs nothing.

import { focusedEditor } from "$lib/editor/editorCommands";

class EditorFocusStore {
  focused = $state(false);
  inText = $state(false);
  writable = $state(false);

  private timer: ReturnType<typeof setTimeout> | undefined;

  /** Starts following the focus; the returned function stops it. */
  start(): () => void {
    // On focusout the next element is not focused yet: read once the move is done.
    const schedule = () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.read(), 0);
    };
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    this.read();
    return () => {
      clearTimeout(this.timer);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
    };
  }

  private read(): void {
    const target = focusedEditor();
    this.focused = target !== null;
    this.inText = target?.inText ?? false;
    this.writable = (target?.inText ?? false) && !(target?.view.state.readOnly ?? true);
  }
}

export const editorFocus = new EditorFocusStore();
