<!--
  One terminal: an xterm.js view wired to a shell in the backend. It stays mounted while hidden or moved (TerminalHost
  moves its element), so its scrollback survives switching and moving between the panel and the editor.
-->
<script lang="ts">
  import { Channel } from "@tauri-apps/api/core";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import type { FitAddon } from "@xterm/addon-fit";
  import type { Terminal } from "@xterm/xterm";
  import { onMount, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { settings } from "$lib/stores/settings.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { platformName } from "$lib/update/releases";
  import { terminalKeyAction } from "./keys";
  import { applyChangedOptions, changesMetrics, terminalDisplayOptions } from "./options";
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
  /** Lets output that is still on its way land before the exit note. */
  const EXIT_NOTE_DELAY_MS = 200;
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
  /** Output of the current shell; a retry gets a new one. */
  let channel: Channel<ArrayBuffer> | null = null;

  const displayOptions = $derived(terminalDisplayOptions(settings, terminal.exited));
  const shellName = $derived(terminal.run ? terminal.run.program : shellNameFor(terminal.shellId, terminalStore.shells));
  const statusLabel = $derived(startupLabel(phase, shellName));

  onMount(() => {
    void startTerminal();
    return () => {
      disposed = true;
      clearTimeout(resizeTimer);
      clearTimeout(readyTimer);
      observer?.disconnect();
      stopTheme?.();
      host?.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      if (channel) {
        channel.onmessage = () => undefined;
      }
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
    const instance = createInstance(xterm, host);
    term = instance;
    await nextFrame();
    if (disposed) {
      return;
    }
    fitNow();
    observer = new ResizeObserver(() => scheduleFit());
    observer.observe(host);
    await spawnShell(instance);
  }

  function createInstance(xterm: typeof import("./xterm"), hostElement: HTMLDivElement): Terminal {
    const instance = new xterm.Terminal({
      ...displayOptions,
      theme: currentTerminalTheme(),
      // VS Code's default: keeps colored output readable in both themes.
      minimumContrastRatio: 4.5,
      macOptionIsMeta: false,
    });
    fit = new xterm.FitAddon();
    instance.loadAddon(fit);
    // Cmd+click (Ctrl+click elsewhere) opens a link, like VS Code.
    instance.loadAddon(
      new xterm.WebLinksAddon((event, uri) => {
        if (isMac ? event.metaKey : event.ctrlKey) {
          void openUrl(uri).catch((error) => toast.error("Could not open the link", errorMessage(error)));
        }
      }),
    );
    instance.attachCustomKeyEventHandler((event) => handleKey(instance, event));
    instance.onData((data) => sendInput(data));
    instance.onSelectionChange(() => {
      // Keyboard and double-click selections copy now; a drag copies on mouseup.
      if (!mouseSelecting) {
        copyOnSelect(instance);
      }
    });
    instance.open(hostElement);
    stopTheme = watchTheme(() => {
      instance.options.theme = currentTerminalTheme();
    });
    hostElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    return instance;
  }

  async function spawnShell(instance: Terminal): Promise<void> {
    const terminalKey = terminal.key;
    phase = "starting";
    const shellChannel = new Channel<ArrayBuffer>();
    shellChannel.onmessage = (bytes) => {
      if (phase === "starting") {
        markReady();
      }
      instance.write(new Uint8Array(bytes));
    };
    channel = shellChannel;
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
    const action = terminalKeyAction(event, { isMac, hasSelection: instance.hasSelection() });
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
    }
    return false;
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

  // A shell that ended with an error stays open with a note, like VS Code; a clean exit closes it.
  // A run always ends with JetBrains' "Process finished with exit code N".
  $effect(() => {
    const instance = term;
    if (!instance || !terminal.exited) {
      return;
    }
    const exitCode = terminal.exitCode;
    const isRun = terminal.location === "run";
    untrack(() => {
      instance.options.disableStdin = true;
    });
    if (exitShown || (exitCode === 0 && !isRun)) {
      return;
    }
    const timer = setTimeout(() => {
      exitShown = true;
      instance.write(isRun ? runFinishedMessage(exitCode) : exitMessage(exitCode));
    }, EXIT_NOTE_DELAY_MS);
    return () => clearTimeout(timer);
  });

  function openMenu(event: MouseEvent): void {
    const instance = term;
    if (!instance) {
      return;
    }
    const copyHint = isMac ? "Cmd+C" : "Ctrl+Shift+C";
    contextMenu.open(event, [
      { label: "Copy", hint: copyHint, disabled: !instance.hasSelection(), action: () => void copySelection(instance) },
      { label: "Select All", hint: isMac ? "Cmd+A" : undefined, action: () => instance.selectAll() },
      { label: "Clear", hint: isMac ? "Cmd+K" : undefined, action: () => instance.clear() },
      { separator: true },
      ...terminalStore.menuItems(terminal.key),
    ]);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={root} class="terminal-view" class:hidden={!visible} class:ligatures={settings.terminalLigatures} oncontextmenu={openMenu}>
  <div class="xterm-host" bind:this={host}></div>
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

  .xterm-host {
    position: absolute;
    inset: 0;
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

  .terminal-view :global(.xterm) {
    height: 100%;
  }

  /*
   * Ligatures are CSS on the rows: xterm's DOM renderer puts runs of equally
   * styled characters in one span, so WebKit can join them. WebKit turns them
   * on by default, so off is set explicitly (VS Code's default).
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
