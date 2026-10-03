// Cursor and file details of the visible file editor, for the status bar.

import type { Eol } from "$lib/types";

export interface EditorInfo {
  /** Absolute path of the file the info belongs to. */
  filePath: string;
  /** 1-based line and column of the cursor. */
  line: number;
  column: number;
  /** Characters selected (0 when the selection is empty). */
  selected: number;
  /** Lines touched by the selection. */
  selectedLines: number;
  eol: Eol;
  tabSize: number;
  /** Indents with tabs (else spaces). */
  indentTabs: boolean;
  /** The indentation was read from the file (Detect indentation). */
  indentDetected: boolean;
  language: string;
}

class EditorStatus {
  info = $state.raw<EditorInfo | null>(null);

  report(info: EditorInfo): void {
    const current = this.info;
    if (
      current &&
      current.filePath === info.filePath &&
      current.line === info.line &&
      current.column === info.column &&
      current.selected === info.selected &&
      current.eol === info.eol &&
      current.tabSize === info.tabSize &&
      current.indentTabs === info.indentTabs &&
      current.indentDetected === info.indentDetected &&
      current.language === info.language
    ) {
      return;
    }
    this.info = info;
  }

  clear(filePath: string): void {
    if (this.info?.filePath === filePath) {
      this.info = null;
    }
  }
}

export const editorStatus = new EditorStatus();
