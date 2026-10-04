// Whether Quick Open (QuickOpen.svelte, Cmd+P and Shift+Cmd+P) shows, what it
// starts with, and what had the focus before: the element to give it back to and the text
// editor its ":" and "@" modes and the editor commands act on. Read when it opens, before
// the popup takes the focus.

import { EditorView } from "@codemirror/view";
import { focusedEditor } from "$lib/editor/editorCommands";
import { isPseudoTab } from "$lib/stores/pseudoTabs";
import { repoStore } from "$lib/stores/repo.svelte";
import { changesSelection } from "$lib/views/changes/selection.svelte";

export interface EditorTarget {
  view: EditorView;
  /** The file tab it shows; null for a diff or another editor. */
  filePath: string | null;
  /** It had the keyboard focus (else it is the file editor on screen). */
  focused: boolean;
  /** The caret was in its text, not in its find bar. */
  inText: boolean;
}

/** The file tab on screen, if it is a file (not a terminal, commit or Git tab). */
function shownFilePath(): string | null {
  const filePath = changesSelection.shownView === "file" ? repoStore.openFilePath : null;
  return filePath && !isPseudoTab(filePath) ? filePath : null;
}

/** The text editor commands should act on: the focused one, else the file editor on screen. */
function editorTarget(): EditorTarget | null {
  const filePath = shownFilePath();
  const focused = focusedEditor();
  if (focused) {
    const host = focused.view.dom.closest(".file-host");
    const inShownFile = host !== null && !host.classList.contains("hidden");
    return { view: focused.view, filePath: inShownFile ? filePath : null, focused: true, inText: focused.inText };
  }
  if (!filePath || typeof document === "undefined") {
    return null;
  }
  // The focused editor group's tab on screen (with the editor split, both groups show one).
  const root = document.querySelector<HTMLElement>(".editor-group.focused .file-host:not(.hidden) .cm-editor");
  const view = root ? EditorView.findFromDOM(root) : null;
  return view ? { view, filePath, focused: false, inText: true } : null;
}

/** Quick Open as a file picker (Compare with...): a file row calls `onPick` instead of opening it. */
export interface FilePicker {
  placeholder: string;
  onPick: (filePath: string) => void;
}

class QuickOpenStore {
  isOpen = $state(false);
  /** The text the popup starts with: "" (files) or ">" (commands). */
  initialValue = $state("");
  /** Set while the popup picks a file; read when it opens. */
  picker: FilePicker | null = null;
  /** Captured on open; plain fields, nothing renders from them. */
  target: EditorTarget | null = null;
  private previousFocus: HTMLElement | null = null;

  open(prefix: string, picker: FilePicker | null = null): void {
    this.picker = picker;
    const active = typeof document === "undefined" ? null : document.activeElement;
    this.previousFocus = active instanceof HTMLElement ? active : null;
    this.target = editorTarget();
    this.initialValue = prefix;
    this.isOpen = true;
    // The popup loads on first use: keys typed meanwhile must not reach the editor.
    this.previousFocus?.blur();
  }

  close(): void {
    this.isOpen = false;
    this.picker = null;
  }

  /** Gives the focus back to what had it before the popup opened. */
  restoreFocus(): void {
    const focus = this.previousFocus;
    this.previousFocus = null;
    if (focus?.isConnected) {
      focus.focus();
    }
  }

  /** Forgets the captured editor and focus, so a closed editor is not kept alive. */
  release(): void {
    if (this.isOpen) {
      return;
    }
    this.target = null;
    this.previousFocus = null;
  }
}

export const quickOpen = new QuickOpenStore();
