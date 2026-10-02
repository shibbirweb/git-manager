import { describe, expect, it } from "vitest";
import { DoubleShift, type ShiftTapKey } from "./doubleShift";

function key(type: "keydown" | "keyup", keyName: string, timeStamp: number, extra: Partial<ShiftTapKey> = {}): ShiftTapKey {
  return {
    type,
    key: keyName,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    repeat: false,
    timeStamp,
    ...extra,
  };
}

/** Feeds events and returns the indices of those that fired. */
function feed(events: ShiftTapKey[], detector = new DoubleShift()): number[] {
  return events.flatMap((event, index) => (detector.handle(event) ? [index] : []));
}

function tap(at: number, hold = 60): ShiftTapKey[] {
  return [key("keydown", "Shift", at), key("keyup", "Shift", at + hold)];
}

describe("DoubleShift", () => {
  it("fires on the second of two quick taps", () => {
    expect(feed([...tap(0), ...tap(150)])).toEqual([3]);
  });

  it("does not fire on a single tap or a slow second tap", () => {
    expect(feed(tap(0))).toEqual([]);
    expect(feed([...tap(0), ...tap(500)])).toEqual([]);
  });

  it("starts over after firing, so a third tap does not fire again", () => {
    expect(feed([...tap(0), ...tap(150), ...tap(300)])).toEqual([3]);
    expect(feed([...tap(0), ...tap(150), ...tap(300), ...tap(450)])).toEqual([3, 7]);
  });

  it("ignores Shift held with another key, like typing a capital letter", () => {
    const capital = [key("keydown", "Shift", 0), key("keydown", "A", 30), key("keyup", "A", 60), key("keyup", "Shift", 90)];
    expect(feed([...capital, ...tap(150)])).toEqual([]);
    expect(feed([...tap(0), ...capital.map((event) => ({ ...event, timeStamp: event.timeStamp + 150 }))])).toEqual([]);
  });

  it("never fires while typing capitals quickly", () => {
    const typing = [
      ...[key("keydown", "Shift", 0), key("keydown", "H", 20), key("keyup", "H", 50), key("keyup", "Shift", 70)],
      key("keydown", "i", 100),
      key("keyup", "i", 130),
      ...[key("keydown", "Shift", 160), key("keydown", "T", 180), key("keyup", "T", 200), key("keyup", "Shift", 220)],
    ];
    expect(feed(typing)).toEqual([]);
  });

  it("a key typed between the taps cancels the first one", () => {
    expect(feed([...tap(0), key("keydown", "a", 80), key("keyup", "a", 100), ...tap(150)])).toEqual([]);
  });

  it("does not count a long hold or Shift with Cmd, Ctrl or Option", () => {
    expect(feed([...tap(0, 600), ...tap(700)])).toEqual([]);
    const withCmd = [key("keydown", "Shift", 0, { metaKey: true }), key("keyup", "Shift", 50, { metaKey: true })];
    expect(feed([...withCmd, ...tap(120)])).toEqual([]);
    expect(feed([...tap(0), key("keydown", "Shift", 150, { altKey: true }), key("keyup", "Shift", 200, { altKey: true })])).toEqual([]);
  });

  it("skips auto repeat and IME composition", () => {
    const held = [key("keydown", "Shift", 0), key("keydown", "Shift", 30, { repeat: true }), key("keyup", "Shift", 60)];
    expect(feed([...held, ...tap(150)])).toEqual([4]);
    expect(feed([...tap(0), key("keydown", "Shift", 150, { isComposing: true }), ...tap(160)])).toEqual([]);
  });

  it("works the same wherever focus is, since it only sees key events", () => {
    // An editor or the terminal may handle Shift itself; the detector does not care.
    const detector = new DoubleShift();
    expect(feed([...tap(1000), ...tap(1200)], detector)).toEqual([3]);
  });

  it("reset forgets a pending tap", () => {
    const detector = new DoubleShift();
    feed(tap(0), detector);
    detector.reset();
    expect(feed(tap(150), detector)).toEqual([]);
  });
});
