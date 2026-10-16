// The shell behind one terminal view: starting it (or a script run, or reconnecting after Clear Cache), its output
// with flow control, typing, telling it the grid size, and the startup status shown over the screen.
import { Channel } from "@tauri-apps/api/core";
import type { Terminal } from "@xterm/xterm";
import { api, errorMessage } from "$lib/api";
import type { TerminalOutputMessage } from "$lib/types";
import { isExitMessage, OutputAcks } from "./outputFlow";
import { runHeader } from "./runs";
import { terminalStore, type TerminalEntry } from "./terminalStore.svelte";
import { QUIET_SHELL_MS, type StartupPhase } from "./terminals";

export class TerminalShell {
  /** Startup progress, shown over the empty terminal until the shell prints something. */
  phase = $state<StartupPhase>("loading");
  /** Why xterm or the shell could not start, shown with Retry. */
  failure = $state<string | null>(null);
  /** The exit note (or a failure) is on screen, so no other note is written. */
  exitShown = false;
  terminalId: number | null = null;
  disposed = false;
  /** Typed before the shell was ready; sent once it is. */
  private pendingInput = "";
  private sentSize = { cols: 0, rows: 0 };
  private readyTimer: ReturnType<typeof setTimeout> | undefined;
  /** Output of the current shell and its acks; a retry gets new ones. */
  private channel: Channel<TerminalOutputMessage> | null = null;
  private acks: OutputAcks | null = null;
  private lastOutputAt = 0;

  /** `fit` measures the grid again and tells the shell (the view may have changed size while it started). */
  constructor(
    private readonly terminal: () => TerminalEntry,
    private readonly fit: () => void,
  ) {}

  /** The previous shell's output is no longer shown; it is still acked, so nothing waits on this view. */
  stopOutput(): void {
    const shellAcks = this.acks;
    if (this.channel) {
      this.channel.onmessage = (message) => {
        if (message instanceof ArrayBuffer) {
          shellAcks?.received(message.byteLength);
        }
      };
    }
    shellAcks?.stop();
    this.channel = null;
    this.acks = null;
  }

  /** A channel that writes output into `instance` and acks what xterm has drawn; the exit comes last. */
  private connect(instance: Terminal, onOutput: () => void): Channel<TerminalOutputMessage> {
    const terminalKey = this.terminal().key;
    this.stopOutput();
    const shellChannel = new Channel<TerminalOutputMessage>();
    const shellAcks = new OutputAcks();
    shellChannel.onmessage = (message) => {
      if (isExitMessage(message)) {
        terminalStore.exited(terminalKey, message.exit ?? null);
        return;
      }
      onOutput();
      const bytes = new Uint8Array(message);
      shellAcks.received(bytes.byteLength);
      instance.write(bytes, () => shellAcks.written(bytes.byteLength));
    };
    this.channel = shellChannel;
    this.acks = shellAcks;
    return shellChannel;
  }

  async spawn(instance: Terminal): Promise<void> {
    const terminal = this.terminal();
    this.phase = "starting";
    const shellChannel = this.connect(instance, () => {
      if (this.phase === "starting") {
        this.markReady();
      }
      this.lastOutputAt = Date.now();
    });
    const shellAcks = this.acks;
    let info;
    const run = terminal.run ?? null;
    const size = { cols: instance.cols, rows: instance.rows };
    try {
      if (run) {
        instance.write(runHeader(run));
        const { program, args, cwd, nodeBinDir } = run;
        info = await api.runScript({ program, args, cwd, nodeBinDir, ...size }, shellChannel);
      } else {
        info = await api.terminalSpawn({ shellId: terminal.shellId, cwd: terminal.cwd, ...size }, shellChannel);
      }
    } catch (error) {
      if (!this.disposed) {
        this.fail(error);
      }
      return;
    }
    if (this.disposed || !terminalStore.attach(terminal.key, info)) {
      // Closed while the shell was starting.
      void api.terminalClose(info.terminalId).catch(() => undefined);
      return;
    }
    this.terminalId = info.terminalId;
    const ackedTerminalId = info.terminalId;
    shellAcks?.connect((byteCount) => void api.terminalAck(ackedTerminalId, byteCount).catch(() => undefined));
    this.sentSize = { cols: instance.cols, rows: instance.rows };
    this.fit();
    if (this.pendingInput) {
      this.send(this.pendingInput);
      this.pendingInput = "";
    }
    const typedPrompt = terminal.agent?.pendingPrompt ?? null;
    if (typedPrompt) {
      this.typeWhenQuiet(info.terminalId, typedPrompt);
    }
    if (this.phase === "starting") {
      // A shell that prints no prompt must not leave the status up.
      this.readyTimer = setTimeout(() => this.markReady(), QUIET_SHELL_MS);
    }
  }

  /** After Clear Cache: the shell kept running; its output since the restart comes first, then live output. */
  async reattach(instance: Terminal, liveTerminalId: number): Promise<void> {
    const terminalKey = this.terminal().key;
    const shellChannel = this.connect(instance, () => undefined);
    const shellAcks = this.acks;
    let connected = false;
    try {
      connected = await api.terminalReattach(liveTerminalId, shellChannel);
    } catch {
      connected = false;
    }
    if (this.disposed) {
      return;
    }
    if (!connected) {
      // Closed or timed out meanwhile: the old screen stays, with the usual note below it.
      terminalStore.exited(terminalKey, null);
      this.phase = "ready";
      return;
    }
    this.terminalId = liveTerminalId;
    shellAcks?.connect((byteCount) => void api.terminalAck(liveTerminalId, byteCount).catch(() => undefined));
    // The new page's size may differ; the next fit tells the shell.
    this.sentSize = { cols: 0, rows: 0 };
    this.fit();
    this.phase = "ready";
  }

  markReady(): void {
    clearTimeout(this.readyTimer);
    if (this.phase === "starting") {
      this.phase = "ready";
    }
  }

  fail(error: unknown): void {
    clearTimeout(this.readyTimer);
    // The error is shown over the terminal, so no exit note is written behind it.
    this.exitShown = true;
    this.failure = errorMessage(error);
    this.phase = "failed";
    terminalStore.spawnFailed(this.terminal().key);
  }

  /**
   * An agent that takes its first prompt as typed text (Aider, Amp, Qwen Code): typed once its start-up output has
   * been quiet for a moment, or after 20 s, then Enter.
   */
  private typeWhenQuiet(typedTerminalId: number, prompt: string): void {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const quiet = this.lastOutputAt > 0 && now - this.lastOutputAt > 900 && now - startedAt > 1500;
      if (this.disposed || this.terminalId !== typedTerminalId || this.terminal().exited) {
        clearInterval(timer);
        return;
      }
      if (quiet || now - startedAt > 20_000) {
        clearInterval(timer);
        terminalStore.clearPendingPrompt(this.terminal().key);
        void api.terminalWrite(typedTerminalId, `${prompt}\r`).catch(() => undefined);
      }
    }, 300);
  }

  /** Keys typed or text pasted; kept until the shell is ready. */
  send(data: string): void {
    if (this.terminal().exited) {
      return;
    }
    if (this.terminalId === null) {
      this.pendingInput += data;
      return;
    }
    void api.terminalWrite(this.terminalId, data).catch(() => undefined);
  }

  /** Tells the shell the grid's size when it changed. */
  tellSize(cols: number, rows: number): void {
    if (this.terminalId === null || this.terminal().exited) {
      return;
    }
    if (cols !== this.sentSize.cols || rows !== this.sentSize.rows) {
      this.sentSize = { cols, rows };
      void api.terminalResize(this.terminalId, cols, rows).catch(() => undefined);
    }
  }

  /** Hidden: everything received is acked, so a shell never waits on a view out of sight. */
  flushAcks(): void {
    this.acks?.flush();
  }

  /** Before Retry or Restart starts a new shell in the same view. */
  reset(): void {
    this.exitShown = false;
    this.failure = null;
    this.terminalId = null;
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.readyTimer);
    this.stopOutput();
  }
}
