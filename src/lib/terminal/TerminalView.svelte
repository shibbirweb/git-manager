<!--
  One terminal: an xterm.js view wired to a shell in the backend. It stays mounted while hidden or moved (TerminalHost
  moves its element), so its scrollback survives switching and moving between the panel and the editor.
-->
<script lang="ts">
  import { Channel } from "@tauri-apps/api/core";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import type { FitAddon } from "@xterm/addon-fit";
  import type { IBufferCell, IDisposable, ILink, ILinkDecorations, Terminal } from "@xterm/xterm";
  import { onMount, tick, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import type { TerminalOutputMessage } from "$lib/types";
  import { platformName } from "$lib/update/releases";
  import type { TerminalAddons } from "./addons";
  import { dropText, TERMINAL_DRAG_EVENT, TERMINAL_DROP_EVENT, type TerminalDragDetail, type TerminalDropDetail } from "./dropPaths";
  import { type CellText, FileExistenceCache, type FileLink, fileLinksForLine, lineCells, parseOsc7 } from "./fileLinks";
  import {
    DEFAULT_FIND_OPTIONS,
    findCounterText,
    findDecorations,
    findQueryError,
    type FindResults,
    searchOptions,
    type TerminalFindOptions,
  } from "./find";
  import TerminalFindBar from "./TerminalFindBar.svelte";
  import { terminalKeyAction } from "./keys";
  import { terminalAppKeySet } from "$lib/commands/commandRuntime";
  import { gpuRenderers } from "./gpuRenderers.svelte";
  import { applyChangedOptions, changesMetrics, terminalAddonPlan, terminalDisplayOptions } from "./options";
  import { isExitMessage, OutputAcks } from "./outputFlow";
  import { terminalStore, type TerminalEntry } from "./terminalStore.svelte";
  import { runFinishedMessage, runHeader } from "./runs";
  import { exitMessage, QUIET_SHELL_MS, shellNameFor, startupFailureTitle, startupLabel, type StartupPhase } from "./terminals";
  import type { TerminalPlacement } from "./terminalTabs";
  import { currentTerminalTheme, watchTheme } from "./theme";

  interface Props {
    terminal: TerminalEntry;
    /** On screen: the panel's active terminal while the panel is open, or the active terminal tab. */
    visible: boolean;
    /** Where the element sits now; a move re-measures the grid. */
    placement: TerminalPlacement;
  }

  let { terminal, visible, placement }: Props = $props();

  const RESIZE_DELAY_MS = 40;
  /** How long the visual bell flashes. */
  const BELL_FLASH_MS = 180;
  const isMac = platformName(navigator.userAgent) === "macOS";

  let root = $state<HTMLDivElement | null>(null);
  let host = $state<HTMLDivElement | null>(null);
  let term = $state.raw<Terminal | null>(null);
  let fit: FitAddon | null = null;
  let terminalId: number | null = null;
  /** Typed before the shell was ready; sent once it is. */
  let pendingInput = "";
  let sentSize = { cols: 0, rows: 0 };
  let exitShown = false;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  /** A mouse button is down in the terminal: copy on select waits for the drag to end. */
  let mouseSelecting = false;
  let copyOnSelectFailed = false;

  /** Startup progress, shown over the empty terminal until the shell prints something. */
  let phase = $state<StartupPhase>("loading");
  /** Why xterm or the shell could not start, shown with Retry. */
  let failure = $state<string | null>(null);
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let observer: ResizeObserver | null = null;
  let stopTheme: (() => void) | null = null;
  /** Stops offering this terminal's screen to Clear Cache. */
  let stopSnapshot: (() => void) | null = null;
  /** Output of the current shell and its acks; a retry gets new ones. */
  let channel: Channel<TerminalOutputMessage> | null = null;
  let acks: OutputAcks | null = null;
  /** Search, WebGL and Unicode 11, each loaded only while its setting is on. */
  let addons: TerminalAddons | null = null;
  /** The file path link provider and what it knows about the files on screen. */
  let linkProvider: IDisposable | null = null;
  let linkScroll: IDisposable | null = null;
  let linkCache: FileExistenceCache | null = null;
  /** The decorations of the file link under the pointer: underlined only while Cmd (Ctrl) is held. */
  let hoveredLink: ILinkDecorations | null = null;
  /** The folder the shell last reported with OSC 7; null until it does. */
  let reportedFolder: string | null = null;

  let findBar = $state<ReturnType<typeof TerminalFindBar> | null>(null);
  let findOpen = $state(false);
  let findQuery = $state("");
  let findOptions = $state<TerminalFindOptions>({ ...DEFAULT_FIND_OPTIONS });
  let findResults = $state.raw<FindResults | null>(null);
  let bellFlash = $state(false);
  /** A flash is on its way or showing: more bells until it ends are ignored (binary output can ring thousands of times). */
  let bellPending = false;
  let bellTimer: ReturnType<typeof setTimeout> | undefined;
  /** Files from Finder are being dragged over this terminal. */
  let dropOver = $state(false);

  const displayOptions = $derived(terminalDisplayOptions(settings, terminal.exited));
  const shellName = $derived(terminal.run ? terminal.run.program : shellNameFor(terminal.shellId, terminalStore.shells));
  const statusLabel = $derived(startupLabel(phase, shellName));
  const addonPlan = $derived(terminalAddonPlan(settings));
  const findError = $derived(findQueryError(findQuery, findOptions));
  const findCounter = $derived(findCounterText(findQuery, findResults, findError));
  const findProblem = $derived(findError !== null || (findQuery !== "" && findResults?.resultCount === 0));

  onMount(() => {
    root?.addEventListener(TERMINAL_DROP_EVENT, onDrop);
    root?.addEventListener(TERMINAL_DRAG_EVENT, onDragOver);
    void startTerminal();
    return () => {
      disposed = true;
      clearTimeout(resizeTimer);
      clearTimeout(readyTimer);
      clearTimeout(bellTimer);
      root?.removeEventListener(TERMINAL_DROP_EVENT, onDrop);
      root?.removeEventListener(TERMINAL_DRAG_EVENT, onDragOver);
      setFileLinks(null, false);
      addons?.dispose();
      addons = null;
      gpuRenderers.forget(terminal.key);
      observer?.disconnect();
      stopTheme?.();
      stopSnapshot?.();
      host?.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      stopOutput();
      term?.dispose();
      term = null;
      fit = null;
    };
  });

  function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  /**
   * Loads xterm, opens it and starts the shell. Each heavy step waits for the
   * next frame, so the panel and the status paint before xterm builds its DOM
   * and before the grid is measured.
   */
  async function startTerminal(): Promise<void> {
    phase = "loading";
    failure = null;
    let xterm: typeof import("./xterm");
    try {
      xterm = await import("./xterm");
    } catch (error) {
      if (!disposed) {
        fail(error);
      }
      return;
    }
    if (disposed || !host) {
      return;
    }
    phase = "starting";
    await nextFrame();
    if (disposed || !host) {
      return;
    }
    // Rebuilt after Clear Cache: the old screen comes back, and a running shell is reconnected.
    const restore = terminalStore.takeRestore(terminal.key);
    if (restore && !restore.reattach && terminal.exited) {
      // Its exit note is part of the old screen.
      exitShown = true;
    }
    const instance = createInstance(xterm, host);
    term = instance;
    await nextFrame();
    if (disposed) {
      return;
    }
    fitNow();
    observer = new ResizeObserver(() => scheduleFit());
    observer.observe(host);
    if (restore?.snapshot) {
      instance.write(restore.snapshot);
    }
    if (restore?.reattach && terminal.terminalId !== null) {
      await reattachShell(instance, terminal.terminalId);
    } else if (restore && terminal.exited) {
      markReady();
      phase = "ready";
    } else {
      await spawnShell(instance);
    }
  }

  function createInstance(xterm: typeof import("./xterm"), hostElement: HTMLDivElement): Terminal {
    const instance = new xterm.Terminal({
      ...displayOptions,
      theme: currentTerminalTheme(),
      // Keeps colored output readable in both themes.
      minimumContrastRatio: 4.5,
      // Unicode versions and the search highlights are xterm's proposed API.
      allowProposedApi: true,
    });
    const drawingKey = terminal.key;
    gpuRenderers.set(drawingKey, "normal");
    addons = new xterm.TerminalAddons(
      instance,
      (results) => {
        findResults = results;
      },
      (drawing) => gpuRenderers.set(drawingKey, drawing),
    );
    fit = new xterm.FitAddon();
    instance.loadAddon(fit);
    // Cmd+click (Ctrl+click elsewhere) opens a link.
    instance.loadAddon(
      new xterm.WebLinksAddon((event, uri) => {
        if (isMac ? event.metaKey : event.ctrlKey) {
          void openUrl(uri).catch((error) => toast.error("Could not open the link", errorMessage(error)));
        }
      }),
    );
    instance.attachCustomKeyEventHandler((event) => handleKey(instance, event));
    instance.onBell(() => ringBell());
    // Shells with integration report their folder after each cd (OSC 7); file links resolve against it.
    instance.parser.registerOscHandler(7, (data) => {
      reportedFolder = parseOsc7(data) ?? reportedFolder;
      return true;
    });
    instance.onData((data) => sendInput(data));
    instance.onSelectionChange(() => {
      // Keyboard and double-click selections copy now; a drag copies on mouseup.
      if (!mouseSelecting) {
        copyOnSelect(instance);
      }
    });
    instance.open(hostElement);
    stopSnapshot = terminalStore.registerSnapshot(terminal.key, async () => {
      const { SerializeAddon } = await import("@xterm/addon-serialize");
      const serializer = new SerializeAddon();
      instance.loadAddon(serializer);
      try {
        return serializer.serialize();
      } finally {
        serializer.dispose();
      }
    });
    stopTheme = watchTheme(() => {
      instance.options.theme = currentTerminalTheme();
    });
    hostElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    return instance;
  }

  /** The previous shell's output is no longer shown; it is still acked, so nothing waits on this view. */
  function stopOutput(): void {
    const shellAcks = acks;
    if (channel) {
      channel.onmessage = (message) => {
        if (message instanceof ArrayBuffer) {
          shellAcks?.received(message.byteLength);
        }
      };
    }
    shellAcks?.stop();
    channel = null;
    acks = null;
  }

  async function spawnShell(instance: Terminal): Promise<void> {
    const terminalKey = terminal.key;
    phase = "starting";
    stopOutput();
    const shellChannel = new Channel<TerminalOutputMessage>();
    const shellAcks = new OutputAcks();
    // The exit is the last message, after every byte of output, so its note lands below the output.
    shellChannel.onmessage = (message) => {
      if (isExitMessage(message)) {
        terminalStore.exited(terminalKey, message.exit ?? null);
        return;
      }
      if (phase === "starting") {
        markReady();
      }
      const bytes = new Uint8Array(message);
      shellAcks.received(bytes.byteLength);
      instance.write(bytes, () => shellAcks.written(bytes.byteLength));
    };
    channel = shellChannel;
    acks = shellAcks;
    let info;
    const run = terminal.run ?? null;
    try {
      if (run) {
        instance.write(runHeader(run));
        info = await api.runScript(
          { program: run.program, args: run.args, cwd: run.cwd, nodeBinDir: run.nodeBinDir, cols: instance.cols, rows: instance.rows },
          shellChannel,
        );
      } else {
        info = await api.terminalSpawn(
          { shellId: terminal.shellId, cwd: terminal.cwd, cols: instance.cols, rows: instance.rows },
          shellChannel,
        );
      }
    } catch (error) {
      if (!disposed) {
        fail(error);
      }
      return;
    }
    if (disposed || !terminalStore.attach(terminalKey, info)) {
      // Closed while the shell was starting.
      void api.terminalClose(info.terminalId).catch(() => undefined);
      return;
    }
    terminalId = info.terminalId;
    const ackedTerminalId = info.terminalId;
    shellAcks.connect((byteCount) => void api.terminalAck(ackedTerminalId, byteCount).catch(() => undefined));
    sentSize = { cols: instance.cols, rows: instance.rows };
    // The panel may have changed size while the shell started.
    fitNow();
    if (pendingInput) {
      sendInput(pendingInput);
      pendingInput = "";
    }
    if (phase === "starting") {
      // A shell that prints no prompt must not leave the status up.
      readyTimer = setTimeout(() => markReady(), QUIET_SHELL_MS);
    }
  }

  /** After Clear Cache: the shell kept running; its output since the restart comes first, then live output. */
  async function reattachShell(instance: Terminal, liveTerminalId: number): Promise<void> {
    const terminalKey = terminal.key;
    stopOutput();
    const shellChannel = new Channel<TerminalOutputMessage>();
    const shellAcks = new OutputAcks();
    shellChannel.onmessage = (message) => {
      if (isExitMessage(message)) {
        terminalStore.exited(terminalKey, message.exit ?? null);
        return;
      }
      const bytes = new Uint8Array(message);
      shellAcks.received(bytes.byteLength);
      instance.write(bytes, () => shellAcks.written(bytes.byteLength));
    };
    channel = shellChannel;
    acks = shellAcks;
    let connected = false;
    try {
      connected = await api.terminalReattach(liveTerminalId, shellChannel);
    } catch {
      connected = false;
    }
    if (disposed) {
      return;
    }
    if (!connected) {
      // Closed or timed out meanwhile: the old screen stays, with the usual note below it.
      terminalStore.exited(terminalKey, null);
      phase = "ready";
      return;
    }
    terminalId = liveTerminalId;
    shellAcks.connect((byteCount) => void api.terminalAck(liveTerminalId, byteCount).catch(() => undefined));
    // The new page's size may differ; the next fit tells the shell.
    sentSize = { cols: 0, rows: 0 };
    fitNow();
    phase = "ready";
  }

  function markReady(): void {
    clearTimeout(readyTimer);
    if (phase === "starting") {
      phase = "ready";
    }
  }

  function fail(error: unknown): void {
    clearTimeout(readyTimer);
    // The error is shown over the terminal, so no exit note is written behind it.
    exitShown = true;
    failure = errorMessage(error);
    phase = "failed";
    terminalStore.spawnFailed(terminal.key);
  }

  /** Retry: loads xterm again if that failed, otherwise starts a new shell in the same view. */
  async function retry(): Promise<void> {
    if (disposed) {
      return;
    }
    terminalStore.restart(terminal.key);
    exitShown = false;
    reportedFolder = null;
    failure = null;
    terminalId = null;
    const instance = term;
    if (!instance) {
      await startTerminal();
      return;
    }
    instance.options.disableStdin = false;
    instance.reset();
    await spawnShell(instance);
    if (!disposed && visible) {
      instance.focus();
    }
  }

  function sendInput(data: string): void {
    if (terminal.exited) {
      return;
    }
    if (terminalId === null) {
      pendingInput += data;
      return;
    }
    void api.terminalWrite(terminalId, data).catch(() => undefined);
  }

  /**
   * Keys for the app (Ctrl+`, Cmd shortcuts) return false so xterm leaves them
   * alone and they bubble to the window shortcuts unhandled.
   */
  function handleKey(instance: Terminal, event: KeyboardEvent): boolean {
    const action = terminalKeyAction(event, {
      isMac,
      hasSelection: instance.hasSelection(),
      findEnabled: settings.terminalFind,
      canSplit: terminal.location === "panel",
      appKeys: terminalAppKeySet(),
    });
    if (action === "shell") {
      return true;
    }
    if (event.type !== "keydown" || action === "app") {
      return false;
    }
    event.preventDefault();
    if (action === "copy") {
      void copySelection(instance);
    } else if (action === "paste") {
      void pasteClipboard(instance);
    } else if (action === "clear") {
      instance.clear();
    } else if (action === "selectAll") {
      instance.selectAll();
    } else if (action === "find") {
      void openFind(instance);
    } else if (action === "split") {
      void terminalStore.split(terminal.key);
    }
    return false;
  }

  /** Cmd+F: opens the find bar with a one-line selection as the query, loading the search addon the first time. */
  async function openFind(instance: Terminal): Promise<void> {
    if (!settings.terminalFind || !addons) {
      return;
    }
    const selection = instance.hasSelection() ? instance.getSelection() : "";
    if (selection && !selection.includes("\n") && selection.length <= 200) {
      findQuery = selection;
    }
    findOpen = true;
    await tick();
    findBar?.focus();
    const addon = await addons.loadSearch();
    if (addon && findOpen && findQuery) {
      runFind("previous", true);
    }
  }

  function readToken(token: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(token);
  }

  /** Searches up ("previous", toward older output) or down; typing searches again from the current match. */
  function runFind(direction: "previous" | "next", incremental = false): void {
    const addon = addons?.searchAddon ?? null;
    if (!addon) {
      return;
    }
    if (!findQuery || findQueryError(findQuery, findOptions)) {
      addon.clearDecorations();
      findResults = null;
      return;
    }
    const options = searchOptions(findOptions, findDecorations(readToken), incremental);
    if (direction === "previous") {
      addon.findPrevious(findQuery, options);
    } else {
      addon.findNext(findQuery, options);
    }
  }

  function setFindQuery(query: string): void {
    findQuery = query;
    runFind("previous", true);
  }

  function toggleFindOption(option: keyof TerminalFindOptions): void {
    findOptions = { ...findOptions, [option]: !findOptions[option] };
    runFind("previous", true);
  }

  /** Esc or x: the highlights go and the terminal takes the keys again. */
  function closeFind(refocus = true): void {
    if (!findOpen) {
      return;
    }
    findOpen = false;
    findResults = null;
    addons?.searchAddon?.clearDecorations();
    if (refocus) {
      term?.focus();
    }
  }

  /** The visual bell: a flash when on screen, else a dot on the terminal's row until it shows. */
  function ringBell(): void {
    if (!settings.terminalVisualBell) {
      return;
    }
    if (!visible) {
      terminalStore.ring(terminal.key);
      return;
    }
    if (bellPending) {
      return;
    }
    bellPending = true;
    requestAnimationFrame(() => {
      bellFlash = true;
      bellTimer = setTimeout(() => {
        bellFlash = false;
        bellPending = false;
      }, BELL_FLASH_MS);
    });
  }

  /** Paths dropped from Finder (see TerminalHost): typed at the prompt, quoted for the shell. */
  function onDrop(event: Event): void {
    dropOver = false;
    const detail = (event as CustomEvent<TerminalDropDetail>).detail;
    const instance = term;
    if (!instance || terminal.exited || !detail) {
      return;
    }
    const text = dropText(detail.filePaths ?? [], platformName(navigator.userAgent) === "Windows" ? "windows" : "posix");
    if (text) {
      instance.paste(text);
      instance.focus();
    }
  }

  function onDragOver(event: Event): void {
    dropOver = (event as CustomEvent<TerminalDragDetail>).detail?.over === true;
  }

  function workspaceRoots(): string[] {
    return (repoStore.workspace?.folders ?? []).map((folder) => folder.root);
  }

  function modifierHeld(event: MouseEvent | KeyboardEvent): boolean {
    return isMac ? event.metaKey : event.ctrlKey;
  }

  /** While a file link is hovered, pressing or releasing Cmd (Ctrl) shows or hides its underline. */
  function onLinkModifier(event: KeyboardEvent): void {
    if (hoveredLink) {
      const held = modifierHeld(event);
      hoveredLink.underline = held;
      hoveredLink.pointerCursor = held;
    }
  }

  function stopLinkHover(): void {
    hoveredLink = null;
    window.removeEventListener("keydown", onLinkModifier, true);
    window.removeEventListener("keyup", onLinkModifier, true);
  }

  /** Registers the file link provider on `instance`, or (null) removes it with its cache. */
  function setFileLinks(instance: Terminal | null, enabled: boolean): void {
    if (!instance || !enabled) {
      linkProvider?.dispose();
      linkProvider = null;
      linkScroll?.dispose();
      linkScroll = null;
      linkCache = null;
      stopLinkHover();
      return;
    }
    if (linkProvider) {
      return;
    }
    const cache = new FileExistenceCache((filePaths) => api.realFiles(workspaceRoots(), filePaths));
    linkCache = cache;
    // The cache only covers the lines on screen: scrolling shows others.
    linkScroll = instance.onScroll(() => cache.clear());
    linkProvider = instance.registerLinkProvider({
      provideLinks: (bufferLine, callback) => {
        void provideFileLinks(instance, cache, bufferLine).then(callback, () => callback(undefined));
      },
    });
  }

  async function provideFileLinks(instance: Terminal, cache: FileExistenceCache, bufferLine: number): Promise<ILink[] | undefined> {
    const line = instance.buffer.active.getLine(bufferLine - 1);
    if (!line) {
      return undefined;
    }
    const cells: CellText[] = [];
    let scratch: IBufferCell | undefined;
    for (let x = 0; x < line.length; x += 1) {
      scratch = line.getCell(x, scratch);
      cells.push({ chars: scratch?.getChars() ?? "", width: scratch?.getWidth() ?? 1 });
    }
    const { text, cellAt } = lineCells(cells);
    const links = await fileLinksForLine(text, {
      folderPath: reportedFolder ?? terminal.cwd,
      workspaceFolders: repoStore.workspace?.folders ?? [],
      cache,
    });
    if (links.length === 0 || linkCache !== cache) {
      return undefined;
    }
    return links.map((link) => xtermLink(link, bufferLine, cellAt));
  }

  function xtermLink(link: FileLink, bufferLine: number, cellAt: number[]): ILink {
    const startCell = cellAt[link.start] ?? 0;
    const endCell = cellAt[link.end - 1] ?? startCell;
    const decorations: ILinkDecorations = { underline: false, pointerCursor: false };
    return {
      range: { start: { x: startCell + 1, y: bufferLine }, end: { x: endCell + 1, y: bufferLine } },
      text: link.text,
      decorations,
      activate: (event) => {
        if (modifierHeld(event)) {
          const line = link.line === null ? null : link.line - 1;
          const column = link.column === null ? null : link.column - 1;
          void navigation.openFileAt(link.filePath, line, column, { pin: true });
        }
      },
      hover: (event) => {
        hoveredLink = decorations;
        decorations.underline = modifierHeld(event);
        decorations.pointerCursor = modifierHeld(event);
        window.addEventListener("keydown", onLinkModifier, true);
        window.addEventListener("keyup", onLinkModifier, true);
      },
      leave: () => {
        decorations.underline = false;
        decorations.pointerCursor = false;
        stopLinkHover();
      },
    };
  }

  async function copySelection(instance: Terminal): Promise<void> {
    const text = instance.getSelection();
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  async function pasteClipboard(instance: Terminal): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        instance.paste(text);
      }
    } catch (error) {
      toast.error("Could not paste", errorMessage(error));
    }
  }

  function onMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      mouseSelecting = true;
    }
  }

  /** On the window, so it runs after xterm finished the selection, even when released outside. */
  function onMouseUp(): void {
    if (!mouseSelecting) {
      return;
    }
    mouseSelecting = false;
    if (term) {
      copyOnSelect(term);
    }
  }

  /**
   * Copies the selection when Copy on selection is on. It runs inside the mouse
   * or key event, which WebKit needs for clipboard access; a failure is shown
   * once so a blocked clipboard does not toast on every selection.
   */
  function copyOnSelect(instance: Terminal): void {
    if (!settings.terminalCopyOnSelect || !instance.hasSelection()) {
      return;
    }
    const text = instance.getSelection();
    if (!text) {
      return;
    }
    navigator.clipboard.writeText(text).catch((error) => {
      if (!copyOnSelectFailed) {
        copyOnSelectFailed = true;
        toast.error("Could not copy the selection", errorMessage(error));
      }
    });
  }

  function scheduleFit(): void {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => fitNow(), RESIZE_DELAY_MS);
  }

  /** Fits the grid to the panel and tells the shell; skipped while hidden (zero size). */
  function fitNow(): void {
    if (!term || !fit || !host || host.clientWidth === 0 || host.clientHeight === 0) {
      return;
    }
    const dims = fit.proposeDimensions();
    if (!dims || !Number.isFinite(dims.cols) || !Number.isFinite(dims.rows) || dims.cols < 2 || dims.rows < 1) {
      return;
    }
    if (dims.cols !== term.cols || dims.rows !== term.rows) {
      term.resize(dims.cols, dims.rows);
    }
    if (terminalId !== null && !terminal.exited && (term.cols !== sentSize.cols || term.rows !== sentSize.rows)) {
      sentSize = { cols: term.cols, rows: term.rows };
      void api.terminalResize(terminalId, term.cols, term.rows).catch(() => undefined);
    }
  }

  // Terminal settings apply to open terminals right away; font changes re-fit
  // the grid so the shell learns the new size. A hidden terminal waits until it
  // shows: xterm's DOM renderer measures glyphs with offsetWidth, which is 0
  // under display: none, and would keep a wrong letter spacing.
  $effect(() => {
    const next = displayOptions;
    const instance = term;
    if (!instance || !visible) {
      return;
    }
    untrack(() => {
      const changed = applyChangedOptions(instance.options, next);
      if (changesMetrics(changed)) {
        scheduleFit();
      }
    });
  });

  // Optional parts follow their settings at once. Turning one off disposes it
  // even while hidden, to free its memory; WebGL waits until the terminal
  // shows, since its renderer measures the cells as it starts.
  $effect(() => {
    const plan = addonPlan;
    const instance = term;
    const shown = visible;
    if (!instance) {
      return;
    }
    untrack(() => {
      const current = addons;
      if (!current) {
        return;
      }
      if (!plan.webgl || shown) {
        void current.setWebgl(plan.webgl);
      }
      void current.setUnicode11(plan.unicode11);
      if (!plan.search) {
        closeFind(false);
        current.disposeSearch();
      }
      setFileLinks(instance, plan.fileLinks);
    });
  });

  // Hidden: everything received is acked, so a shell never waits on a view out of sight.
  $effect(() => {
    if (!visible) {
      untrack(() => acks?.flush());
    }
  });

  // A bell that rang out of sight is seen once the terminal shows.
  $effect(() => {
    if (visible && terminal.bell) {
      untrack(() => terminalStore.clearBell(terminal.key));
    }
  });

  // Fit when shown or moved between the panel and the editor. The move happens
  // in TerminalHost's effect, so the grid is measured on the next frame, once
  // the element sits in its new place with its new size; the rows are redrawn
  // because the DOM renderer may have skipped frames while detached.
  $effect(() => {
    void placement;
    const instance = term;
    if (!visible || !instance) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      fitNow();
      instance.refresh(0, instance.rows - 1);
    });
    return () => cancelAnimationFrame(frame);
  });

  // Focus on request (panel open, switching to it, opening its tab, a move),
  // as soon as it is on screen.
  $effect(() => {
    const request = terminalStore.focusRequest;
    const instance = term;
    if (!request || request.terminalKey !== terminal.key || !visible || !instance) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      fitNow();
      instance.focus();
    });
    return () => cancelAnimationFrame(frame);
  });

  // A hidden terminal must not keep keyboard focus, or typing would go to its shell unseen.
  $effect(() => {
    if (!visible && root?.contains(document.activeElement)) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  });

  // A shell that ended with an error stays open with a note; a clean exit closes it.
  // A run always ends with "Process finished with exit code N".
  $effect(() => {
    const instance = term;
    if (!instance || !terminal.exited) {
      return;
    }
    const exitCode = terminal.exitCode;
    const isRun = terminal.location === "run";
    untrack(() => {
      instance.options.disableStdin = true;
      if (exitShown || (exitCode === 0 && !isRun)) {
        return;
      }
      exitShown = true;
      instance.write(isRun ? runFinishedMessage(exitCode) : exitMessage(exitCode));
    });
  });

  function openMenu(event: MouseEvent): void {
    const instance = term;
    if (!instance) {
      return;
    }
    const items: MenuItem[] = [
      {
        label: "Copy",
        hint: isMac ? "Cmd+C" : "Ctrl+Shift+C",
        disabled: !instance.hasSelection(),
        action: () => void copySelection(instance),
      },
      {
        label: "Paste",
        hint: isMac ? "Cmd+V" : "Ctrl+Shift+V",
        disabled: terminal.exited,
        action: () => void pasteClipboard(instance),
      },
      { label: "Select All", hint: isMac ? "Cmd+A" : undefined, action: () => instance.selectAll() },
      { label: "Clear", hint: isMac ? "Cmd+K" : undefined, action: () => instance.clear() },
    ];
    if (settings.terminalFind) {
      items.push(
        { separator: true },
        { label: "Find...", hint: isMac ? "Cmd+F" : "Ctrl+Shift+F", action: () => void openFind(instance) },
      );
    }
    items.push({ separator: true }, ...terminalStore.menuItems(terminal.key));
    contextMenu.open(event, items);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={root}
  class="terminal-view"
  class:hidden={!visible}
  class:ligatures={settings.terminalLigatures}
  class:drop-over={dropOver}
  data-terminal-key={terminal.key}
  oncontextmenu={openMenu}
  onfocusin={() => terminalStore.focusPane(terminal.key)}
>
  <div class="xterm-host" bind:this={host}></div>
  {#if bellFlash}
    <div class="bell-flash" aria-hidden="true"></div>
  {/if}
  {#if findOpen}
    <TerminalFindBar
      bind:this={findBar}
      query={findQuery}
      options={findOptions}
      counter={findCounter}
      problem={findProblem}
      onQuery={setFindQuery}
      onToggle={toggleFindOption}
      onPrevious={() => runFind("previous")}
      onNext={() => runFind("next")}
      onClose={() => closeFind()}
    />
  {/if}
  {#if phase === "failed"}
    <div class="status failed" role="alert">
      <Icon name="alert" size={16} />
      <strong>{startupFailureTitle(term !== null, shellName)}</strong>
      {#if failure}
        <span class="detail selectable">{failure}</span>
      {/if}
      <button class="btn small" onclick={() => void retry()}>Retry</button>
    </div>
  {:else if statusLabel}
    <div class="status" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      {statusLabel}
    </div>
  {/if}
</div>

<style>
  .terminal-view {
    position: absolute;
    inset: 0;
    background: var(--editor-bg);
    overflow: hidden;
  }

  /* Its own stacking context, so xterm's layers (search highlights, the WebGL canvas) stay under the find bar. */
  .xterm-host {
    position: absolute;
    inset: 0;
    z-index: 0;
    padding: 4px 0 2px 12px;
    overflow: hidden;
  }

  .status {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--text-dim);
    font-size: 12px;
    pointer-events: none;
  }

  .status.failed {
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    background: var(--editor-bg);
    color: var(--text);
    text-align: center;
    pointer-events: auto;
  }

  .status.failed :global(svg) {
    color: var(--danger);
  }

  .detail {
    max-width: 520px;
    color: var(--text-dim);
    overflow-wrap: anywhere;
  }

  .status.failed .btn {
    margin-top: 4px;
  }

  .spinner {
    flex: none;
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .terminal-view.hidden {
    display: none;
  }

  /* Files from Finder over the terminal: an inset outline, like the Files panel's drop target. */
  .terminal-view.drop-over::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    border: 2px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    pointer-events: none;
  }

  .bell-flash {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: var(--text);
    opacity: 0;
    pointer-events: none;
    animation: bell 180ms ease-out;
  }

  @keyframes bell {
    from {
      opacity: 0.12;
    }
    to {
      opacity: 0;
    }
  }

  .terminal-view :global(.xterm) {
    height: 100%;
  }

  /*
   * Ligatures are CSS on the rows: xterm's DOM renderer puts runs of equally
   * styled characters in one span, so WebKit can join them. WebKit turns them
   * on by default, so off is set explicitly.
   */
  .terminal-view :global(.xterm-rows) {
    font-variant-ligatures: none;
    font-feature-settings: "liga" 0, "calt" 0;
  }

  .terminal-view.ligatures :global(.xterm-rows) {
    font-variant-ligatures: common-ligatures contextual;
    font-feature-settings: "liga" 1, "calt" 1;
  }
</style>
