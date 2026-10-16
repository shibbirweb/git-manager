// What Quick Open asks the backend: the file index and the workspace symbol index (each opened the first time a
// mode needs it, results growing while it builds) and the "@" outline of the editor it opened over. Only the
// latest answer of each query is kept.
import { Channel } from "@tauri-apps/api/core";
import type { EditorView } from "@codemirror/view";
import { api, errorMessage } from "$lib/api";
import { resultRows, type SearchRow, splitLocation } from "$lib/search/fileSearchModel";
import { symbolRows, type SymbolRow } from "$lib/search/symbolSearchModel";
import type { FolderRef } from "$lib/stores/workspacePaths";
import type { FileSearchProgress, OutlineResult, SymbolSearchProgress } from "$lib/types";
import type { QuickOpenMode } from "./quickOpenModel";

const FILE_LIMIT = 50;
const SYMBOL_LIMIT = 50;
/** Re-run a query this often while an index is still building. */
const RETRY_MS = 250;
/** Bigger documents are not sent for their symbols (the backend would skip them too). */
const MAX_OUTLINE_CHARS = 8 * 1024 * 1024;

export class QuickOpenSearch {
  files = $state.raw<SearchRow[]>([]);
  fileIndex = $state.raw<FileSearchProgress | null>(null);
  symbols = $state.raw<SymbolRow[]>([]);
  symbolIndex = $state.raw<SymbolSearchProgress | null>(null);
  outline = $state.raw<OutlineResult | null>(null);
  error = $state<string | null>(null);

  readonly #requests = { files: 0, symbols: 0 };
  #retryTimer: ReturnType<typeof setTimeout> | undefined;
  #filesOpened = false;
  #symbolsOpened = false;
  #outlineRequested = false;
  #closed = false;

  /** `current` is the mode and text on screen now, to skip answers for a query the user left. */
  constructor(
    private readonly folders: () => FolderRef[],
    private readonly current: () => { mode: QuickOpenMode; text: string },
  ) {}

  get #roots(): string[] {
    return this.folders().map((folder) => folder.root);
  }

  get fileIndexing(): boolean {
    return this.fileIndex !== null && !this.fileIndex.done;
  }

  get symbolIndexing(): boolean {
    return this.symbolIndex !== null && !this.symbolIndex.done;
  }

  /** The text changed: run its mode's query. `editor` is the one the popup opened over, for "@". */
  run(mode: QuickOpenMode, text: string, editor: { view: EditorView; filePath: string | null } | null): void {
    clearTimeout(this.#retryTimer);
    const hasFolders = this.#roots.length > 0;
    if (mode === "files" && hasFolders) {
      this.#ensureFiles();
      void this.#queryFiles(text);
    } else if (mode === "workspaceSymbols" && hasFolders) {
      this.#ensureFiles();
      this.#ensureSymbols();
      void this.#querySymbols(text);
    } else if (mode === "symbols") {
      this.#ensureOutline(editor);
    }
  }

  close(): void {
    this.#closed = true;
    clearTimeout(this.#retryTimer);
    if (this.#filesOpened) {
      void api.fileSearchClose().catch(() => {});
    }
  }

  #fail(cause: unknown): void {
    if (!this.#closed) {
      this.error = errorMessage(cause);
    }
  }

  /** The file index starts (or is reused) the first time a mode needs it. */
  #ensureFiles(): void {
    if (this.#filesOpened) {
      return;
    }
    this.#filesOpened = true;
    const progress = new Channel<FileSearchProgress>();
    progress.onmessage = (update) => {
      if (this.#closed) {
        return;
      }
      this.fileIndex = update;
      const now = this.current();
      if (now.mode === "files") {
        void this.#queryFiles(now.text);
      }
    };
    api
      .fileSearchOpen(this.#roots, progress)
      .then((update) => {
        // Progress messages can overtake this answer; they are newer.
        if (!this.#closed && this.fileIndex === null) {
          this.fileIndex = update;
        }
      })
      .catch((cause) => this.#fail(cause));
  }

  #ensureSymbols(): void {
    if (this.#symbolsOpened) {
      return;
    }
    this.#symbolsOpened = true;
    const progress = new Channel<SymbolSearchProgress>();
    progress.onmessage = (update) => {
      if (this.#closed) {
        return;
      }
      this.symbolIndex = update;
      const now = this.current();
      if (now.mode === "workspaceSymbols") {
        void this.#querySymbols(now.text);
      }
    };
    api
      .symbolSearchOpen(this.#roots, progress)
      .then((update) => {
        if (!this.#closed && this.symbolIndex === null) {
          this.symbolIndex = update;
        }
      })
      .catch((cause) => this.#fail(cause));
  }

  /** Keeps results growing while an index builds, even if a progress message is missed. */
  #retryWhile(mode: "files" | "workspaceSymbols", text: string, run: (text: string) => Promise<void>): void {
    clearTimeout(this.#retryTimer);
    this.#retryTimer = setTimeout(() => {
      const now = this.current();
      if (!this.#closed && now.mode === mode && now.text === text) {
        void run(text);
      }
    }, RETRY_MS);
  }

  async #queryFiles(text: string): Promise<void> {
    const id = ++this.#requests.files;
    if (splitLocation(text).text === "") {
      this.files = [];
      return;
    }
    try {
      const results = await api.fileSearchQuery(this.#roots, text, FILE_LIMIT);
      if (id !== this.#requests.files || this.#closed) {
        return;
      }
      this.files = resultRows(results.items, this.folders());
      this.fileIndex = { indexed: results.indexed, done: results.done, truncated: results.truncated };
      this.error = null;
      if (!results.done) {
        this.#retryWhile("files", text, (next) => this.#queryFiles(next));
      }
    } catch (cause) {
      if (id === this.#requests.files) {
        this.#fail(cause);
      }
    }
  }

  async #querySymbols(text: string): Promise<void> {
    const id = ++this.#requests.symbols;
    if (text === "") {
      this.symbols = [];
      return;
    }
    try {
      const results = await api.symbolSearchQuery(this.#roots, text, "all", SYMBOL_LIMIT);
      if (id !== this.#requests.symbols || this.#closed) {
        return;
      }
      this.symbols = symbolRows(results.items, this.folders());
      const { files, symbols, done, truncated } = results;
      this.symbolIndex = { files, symbols, done, truncated };
      this.error = null;
      if (!results.done) {
        this.#retryWhile("workspaceSymbols", text, (next) => this.#querySymbols(next));
      }
    } catch (cause) {
      if (id === this.#requests.symbols) {
        this.#fail(cause);
      }
    }
  }

  /** The "@" list is read once per popup, from the editor's text (unsaved edits included). */
  #ensureOutline(editor: { view: EditorView; filePath: string | null } | null): void {
    if (this.#outlineRequested || !editor?.filePath) {
      return;
    }
    this.#outlineRequested = true;
    const doc = editor.view.state.doc;
    if (doc.length > MAX_OUTLINE_CHARS) {
      this.outline = { items: [], supported: true, truncated: true };
      return;
    }
    api
      .documentSymbols(editor.filePath, doc.toString())
      .then((result) => {
        if (!this.#closed) {
          this.outline = result;
        }
      })
      .catch((cause) => {
        if (!this.#closed) {
          this.outline = { items: [], supported: true, truncated: false };
          this.error = errorMessage(cause);
        }
      });
  }
}
