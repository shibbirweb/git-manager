// Save, Revert and the Markdown view mode of each open file editor (FileView.svelte), so the
// File and View menus can act on the active tab and show what it can do. The MCP tools read
// the editors' text and selection through it too. A file open in both editor groups has two
// editors; the one in the focused group answers.

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
  /** This editor is in the focused editor group, so it answers for its file. */
  preferred?(): boolean;
  /** Replaces the whole text as one undoable change (Local History > Revert); false when not editable. */
  replaceText?(text: string): boolean;
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
  /** Every editor of each file, in the order they mounted. */
  private handlers = new Map<string, FileViewCommands[]>();

  /** Called by a file editor when it mounts; the returned function unregisters it. */
  register(filePath: string, commands: FileViewCommands): () => void {
    this.handlers.set(filePath, [...(this.handlers.get(filePath) ?? []), commands]);
    return () => {
      const left = (this.handlers.get(filePath) ?? []).filter((candidate) => candidate !== commands);
      if (left.length > 0) {
        this.handlers.set(filePath, left);
        return;
      }
      this.handlers.delete(filePath);
      if (filePath in this.states) {
        const { [filePath]: _removed, ...rest } = this.states;
        this.states = rest;
      }
    };
  }

  /** The editor that answers for `filePath`: the one in the focused group, else the first. */
  private handler(filePath: string): FileViewCommands | undefined {
    const list = this.handlers.get(filePath) ?? [];
    return list.find((commands) => commands.preferred?.() ?? false) ?? list[0];
  }

  report(filePath: string, state: FileViewState): void {
    const previous = this.states[filePath];
    if (previous && previous.editable === state.editable && previous.markdownMode === state.markdownMode) {
      return;
    }
    this.states = { ...this.states, [filePath]: state };
  }

  async save(filePath: string, options: { quiet?: boolean } = {}): Promise<boolean> {
    return (await this.handler(filePath)?.save(options)) ?? false;
  }

  async revert(filePath: string): Promise<void> {
    await this.handler(filePath)?.revert();
  }

  setViewMode(filePath: string, mode: MarkdownViewMode): void {
    this.handler(filePath)?.setViewMode(mode);
  }

  /** The open editor's text; null when no editor shows `filePath`. */
  text(filePath: string): string | null {
    return this.handler(filePath)?.text() ?? null;
  }

  selection(filePath: string): EditorSelectionInfo | null {
    return this.handler(filePath)?.selection() ?? null;
  }

  focus(filePath: string): void {
    this.handler(filePath)?.focus();
  }

  replaceText(filePath: string, text: string): boolean {
    return this.handler(filePath)?.replaceText?.(text) ?? false;
  }
}

export const fileCommands = new FileCommandsStore();
