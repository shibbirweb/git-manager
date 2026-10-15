import { describe, expect, it } from "vitest";
import { windowPlace } from "./popoverPlace";

const viewport = { width: 1000, height: 800 };
const trigger = { left: 500, right: 530, top: 700, bottom: 724 };

describe("windowPlace", () => {
  it("lines up the end edge above the trigger", () => {
    const place = windowPlace(trigger, 280, viewport, { placement: "above", align: "end", offset: 2, inset: 8 });
    expect(place).toEqual({ left: 250, top: null, bottom: 102 });
  });

  it("lines up the start edge below the trigger", () => {
    const place = windowPlace(trigger, 280, viewport, { placement: "below", align: "start", offset: 2, inset: 8 });
    expect(place).toEqual({ left: 500, top: 726, bottom: null });
  });

  it("stays inside the window's left edge in a narrow sidebar", () => {
    const near = { left: 40, right: 70, top: 700, bottom: 724 };
    const place = windowPlace(near, 280, viewport, { placement: "above", align: "end", offset: 2, inset: 8 });
    expect(place.left).toBe(8);
  });

  it("stays inside the window's right edge", () => {
    const near = { left: 900, right: 930, top: 100, bottom: 124 };
    const place = windowPlace(near, 280, viewport, { placement: "below", align: "start", offset: 2, inset: 8 });
    expect(place.left).toBe(712);
  });
});
