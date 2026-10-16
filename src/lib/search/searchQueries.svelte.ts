// What Search Everywhere asks the backend: the file index (opened with the popup), the symbol index (the first
// time a tab needs it) and text searches that stream their results in batches. Each source keeps its results on
// screen until its next answer arrives, and only the latest answer of each query is shown.
import { Channel } from "@tauri-apps/api/core";
import { api, errorMessage } from "$lib/api";
import type { FolderRef } from "$lib/stores/workspacePaths";
import type {
  FileSearchProgress,
  SymbolScope,
  SymbolSearchProgress,
  TextSearchBatch,
  TextSearchOptions,
} from "$lib/types";
import { resultRows, type SearchRow, splitLocation } from "./fileSearchModel";
import { emptySource, type SourceResults } from "./popupRows";
import { type SearchTab, usesSymbols } from "./searchTabs";
import { symbolRows, type SymbolRow } from "./symbolSearchModel";
import { appendBatch, EMPTY_TEXT, nextSearchId, searchable, type TextResults } from "./textSearchModel";

const FILE_LIMIT = 50;
const SYMBOL_LIMIT = 50;
/** Re-run a query this often while an index is still building. */
const RETRY_MS = 250;

export class SearchQueries {
  recent = $state.raw<SearchRow[]>([]);
  files = $state.raw<SourceResults<SearchRow>>(emptySource());
  classes = $state.raw<SourceResults<SymbolRow>>(emptySource());
  members = $state.raw<SourceResults<SymbolRow>>(emptySource());
  symbols = $state.raw<SourceResults<SymbolRow>>(emptySource());
  text = $state.raw<TextResults>(EMPTY_TEXT);
  textRunning = $state(false);
  /** The query the shown file and symbol results answer. */
  shownQuery = $state("");
  fileIndex = $state.raw<FileSearchProgress | null>(null);
  symbolIndex = $state.raw<SymbolSearchProgress | null>(null);
  error = $state<string | null>(null);

  readonly #requests = { files: 0, classes: 0, members: 0, symbols: 0 };
  #textSearchId = 0;
  #retryTimer: ReturnType<typeof setTimeout> | undefined;
  #symbolsOpened = false;
  closed = false;

  /** `current` is the tab, query and text options on screen now. */
  constructor(
    private readonly folders: () => FolderRef[],
    private readonly current: () => { tab: SearchTab; query: string; textOptions: TextSearchOptions },
    initialQuery: string,
  ) {
    this.shownQuery = initialQuery;
  }

  get #roots(): string[] {
    return this.folders().map((folder) => folder.root);
  }

  #fail(cause: unknown): void {
    if (!this.closed) {
      this.error = errorMessage(cause);
    }
  }

  /** Starts (or reuses) the file index without waiting: the field is already usable. */
  open(): void {
    const progress = new Channel<FileSearchProgress>();
    progress.onmessage = (update) => {
      if (this.closed) {
        return;
      }
      this.fileIndex = update;
      const now = this.current();
      if (now.tab !== "text" && splitLocation(now.query).text !== "") {
        void this.run();
      }
    };
    api
      .fileSearchOpen(this.#roots, progress)
      .then((update) => {
        // Progress messages can overtake this answer; they are newer.
        if (!this.closed && this.fileIndex === null) {
          this.fileIndex = update;
        }
      })
      .catch((cause) => this.#fail(cause));
    void this.run();
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.#retryTimer);
    void api.fileSearchClose().catch(() => {});
  }

  /** The symbol index starts the first time a tab needs it. */
  #ensureSymbols(): void {
    if (this.#symbolsOpened) {
      return;
    }
    this.#symbolsOpened = true;
    const progress = new Channel<SymbolSearchProgress>();
    progress.onmessage = (update) => {
      if (this.closed) {
        return;
      }
      this.symbolIndex = update;
      const now = this.current();
      if (usesSymbols(now.tab) && splitLocation(now.query).text !== "") {
        void this.run();
      }
    };
    api
      .symbolSearchOpen(this.#roots, progress)
      .then((update) => {
        if (!this.closed && this.symbolIndex === null) {
          this.symbolIndex = update;
        }
      })
      .catch((cause) => this.#fail(cause));
  }

  /** Runs the current tab's queries; only the latest answer of each is shown. */
  async run(): Promise<void> {
    clearTimeout(this.#retryTimer);
    const { tab, query } = this.current();
    if (tab === "text") {
      this.runText();
      return;
    }
    if (usesSymbols(tab)) {
      this.#ensureSymbols();
    }
    if (splitLocation(query).text === "") {
      this.shownQuery = query;
      return;
    }
    const work: Promise<boolean>[] = [];
    if (tab === "all" || tab === "files") {
      work.push(this.#queryFiles(query));
    }
    if (tab === "all" || tab === "classes") {
      work.push(this.#querySymbols(query, "classes"));
    }
    if (tab === "all") {
      work.push(this.#querySymbols(query, "members"));
    }
    if (tab === "symbols") {
      work.push(this.#querySymbols(query, "all"));
    }
    const building = await Promise.all(work);
    if (this.closed || query !== this.current().query) {
      return;
    }
    if (building.some(Boolean)) {
      // Keeps results growing while indexing even if a progress message is missed.
      this.#retryTimer = setTimeout(() => void this.run(), RETRY_MS);
    }
  }

  /** Resolves to whether the file index is still building. */
  async #queryFiles(query: string): Promise<boolean> {
    const id = ++this.#requests.files;
    try {
      const results = await api.fileSearchQuery(this.#roots, query, FILE_LIMIT);
      if (id !== this.#requests.files || this.closed) {
        return false;
      }
      this.files = { rows: resultRows(results.items, this.folders()), matched: results.matched };
      this.fileIndex = { indexed: results.indexed, done: results.done, truncated: results.truncated };
      this.shownQuery = query;
      this.error = null;
      return !results.done;
    } catch (cause) {
      if (id === this.#requests.files) {
        this.#fail(cause);
      }
      return false;
    }
  }

  /** Resolves to whether the symbol index is still building. */
  async #querySymbols(query: string, scope: SymbolScope): Promise<boolean> {
    const source = scope === "classes" ? "classes" : scope === "members" ? "members" : "symbols";
    const id = ++this.#requests[source];
    try {
      const results = await api.symbolSearchQuery(this.#roots, query, scope, SYMBOL_LIMIT);
      if (id !== this.#requests[source] || this.closed) {
        return false;
      }
      this[source] = { rows: symbolRows(results.items, this.folders()), matched: results.matched };
      const { files, symbols, done, truncated } = results;
      this.symbolIndex = { files, symbols, done, truncated };
      this.shownQuery = query;
      this.error = null;
      return !results.done;
    } catch (cause) {
      if (id === this.#requests[source]) {
        this.#fail(cause);
      }
      return false;
    }
  }

  /** Starts a text search, stopping the previous one; its results stream in batches. */
  runText(): void {
    const { query, textOptions } = this.current();
    const options = { ...textOptions };
    const searchId = nextSearchId();
    this.#textSearchId = searchId;
    if (!searchable(query)) {
      this.textRunning = false;
      this.text = EMPTY_TEXT;
      void api.textSearchCancel(searchId).catch(() => {});
      return;
    }
    this.textRunning = true;
    let first = true;
    const results = new Channel<TextSearchBatch>();
    results.onmessage = (batch) => {
      if (this.closed || searchId !== this.#textSearchId) {
        return;
      }
      // The old results stay until the new search has something to show.
      this.text = appendBatch(this.text, batch, this.folders(), first);
      first = false;
      if (batch.done) {
        this.textRunning = false;
      }
    };
    api.textSearch(this.#roots, searchId, query, options, results).catch((cause) => {
      if (!this.closed && searchId === this.#textSearchId) {
        this.textRunning = false;
        this.text = { ...EMPTY_TEXT, error: errorMessage(cause) };
      }
    });
  }

  /** Leaving the Text tab: nothing shows a running search's results any more. */
  stopText(): void {
    if (this.textRunning) {
      this.#textSearchId = nextSearchId();
      this.textRunning = false;
      void api.textSearchCancel(this.#textSearchId).catch(() => {});
    }
  }
}
