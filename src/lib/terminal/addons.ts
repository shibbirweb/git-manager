// The optional xterm addons of one terminal: search, the WebGL renderer and
// Unicode 11 widths. Each is imported the first time it is needed (its own
// chunk), so a setting that is off costs nothing, and turning it off disposes
// the addon so its memory (WebGL textures, search highlights) is freed.

import type { SearchAddon } from "@xterm/addon-search";
import type { WebglAddon } from "@xterm/addon-webgl";
import type { IDisposable, Terminal } from "@xterm/xterm";
import { FIND_HIGHLIGHT_LIMIT, type FindResults } from "./find";
import type { TerminalDrawing } from "./gpuStatus";

export class TerminalAddons {
  private search: SearchAddon | null = null;
  private searchLoad: Promise<SearchAddon | null> | null = null;
  private searchResults: IDisposable | null = null;
  private webgl: WebglAddon | null = null;
  private webglWanted = false;
  /** WebGL failed or lost its context: this terminal stays on the DOM renderer until the setting is turned on again. */
  private webglBroken = false;
  private unicode11Registered = false;
  private unicode11Wanted = false;
  private disposed = false;

  constructor(
    private readonly term: Terminal,
    private readonly onResults: (results: FindResults) => void,
    /** Reports which renderer draws this terminal, for the memory popup. */
    private readonly onDrawing: (drawing: TerminalDrawing) => void = () => undefined,
  ) {}

  /** The search addon, imported on first use. */
  loadSearch(): Promise<SearchAddon | null> {
    if (this.search) {
      return Promise.resolve(this.search);
    }
    if (!this.searchLoad) {
      this.searchLoad = import("@xterm/addon-search")
        .then(({ SearchAddon: Addon }) => {
          if (this.disposed) {
            return null;
          }
          const addon = new Addon({ highlightLimit: FIND_HIGHLIGHT_LIMIT });
          this.term.loadAddon(addon);
          this.searchResults = addon.onDidChangeResults((event) =>
            this.onResults({ resultIndex: event?.resultIndex ?? -1, resultCount: event?.resultCount ?? 0 }),
          );
          this.search = addon;
          return addon;
        })
        .catch(() => null)
        .finally(() => {
          this.searchLoad = null;
        });
    }
    return this.searchLoad;
  }

  /** Find was turned off: the addon and its highlights go. */
  disposeSearch(): void {
    this.searchResults?.dispose();
    this.searchResults = null;
    this.search?.dispose();
    this.search = null;
  }

  get searchAddon(): SearchAddon | null {
    return this.search;
  }

  /**
   * GPU rendering on or off. Off (or a failure) leaves xterm's DOM renderer,
   * which takes over by itself once the WebGL addon is disposed.
   */
  async setWebgl(enabled: boolean): Promise<void> {
    if (!enabled) {
      this.webglWanted = false;
      this.webglBroken = false;
      this.disposeWebgl();
      this.onDrawing("normal");
      return;
    }
    if (this.webglWanted || this.webglBroken) {
      return;
    }
    this.webglWanted = true;
    let Addon: typeof WebglAddon;
    try {
      ({ WebglAddon: Addon } = await import("@xterm/addon-webgl"));
    } catch {
      this.webglBroken = true;
      this.onDrawing("fallback");
      return;
    }
    if (this.disposed || !this.webglWanted || this.webgl) {
      return;
    }
    try {
      const addon = new Addon();
      // Too many contexts, a GPU reset or sleep can lose it: fall back for good, like VS Code.
      addon.onContextLoss(() => {
        this.webglBroken = true;
        this.disposeWebgl();
        this.onDrawing("fallback");
      });
      this.term.loadAddon(addon);
      this.webgl = addon;
      this.onDrawing("gpu");
    } catch {
      // No WebGL2 here: the DOM renderer stays.
      this.webglBroken = true;
      this.onDrawing("fallback");
    }
  }

  private disposeWebgl(): void {
    const addon = this.webgl;
    this.webgl = null;
    try {
      addon?.dispose();
    } catch {
      // A lost context can fail to clean up; the DOM renderer is back either way.
    }
  }

  /** Unicode 11 widths on or off; the switch affects output printed after it. */
  async setUnicode11(enabled: boolean): Promise<void> {
    this.unicode11Wanted = enabled;
    if (!enabled) {
      if (this.unicode11Registered) {
        this.term.unicode.activeVersion = "6";
      }
      return;
    }
    if (!this.unicode11Registered) {
      try {
        const { Unicode11Addon } = await import("@xterm/addon-unicode11");
        if (this.disposed || this.unicode11Registered) {
          return;
        }
        this.term.loadAddon(new Unicode11Addon());
        this.unicode11Registered = true;
      } catch {
        return;
      }
    }
    if (this.unicode11Wanted) {
      this.term.unicode.activeVersion = "11";
    }
  }

  dispose(): void {
    this.disposed = true;
    this.disposeSearch();
    this.webglWanted = false;
    this.disposeWebgl();
  }
}
