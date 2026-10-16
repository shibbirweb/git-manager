// One terminal view's life: loading xterm and opening it in the screen's host, its shell (TerminalShell), fitting
// the grid, Retry, the bell, files dropped from Finder, find, file links and the right-click menu. TerminalView.svelte
// creates one per terminal and keeps the effects that follow settings, visibility and requests.
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { usageStore } from "$lib/ai/usageStore.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { contextMenu } from "$lib/ui/menu.svelte";
import { platformName } from "$lib/update/releases";
import type { TerminalAddons } from "./addons";
import {
  dropText,
  TERMINAL_DRAG_EVENT,
  TERMINAL_DROP_EVENT,
  type TerminalDragDetail,
  type TerminalDropDetail,
} from "./dropPaths";
import { gpuRenderers } from "./gpuRenderers.svelte";
import type { TerminalDisplayOptions } from "./options";
import { handleTerminalKey, terminalMenu } from "./terminalActions";
import { TerminalFind } from "./terminalFind.svelte";
import { openTerminal } from "./terminalInstance";
import { TerminalFileLinks } from "./terminalLinks";
import { TerminalShell } from "./terminalShell.svelte";
import { terminalStore, type TerminalEntry } from "./terminalStore.svelte";

const RESIZE_DELAY_MS = 40;

export interface TerminalViewState {
  terminal: () => TerminalEntry;
  /** On screen: the panel's active terminal while the panel is open, or the active terminal tab. */
  visible: () => boolean;
  options: () => TerminalDisplayOptions;
  focusFindBar: () => void;
}

export class TerminalController {
  readonly isMac = platformName(navigator.userAgent) === "macOS";
  term = $state.raw<Terminal | null>(null);
  /** Each bell adds one; TerminalScreen flashes and ignores bells during a flash (binary output rings thousands). */
  bellCount = $state(0);
  /** Files from Finder are being dragged over this terminal. */
  dropOver = $state(false);
  /** Search, WebGL and Unicode 11, each loaded only while its setting is on. */
  addons: TerminalAddons | null = null;
  readonly shell: TerminalShell;
  readonly find: TerminalFind;
  readonly links: TerminalFileLinks;
  private fitAddon: FitAddon | null = null;
  private host: HTMLDivElement | null = null;
  private observer: ResizeObserver | null = null;
  private stopOpened: (() => void) | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;
  /** The folder the shell last reported with OSC 7; null until it does. */
  private reportedFolder: string | null = null;

  constructor(private readonly view: TerminalViewState) {
    this.shell = new TerminalShell(view.terminal, () => this.fitNow());
    this.find = new TerminalFind(
      () => this.addons,
      () => view.focusFindBar(),
      () => this.term?.focus(),
    );
    this.links = new TerminalFileLinks(this.isMac, () => this.reportedFolder ?? view.terminal().cwd);
  }

  /** The screen's host is in the page: listen for drops on the screen and start the terminal in the host. */
  mount(host: HTMLDivElement): () => void {
    this.host = host;
    const screen = host.parentElement;
    screen?.addEventListener(TERMINAL_DROP_EVENT, this.onDrop);
    screen?.addEventListener(TERMINAL_DRAG_EVENT, this.onDragOver);
    void this.start();
    return () => {
      screen?.removeEventListener(TERMINAL_DROP_EVENT, this.onDrop);
      screen?.removeEventListener(TERMINAL_DRAG_EVENT, this.onDragOver);
      this.dispose();
    };
  }

  private nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  /**
   * Loads xterm, opens it and starts the shell. Each heavy step waits for the next frame, so the panel and the
   * status paint before xterm builds its DOM and before the grid is measured.
   */
  async start(): Promise<void> {
    const shell = this.shell;
    shell.phase = "loading";
    shell.failure = null;
    let xterm: typeof import("./xterm");
    try {
      xterm = await import("./xterm");
    } catch (error) {
      if (!shell.disposed) {
        shell.fail(error);
      }
      return;
    }
    if (shell.disposed || !this.host) {
      return;
    }
    shell.phase = "starting";
    await this.nextFrame();
    const host = this.host;
    if (shell.disposed || !host) {
      return;
    }
    const terminal = this.view.terminal();
    // Rebuilt after Clear Cache: the old screen comes back, and a running shell is reconnected.
    const restore = terminalStore.takeRestore(terminal.key);
    if (restore && !restore.reattach && terminal.exited) {
      // Its exit note is part of the old screen.
      shell.exitShown = true;
    }
    const instance = this.open(xterm, host);
    await this.nextFrame();
    if (shell.disposed) {
      return;
    }
    this.fitNow();
    this.observer = new ResizeObserver(() => this.scheduleFit());
    this.observer.observe(host);
    if (restore?.snapshot) {
      instance.write(restore.snapshot);
    }
    if (restore?.reattach && terminal.terminalId !== null) {
      await shell.reattach(instance, terminal.terminalId);
    } else if (restore && terminal.exited) {
      shell.markReady();
      shell.phase = "ready";
    } else {
      await shell.spawn(instance);
    }
  }

  private open(xterm: typeof import("./xterm"), host: HTMLDivElement): Terminal {
    const terminal = this.view.terminal();
    const opened = openTerminal(xterm, host, {
      terminalKey: terminal.key,
      isMac: this.isMac,
      options: this.view.options(),
      onFindResults: (results) => (this.find.results = results),
      onKey: (instance, event) =>
        handleTerminalKey(instance, event, {
          isMac: this.isMac,
          canSplit: this.view.terminal().location === "panel",
          find: () => void this.find.show(instance),
          split: () => void terminalStore.split(terminal.key),
        }),
      onBell: () => this.ringBell(),
      onTitle: (title) => {
        // Finished or asking: its usage moved, and a hidden one marks its tab.
        if (this.view.terminal().agent && terminalStore.setAgentTitle(terminal.key, title)) {
          usageStore.refreshSoon();
          if (!this.view.visible()) {
            terminalStore.ring(terminal.key);
          }
        }
      },
      onFolder: (folder) => (this.reportedFolder = folder),
      onData: (data) => this.shell.send(data),
    });
    this.addons = opened.addons;
    this.fitAddon = opened.fit;
    this.stopOpened = opened.stop;
    this.term = opened.instance;
    return opened.instance;
  }

  /** Retry: loads xterm again if that failed, otherwise starts a new shell in the same view. */
  async retry(): Promise<void> {
    if (this.shell.disposed) {
      return;
    }
    terminalStore.restart(this.view.terminal().key);
    this.shell.reset();
    this.reportedFolder = null;
    const instance = this.term;
    if (!instance) {
      await this.start();
      return;
    }
    instance.options.disableStdin = false;
    instance.reset();
    await this.shell.spawn(instance);
    if (!this.shell.disposed && this.view.visible()) {
      instance.focus();
    }
  }

  scheduleFit(): void {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.fitNow(), RESIZE_DELAY_MS);
  }

  /** Fits the grid to the screen and tells the shell; skipped while hidden (zero size). */
  fitNow(): void {
    const { term, fitAddon, host } = this;
    if (!term || !fitAddon || !host || host.clientWidth === 0 || host.clientHeight === 0) {
      return;
    }
    const dims = fitAddon.proposeDimensions();
    if (!dims || !Number.isFinite(dims.cols) || !Number.isFinite(dims.rows) || dims.cols < 2 || dims.rows < 1) {
      return;
    }
    if (dims.cols !== term.cols || dims.rows !== term.rows) {
      term.resize(dims.cols, dims.rows);
    }
    this.shell.tellSize(term.cols, term.rows);
  }

  /** The visual bell: a flash when on screen, else a dot on the terminal's row until it shows. */
  private ringBell(): void {
    if (!settings.terminalVisualBell) {
      return;
    }
    if (!this.view.visible()) {
      terminalStore.ring(this.view.terminal().key);
      return;
    }
    this.bellCount += 1;
  }

  /** Paths dropped from Finder (see TerminalHost): typed at the prompt, quoted for the shell. */
  private readonly onDrop = (event: Event): void => {
    this.dropOver = false;
    const detail = (event as CustomEvent<TerminalDropDetail>).detail;
    const instance = this.term;
    if (!instance || this.view.terminal().exited || !detail) {
      return;
    }
    const windows = platformName(navigator.userAgent) === "Windows";
    const text = dropText(detail.filePaths ?? [], windows ? "windows" : "posix");
    if (text) {
      instance.paste(text);
      instance.focus();
    }
  };

  private readonly onDragOver = (event: Event): void => {
    this.dropOver = (event as CustomEvent<TerminalDragDetail>).detail?.over === true;
  };

  openMenu(event: MouseEvent): void {
    const instance = this.term;
    if (instance) {
      const terminal = this.view.terminal();
      const more = terminalStore.menuItems(terminal.key);
      const find = () => void this.find.show(instance);
      contextMenu.open(event, terminalMenu(instance, { isMac: this.isMac, exited: terminal.exited, find, more }));
    }
  }

  private dispose(): void {
    this.shell.dispose();
    clearTimeout(this.resizeTimer);
    this.links.set(null, false);
    this.addons?.dispose();
    this.addons = null;
    gpuRenderers.forget(this.view.terminal().key);
    this.observer?.disconnect();
    this.stopOpened?.();
    this.term?.dispose();
    this.term = null;
    this.fitAddon = null;
  }
}
