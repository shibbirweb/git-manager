import { describe, expect, it } from "vitest";
import { ACK_CHUNK_BYTES, isExitMessage, OutputAcks } from "./outputFlow";

function connected(): { acks: OutputAcks; sent: number[] } {
  const acks = new OutputAcks();
  const sent: number[] = [];
  acks.connect((byteCount) => sent.push(byteCount));
  return { acks, sent };
}

/** A message that arrived and was written. */
function deliver(acks: OutputAcks, byteCount: number): void {
  acks.received(byteCount);
  acks.written(byteCount);
}

describe("output acks", () => {
  it("acks written output about every 128 KB", () => {
    const { acks, sent } = connected();
    deliver(acks, 100 * 1024);
    expect(sent).toEqual([]);
    deliver(acks, 28 * 1024);
    expect(sent).toEqual([ACK_CHUNK_BYTES]);
    deliver(acks, 300 * 1024);
    expect(sent).toEqual([ACK_CHUNK_BYTES, 300 * 1024]);
  });

  it("acks only once xterm wrote the output", () => {
    const { acks, sent } = connected();
    acks.received(ACK_CHUNK_BYTES * 2);
    expect(sent).toEqual([]);
    acks.written(ACK_CHUNK_BYTES * 2);
    expect(sent).toEqual([ACK_CHUNK_BYTES * 2]);
  });

  it("keeps acks until the shell's id is known", () => {
    const acks = new OutputAcks();
    deliver(acks, ACK_CHUNK_BYTES + 5);
    const sent: number[] = [];
    acks.connect((byteCount) => sent.push(byteCount));
    expect(sent).toEqual([ACK_CHUNK_BYTES + 5]);
  });

  it("a flush acks unwritten output once, never twice", () => {
    const { acks, sent } = connected();
    deliver(acks, 1000);
    acks.received(5000);
    acks.flush();
    expect(sent).toEqual([6000]);
    // The 5000 bytes written later were acked already.
    acks.written(5000);
    deliver(acks, ACK_CHUNK_BYTES - 1);
    expect(sent).toEqual([6000]);
    deliver(acks, 1);
    expect(sent).toEqual([6000, ACK_CHUNK_BYTES]);
  });

  it("a flush with nothing new sends nothing", () => {
    const { acks, sent } = connected();
    acks.flush();
    expect(sent).toEqual([]);
    new OutputAcks().flush();
  });

  it("after stop every message is acked as it arrives", () => {
    const { acks, sent } = connected();
    acks.received(700);
    acks.stop();
    expect(sent).toEqual([700]);
    acks.received(20);
    expect(sent).toEqual([700, 20]);
    // A write callback that still fires sends nothing more.
    acks.written(700);
    expect(sent).toEqual([700, 20]);
  });

  it("a view stopped before the id is known acks on connect", () => {
    const acks = new OutputAcks();
    acks.received(300);
    acks.stop();
    acks.received(50);
    const sent: number[] = [];
    acks.connect((byteCount) => sent.push(byteCount));
    expect(sent.reduce((total, byteCount) => total + byteCount, 0)).toBe(350);
  });
});

describe("exit messages", () => {
  it("tells the exit apart from output", () => {
    expect(isExitMessage({ exit: 3 })).toBe(true);
    expect(isExitMessage({ exit: null })).toBe(true);
    expect(isExitMessage(new ArrayBuffer(4))).toBe(false);
  });
});
