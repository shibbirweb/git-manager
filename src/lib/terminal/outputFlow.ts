// Terminal output flow control: the backend stops reading a shell while about
// 2 MB of its output are not acknowledged (src-tauri/src/terminal_flow.rs), so the view
// acknowledges what xterm has written. That keeps the backlog small, so Ctrl+C shows at once.

import type { TerminalExitMessage, TerminalOutputMessage } from "$lib/types";

/** Acks go out about once per this many written bytes. */
export const ACK_CHUNK_BYTES = 128 * 1024;

/** The last message on a terminal's output channel, after all of its output. */
export function isExitMessage(message: TerminalOutputMessage): message is TerminalExitMessage {
  return !(message instanceof ArrayBuffer) && typeof message === "object" && message !== null && "exit" in message;
}

/** Counts one shell's output from the channel to xterm and sends the acks. */
export class OutputAcks {
  /** Received, not yet written by xterm. */
  private inFlight = 0;
  /** Written, not yet acked. */
  private unacked = 0;
  /** Acked by a flush before xterm wrote them, so their write callbacks send nothing. */
  private prepaid = 0;
  /** After stop, received bytes are acked at once. */
  private stopped = false;
  private send: ((byteCount: number) => void) | null = null;

  /** Acks go to `send` from now on (once the shell's id is known), starting with what was written so far. */
  connect(send: (byteCount: number) => void): void {
    this.send = send;
    if (this.stopped) {
      this.flush();
    } else if (this.unacked >= ACK_CHUNK_BYTES) {
      this.sendWritten();
    }
  }

  /** A message arrived and goes to xterm. */
  received(byteCount: number): void {
    if (this.stopped) {
      this.unacked += byteCount;
      this.sendWritten();
      return;
    }
    this.inFlight += byteCount;
  }

  /** xterm wrote a message (its write callback). */
  written(byteCount: number): void {
    const covered = Math.min(this.prepaid, byteCount);
    this.prepaid -= covered;
    const fresh = byteCount - covered;
    this.inFlight = Math.max(0, this.inFlight - fresh);
    this.unacked += fresh;
    if (this.unacked >= ACK_CHUNK_BYTES) {
      this.sendWritten();
    }
  }

  /** Acks everything received, written or not: on hide, so the backend never waits on a view. */
  flush(): void {
    if (!this.send) {
      return;
    }
    const byteCount = this.unacked + this.inFlight;
    this.prepaid += this.inFlight;
    this.inFlight = 0;
    this.unacked = 0;
    if (byteCount > 0) {
      this.send(byteCount);
    }
  }

  /** The view is going away: acks everything now and every later message as it arrives. */
  stop(): void {
    this.stopped = true;
    this.flush();
  }

  private sendWritten(): void {
    if (!this.send || this.unacked === 0) {
      return;
    }
    const byteCount = this.unacked;
    this.unacked = 0;
    this.send(byteCount);
  }
}
