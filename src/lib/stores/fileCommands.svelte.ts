// Save, Revert and the Markdown view mode of each open file editor (FileView.svelte), so the
// File and View menus can act on the active tab and show what it can do. The MCP tools read
// the editors' text and selection through it too.

import type { MarkdownViewMode } from "./settingsData";

export interface FileViewCommands {
  /** True when the file was written. */
  save(options?: { quiet?: boolean }): Promise<boolean>;
  revert(): Promise<void>;
  setViewMode(mode: MarkdownViewMode): void;
  /** The editor's text, unsaved edits included; null before the editor exists. */
  text(): string | null;
  /** The editor's selection ranges, null before the editor exists. */
  selection(): EditorSelectionInfo | null;
  /** Puts the keyboard focus in the editor. */
  focus(): void;
}

/** Positions are 1-based lines and columns. */
export interface EditorSelectionRange {
  anchor: { line: number; column: number };
  head: { line: number; column: number };
  /** Offsets into the text, from <= to. */
  from: number;
  to: number;
  text: string;
}

export interface EditorSelectionInfo {
  ranges: EditorSelectionRange[];
  /** Index of the main range. */
  main: number;
  lineCount: number;
}

export interface FileViewState {
  /** A text file shown in the editor (not binary, too large or missing). */
  editable: boolean;
  /** The Markdown view mode; null for other files. */
  markdownMode: MarkdownViewMode | null;
}

class FileCommandsStore {
  /** Keyed by the absolute path of each open file editor. */
  states = $state.raw<Record<string, FileViewState>>({});
  private handlers = new Map<string, FileViewCommands>();

  /** Called by a file editor when it mounts; the returned function unregisters it. */
  register(filePath: string, commands: FileViewCommands): () => void {
    this.handlers.set(filePath, commands);
    return () => {
      if (this.handlers.get(filePath) !== commands) {
        return;
      }
      this.handlers.delete(filePath);
      if (filePath in this.states) {
        const { [filePath]: _removed, ...rest } = this.states;
        this.states = rest;
      }
    };
  }

  report(filePath: string, state: FileViewState): void {
    const previous = this.states[filePath];
    if (previous && previous.editable === state.editable && previous.markdownMode === state.markdownMode) {
      return;
    }
    this.states = { ...this.states, [filePath]: state };
  }

  async save(filePath: string, options: { quiet?: boolean } = {}): Promise<boolean> {
    return (await this.handlers.get(filePath)?.save(options)) ?? false;
  }

  async revert(filePath: string): Promise<void> {
    await this.handlers.get(filePath)?.revert();
  }

  setViewMode(filePath: string, mode: MarkdownViewMode): void {
    this.handlers.get(filePath)?.setViewMode(mode);
  }

  /** The open editor's text; null when no editor shows `filePath`. */
  text(filePath: string): string | null {
    return this.handlers.get(filePath)?.text() ?? null;
  }

  selection(filePath: string): EditorSelectionInfo | null {
    return this.handlers.get(filePath)?.selection() ?? null;
  }

  focus(filePath: string): void {
    this.handlers.get(filePath)?.focus();
  }
}

export const fileCommands = new FileCommandsStore();
