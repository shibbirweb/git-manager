// The integrated terminal: which terminals exist, where each is shown (the
// panel or an editor tab, see terminalTabs.ts), which one the panel shows and
// whether the panel is open. Each terminal's xterm and shell live in
// TerminalView.svelte, mounted once by TerminalHost.svelte and moved into the
// place that shows it; this store only keeps the list and those places. Hiding
// the panel keeps every shell running, like VS Code. Run sessions (runs.ts) are
// entries too, shown in the panel's Run tab instead of the Terminal tab.

import { api, onTerminalExited } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import type { ShellProfile, TerminalExitedEvent, TerminalInfo } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import type { MenuItem } from "$lib/ui/menu.svelte";
import {
  resolveShellId,
  shellNameFor,
  startFolder,
  uniqueTerminalName,
  validateTerminalName,
} from "./terminals";
import { runAfterClose, type RunSpec } from "./runs";
import { panelAfterLeave, type TerminalLocation, terminalKeysOf, terminalTabPath } from "./terminalTabs";

export interface TerminalEntry {
  /** Frontend id, known before the shell has started. */
  key: number;
  /** Backend id once the shell runs. */
  terminalId: number | null;
  name: string;
  /** The user picked the name with Rename, so it is never replaced. */
  renamed: boolean;
  /** Shell to start; null is the login shell. */
  shellId: string | null;
  /** Folder asked for; null lets the backend use the home folder. */
  cwd: string | null;
  /** Set once the shell has ended with an error or was killed. */
  exited: boolean;
  exitCode: number | null;
  /** Shown in the panel's list, in its own editor tab, or in the Run tab. */
  location: TerminalLocation;
  /** Run sessions only: the script it starts instead of a shell. */
  run?: RunSpec | null;
}

/** Asks one terminal to take keyboard focus as soon as it is on screen. */
export interface FocusRequest {
  terminalKey: number;
  token: number;
}

/**
 * The last output chunk can arrive after the exit event (large chunks travel
 * separately), so a terminal that exited cleanly closes a moment later.
 */
export const EXIT_CLOSE_DELAY_MS = 250;

/** The tabs of the bottom panel, like JetBrains' bottom tool windows. */
export type PanelTab = "terminal" | "run" | "gitConsole" | "shelf";

export interface NewTerminalOptions {
  shellId?: string | null;
  /** Folder to start in; defaults to the active repository or the first workspace folder. */
  folderPath?: string | null;
  /** "editor" opens it in an editor tab (New Terminal in Editor Area); the panel by default. */
  location?: Exclude<TerminalLocation, "run">;
}

class TerminalStore {
  terminals = $state.raw<TerminalEntry[]>([]);
  /** Terminals in the panel, in list order. */
  panelTerminals = $derived(this.terminals.filter((terminal) => terminal.location === "panel"));
  /** The terminal the panel shows: always one of the panel's own, or null. */
  activeKey = $state<number | null>(null);
  /** Run sessions, in tab order. */
  runSessions = $derived(this.terminals.filter((terminal) => terminal.location === "run"));
  /** The run session the Run tab shows. */
  runActiveKey = $state<number | null>(null);
  /** Where the Run tab shows its session (registered by RunView). */
  runSlot = $state.raw<HTMLElement | null>(null);
  panelOpen = $state(false);
  /** What the bottom panel shows: the terminals, the Git Console or the Shelf. */
  panelTab = $state<PanelTab>("terminal");
  /** The panel was opened at least once, so it is mounted. */
  started = $state(false);
  /** Shells found on this machine, loaded on first use. */
  shells = $state.raw<ShellProfile[]>([]);
  /** The terminal that should take keyboard focus next. */
  focusRequest = $state.raw<FocusRequest | null>(null);
  /** Where the panel shows its terminals (registered by TerminalPanel). */
  panelSlot = $state.raw<HTMLElement | null>(null);
  /** The area of each terminal editor tab, by terminal key (registered by TerminalSlot). */
  editorSlots = $state.raw<Record<number, HTMLElement>>({});

  private nextKey = 1;
  private focusToken = 0;
  private shellsLoad: Promise<ShellProfile[]> | null = null;
  private listening: Promise<void> | null = null;
  /** Bumped by closeAll, so a create still waiting for the shell list gives up. */
  private generation = 0;
  /** Exit events that arrived before their spawn call returned. */
  private earlyExits = new Map<number, number | null>();

  constructor() {
    // Closing a terminal's editor tab kills it, like VS Code (x, Close Others, Close All...).
    repoStore.onTabsClosed((tabPaths) => this.tabsClosed(tabPaths));
  }

  /** The terminal the panel shows. */
  get active(): TerminalEntry | null {
    return this.panelTerminals.find((terminal) => terminal.key === this.activeKey) ?? null;
  }

  find(terminalKey: number): TerminalEntry | null {
    return this.terminals.find((terminal) => terminal.key === terminalKey) ?? null;
  }

  /** The element that shows a terminal now, or null while nothing on screen does. */
  slotFor(terminal: TerminalEntry): HTMLElement | null {
    if (terminal.location === "panel") {
      return this.panelSlot;
    }
    if (terminal.location === "run") {
      return this.runSlot;
    }
    return this.editorSlots[terminal.key] ?? null;
  }

  setPanelSlot(element: HTMLElement | null): void {
    this.panelSlot = element;
  }

  setRunSlot(element: HTMLElement | null): void {
    this.runSlot = element;
  }

  setEditorSlot(terminalKey: number, element: HTMLElement): void {
    this.editorSlots = { ...this.editorSlots, [terminalKey]: element };
  }

  /** Forgets a tab's area, unless a newer one replaced it already. */
  clearEditorSlot(terminalKey: number, element: HTMLElement): void {
    if (this.editorSlots[terminalKey] !== element) {
      return;
    }
    this.editorSlots = Object.fromEntries(
      Object.entries(this.editorSlots).filter(([slotKey]) => Number(slotKey) !== terminalKey),
    );
  }

  requestFocus(terminalKey: number): void {
    this.focusToken += 1;
    this.focusRequest = { terminalKey, token: this.focusToken };
  }

  /** Closes terminals left over from before a reload of the window. Called once on start. */
  init(): void {
    void api.terminalCloseAll().catch(() => undefined);
  }

  /** The shell list, asked for once; an error leaves it empty so it is asked again next time. */
  loadShells(): Promise<ShellProfile[]> {
    if (!this.shellsLoad) {
      this.shellsLoad = api
        .terminalShells()
        .then((shells) => {
          this.shells = shells ?? [];
          return this.shells;
        })
        .catch(() => {
          this.shellsLoad = null;
          return [];
        });
    }
    return this.shellsLoad;
  }

  /** Ctrl+` and the activity bar: shows the panel (with a terminal) or hides it. */
  toggle(): void {
    if (this.panelOpen && this.panelTab === "terminal") {
      this.hide();
    } else {
      this.show();
    }
  }

  /** Shows the panel; one without terminals of its own gets a new one (terminals in the editor stay there). */
  show(): void {
    this.panelOpen = true;
    this.started = true;
    this.panelTab = "terminal";
    const panelTerminals = this.panelTerminals;
    if (panelTerminals.length === 0) {
      void this.create();
      return;
    }
    if (!panelTerminals.some((terminal) => terminal.key === this.activeKey)) {
      this.activeKey = panelTerminals[0].key;
    }
    this.requestFocus(this.activeKey ?? panelTerminals[0].key);
  }

  hide(): void {
    this.panelOpen = false;
  }

  /** Shows the panel on a tab; the Terminal tab starts a terminal when the panel has none. */
  showTab(tab: PanelTab): void {
    if (tab === "gitConsole" && !settings.gitConsole) {
      return;
    }
    if (tab === "terminal") {
      this.show();
      return;
    }
    this.panelOpen = true;
    this.started = true;
    this.panelTab = tab;
  }

  /** The Git Console setting was turned off: leave its tab for the terminals, or hide the panel without any. */
  closeGitConsole(): void {
    if (this.panelTab !== "gitConsole") {
      return;
    }
    this.panelTab = "terminal";
    if (this.panelTerminals.length === 0) {
      this.hide();
    }
  }

  /** View > Git Console and similar: hides the panel when it already shows that tab. */
  toggleTab(tab: PanelTab): void {
    if (this.panelOpen && this.panelTab === tab) {
      this.hide();
    } else {
      this.showTab(tab);
    }
  }

  /** Starts a new terminal and shows it, in the panel or (with `location: "editor"`) in a new editor tab. */
  async create(options: NewTerminalOptions = {}): Promise<void> {
    const location = options.location ?? "panel";
    if (location === "panel") {
      this.panelOpen = true;
      this.started = true;
      this.panelTab = "terminal";
    }
    const generation = this.generation;
    await this.listen();
    const shells = this.shells.length > 0 ? this.shells : await this.loadShells();
    if (generation !== this.generation) {
      return;
    }
    const shellId = resolveShellId(options.shellId ?? null, settings.terminalShell, shells);
    const cwd = startFolder({
      requestedFolder: options.folderPath ?? null,
      repoRoot: repoStore.repo?.root ?? null,
      workspaceFolders: (repoStore.workspace?.folders ?? []).map((folder) => folder.root),
    });
    const entry: TerminalEntry = {
      key: this.nextKey++,
      terminalId: null,
      name: uniqueTerminalName(
        shellNameFor(shellId, shells),
        this.terminals.map((terminal) => terminal.name),
      ),
      renamed: false,
      shellId,
      cwd,
      exited: false,
      exitCode: null,
      location,
    };
    this.terminals = [...this.terminals, entry];
    if (location === "panel") {
      this.activeKey = entry.key;
    } else {
      repoStore.openPseudoTab(terminalTabPath(entry.key));
    }
    this.requestFocus(entry.key);
  }

  /**
   * Runs a script in the Run tab, like JetBrains: a script that has a session already
   * runs again in it. `askToStop` asks first when it is still running (the Scripts
   * panel); the Rerun button restarts it at once.
   */
  async startRun(spec: RunSpec, name: string, askToStop = true): Promise<void> {
    const existing = this.runSessions.find((terminal) => terminal.run?.runId === spec.runId) ?? null;
    const running = existing !== null && existing.terminalId !== null && !existing.exited;
    if (existing && running && askToStop) {
      const stop = await dialogs.confirm({
        title: "Process Is Running",
        message: `${existing.name} is still running. Stop it and run it again?`,
        confirmLabel: "Stop and Rerun",
        danger: true,
      });
      if (!stop) {
        this.selectRun(existing.key);
        return;
      }
    }
    await this.listen();
    const entry: TerminalEntry = {
      key: this.nextKey++,
      terminalId: null,
      name,
      renamed: true,
      shellId: null,
      cwd: spec.cwd,
      exited: false,
      exitCode: null,
      location: "run",
      run: spec,
    };
    const current = existing ? this.find(existing.key) : null;
    if (current) {
      if (current.terminalId !== null && !current.exited) {
        void api.terminalClose(current.terminalId).catch(() => undefined);
      }
      // A new entry in the same place: a fresh view, as JetBrains clears the console on Rerun.
      this.terminals = this.terminals.map((terminal) => (terminal.key === current.key ? entry : terminal));
    } else {
      this.terminals = [...this.terminals, entry];
    }
    this.runActiveKey = entry.key;
    this.panelOpen = true;
    this.started = true;
    this.panelTab = "run";
    this.requestFocus(entry.key);
  }

  /** Rerun: starts the session's script again in the same tab. */
  rerun(terminalKey: number): void {
    const entry = this.find(terminalKey);
    if (entry?.run) {
      void this.startRun(entry.run, entry.name, false);
    }
  }

  /** Stop: ends the process (and its children); the output stays with "Process stopped". */
  stopRun(terminalKey: number): void {
    const entry = this.find(terminalKey);
    if (entry && entry.terminalId !== null && !entry.exited) {
      void api.terminalClose(entry.terminalId).catch(() => undefined);
    }
  }

  /** Closes a run tab, asking first while its process still runs. */
  async closeRun(terminalKey: number): Promise<void> {
    const entry = this.find(terminalKey);
    if (!entry || entry.location !== "run") {
      return;
    }
    if (entry.terminalId !== null && !entry.exited) {
      const stop = await dialogs.confirm({
        title: "Process Is Running",
        message: `Stop ${entry.name} and close its tab?`,
        confirmLabel: "Stop and Close",
        danger: true,
      });
      if (!stop) {
        return;
      }
    }
    this.runActiveKey = runAfterClose(
      this.runSessions.map((terminal) => terminal.key),
      terminalKey,
      this.runActiveKey,
    );
    this.close(terminalKey);
    if (this.runSessions.length === 0 && this.panelTab === "run") {
      this.panelTab = "terminal";
      if (this.panelTerminals.length === 0) {
        this.panelOpen = false;
      }
    } else if (this.runActiveKey !== null) {
      this.requestFocus(this.runActiveKey);
    }
  }

  selectRun(terminalKey: number): void {
    if (this.find(terminalKey)?.location !== "run") {
      return;
    }
    this.runActiveKey = terminalKey;
    this.panelOpen = true;
    this.started = true;
    this.panelTab = "run";
    this.requestFocus(terminalKey);
  }

  /** Right-click menu of a run tab. */
  runMenuItems(terminalKey: number): MenuItem[] {
    const entry = this.find(terminalKey);
    if (!entry) {
      return [];
    }
    const running = entry.terminalId !== null && !entry.exited;
    return [
      { label: "Rerun", action: () => this.rerun(terminalKey) },
      { label: "Stop", disabled: !running, action: () => this.stopRun(terminalKey) },
      { separator: true },
      { label: "Close", action: () => void this.closeRun(terminalKey) },
    ];
  }

  /** Shows one of the panel's terminals. */
  select(terminalKey: number): void {
    if (this.find(terminalKey)?.location !== "panel") {
      return;
    }
    this.activeKey = terminalKey;
    this.requestFocus(terminalKey);
  }

  /**
   * Move Terminal into Editor Area: the same xterm and shell, shown in a new
   * editor tab. The panel shows its next terminal, or hides with its last one.
   */
  moveToEditor(terminalKey: number): void {
    const entry = this.find(terminalKey);
    if (!entry || entry.location !== "panel") {
      return;
    }
    const next = panelAfterLeave(this.terminals, terminalKey, { activeKey: this.activeKey, panelOpen: this.panelOpen });
    this.update(terminalKey, { location: "editor" });
    this.activeKey = next.activeKey;
    this.panelOpen = next.panelOpen;
    repoStore.openPseudoTab(terminalTabPath(terminalKey));
    this.requestFocus(terminalKey);
  }

  /** Move Terminal into Panel: closes its tab without stopping the shell and shows it, last in the panel's list. */
  moveToPanel(terminalKey: number): void {
    const entry = this.find(terminalKey);
    if (!entry || entry.location !== "editor") {
      return;
    }
    this.terminals = [...this.terminals.filter((terminal) => terminal.key !== terminalKey), { ...entry, location: "panel" }];
    this.activeKey = terminalKey;
    this.panelOpen = true;
    this.started = true;
    this.panelTab = "terminal";
    this.requestFocus(terminalKey);
    // Its location changed first, so tabsClosed leaves the shell running.
    void repoStore.closeTab(terminalTabPath(terminalKey));
  }

  /**
   * Called by TerminalView once the shell runs. Returns false when the terminal
   * was closed meanwhile, so the caller stops the shell it just started.
   */
  attach(terminalKey: number, info: TerminalInfo): boolean {
    const entry = this.terminals.find((terminal) => terminal.key === terminalKey);
    if (!entry) {
      return false;
    }
    const others = this.terminals.filter((terminal) => terminal.key !== terminalKey).map((terminal) => terminal.name);
    const shellName = info.shell?.name ?? "";
    const name = entry.renamed || !shellName ? entry.name : uniqueTerminalName(shellName, others);
    this.update(terminalKey, { terminalId: info.terminalId, name, cwd: info.cwd ?? entry.cwd });
    const early = this.earlyExits.get(info.terminalId);
    if (early !== undefined) {
      this.earlyExits.delete(info.terminalId);
      this.handleExit({ terminalId: info.terminalId, exitCode: early });
    }
    if (!this.terminals.some((terminal) => terminal.terminalId === null)) {
      this.earlyExits.clear();
    }
    return true;
  }

  /**
   * The shell (or xterm itself) could not start: the terminal stays, showing
   * the error and Retry, until the user retries or closes it.
   */
  spawnFailed(terminalKey: number): void {
    this.update(terminalKey, { exited: true, exitCode: null });
  }

  /** Retry after a failed start: the terminal is live again while its shell starts. */
  restart(terminalKey: number): void {
    this.update(terminalKey, { terminalId: null, exited: false, exitCode: null });
  }

  rename(terminalKey: number, name: string): void {
    const trimmed = name.trim();
    if (trimmed) {
      this.update(terminalKey, { name: trimmed, renamed: true });
    }
  }

  /** Rename...: asks for a name that then stays, even when the shell changes. */
  async promptRename(terminalKey: number): Promise<void> {
    const entry = this.terminals.find((terminal) => terminal.key === terminalKey);
    if (!entry) {
      return;
    }
    const result = await dialogs.prompt({
      title: "Rename Terminal",
      label: "Name",
      initial: entry.name,
      confirmLabel: "Rename",
      validate: validateTerminalName,
    });
    if (result) {
      this.rename(terminalKey, result.value);
    }
    this.requestFocus(terminalKey);
  }

  /** Right-click menu of a terminal, in the panel's list, its header and the terminal itself. */
  menuItems(terminalKey: number): MenuItem[] {
    const entry = this.find(terminalKey);
    if (!entry) {
      return [];
    }
    if (entry.location === "run") {
      return this.runMenuItems(terminalKey);
    }
    const location = entry.location;
    return [
      {
        label: "New Terminal Here",
        hint: "same shell and folder",
        action: () => void this.create({ shellId: entry.shellId, folderPath: entry.cwd, location }),
      },
      { label: "Rename...", action: () => void this.promptRename(terminalKey) },
      { separator: true },
      this.moveItem(entry),
      { separator: true },
      { label: "Kill Terminal", danger: true, action: () => this.close(terminalKey) },
    ];
  }

  /** Terminal items of a terminal's editor tab menu, after the Close items (which kill it). */
  tabMenuItems(terminalKey: number): MenuItem[] {
    const entry = this.find(terminalKey);
    if (!entry) {
      return [];
    }
    return [this.moveItem(entry), { label: "Rename...", action: () => void this.promptRename(terminalKey) }];
  }

  private moveItem(entry: TerminalEntry): MenuItem {
    if (entry.location === "editor") {
      return { label: "Move Terminal into Panel", action: () => this.moveToPanel(entry.key) };
    }
    return { label: "Move Terminal into Editor Area", action: () => this.moveToEditor(entry.key) };
  }

  /** Kill Terminal: stops the shell and removes the terminal. */
  close(terminalKey: number): void {
    const entry = this.terminals.find((terminal) => terminal.key === terminalKey);
    if (!entry) {
      return;
    }
    if (entry.terminalId !== null && !entry.exited) {
      void api.terminalClose(entry.terminalId).catch(() => undefined);
    }
    this.remove(terminalKey);
  }

  /** Stops every shell and closes the terminal tabs, e.g. when the workspace closes. */
  closeAll(): void {
    const tabPaths = this.terminals
      .filter((terminal) => terminal.location === "editor")
      .map((terminal) => terminalTabPath(terminal.key));
    if (this.terminals.length > 0) {
      void api.terminalCloseAll().catch(() => undefined);
    }
    this.generation += 1;
    this.terminals = [];
    this.activeKey = null;
    this.runActiveKey = null;
    this.panelOpen = false;
    this.started = false;
    this.panelTab = "terminal";
    this.focusRequest = null;
    this.earlyExits.clear();
    this.closeTabsOf(tabPaths);
  }

  /** Editor tabs closed: a terminal still in the editor goes with its tab, like Kill Terminal. */
  private tabsClosed(tabPaths: string[]): void {
    for (const terminalKey of terminalKeysOf(tabPaths)) {
      if (this.find(terminalKey)?.location === "editor") {
        this.close(terminalKey);
      }
    }
  }

  /** Closes the tabs among `tabPaths` that are still open. */
  private closeTabsOf(tabPaths: string[]): void {
    const open = tabPaths.filter((tabPath) => repoStore.tabs.some((tab) => tab.path === tabPath));
    if (open.length > 0) {
      void repoStore.closeTabs(open);
    }
  }

  private remove(terminalKey: number): void {
    const entry = this.find(terminalKey);
    if (!entry) {
      return;
    }
    // Like VS Code, the panel hides with its last terminal.
    const next = panelAfterLeave(this.terminals, terminalKey, { activeKey: this.activeKey, panelOpen: this.panelOpen });
    this.terminals = this.terminals.filter((terminal) => terminal.key !== terminalKey);
    this.activeKey = next.activeKey;
    // The Git Console and the Shelf stay on screen when the last terminal goes.
    this.panelOpen = this.panelTab === "terminal" ? next.panelOpen : this.panelOpen;
    if (entry.location === "editor") {
      this.closeTabsOf([terminalTabPath(terminalKey)]);
    } else if (this.panelOpen && this.activeKey !== null) {
      this.requestFocus(this.activeKey);
    }
  }

  private update(terminalKey: number, patch: Partial<TerminalEntry>): void {
    this.terminals = this.terminals.map((terminal) => (terminal.key === terminalKey ? { ...terminal, ...patch } : terminal));
  }

  /** Subscribes to exit events once, before the first shell starts. */
  private listen(): Promise<void> {
    if (!this.listening) {
      this.listening = onTerminalExited((event) => this.handleExit(event)).then(
        () => undefined,
        () => {
          this.listening = null;
        },
      );
    }
    return this.listening ?? Promise.resolve();
  }

  /** A clean exit closes a terminal like VS Code; an error keeps it with a note. Runs always stay. */
  private handleExit(event: TerminalExitedEvent): void {
    const entry = this.terminals.find((terminal) => terminal.terminalId === event.terminalId);
    if (!entry) {
      // Its spawn call may not have returned yet; terminals we closed ourselves are not waited for.
      if (this.terminals.some((terminal) => terminal.terminalId === null && !terminal.exited)) {
        this.earlyExits.set(event.terminalId, event.exitCode ?? null);
      }
      return;
    }
    if (entry.exited) {
      return;
    }
    const exitCode = event.exitCode ?? null;
    this.update(entry.key, { exited: true, exitCode });
    // A run keeps its output and the exit code, like JetBrains' Run window.
    if (exitCode === 0 && entry.location !== "run") {
      setTimeout(() => this.remove(entry.key), EXIT_CLOSE_DELAY_MS);
    }
  }
}

export const terminalStore = new TerminalStore();
