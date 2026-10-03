import { describe, expect, it } from "vitest";
import { MIN_NOTE_WIDTH, NOTE_GAP, placeNote } from "./inlineBlameLayout";

describe("placeNote", () => {
  it("puts the note after the line end, on the same row", () => {
    expect(placeNote({ right: 200, top: 40, bottom: 56 }, 1000, true)).toEqual({
      left: 200 + NOTE_GAP,
      top: 40,
      height: 16,
      maxWidth: 1000 - 12 - 200 - NOTE_GAP,
    });
  });

  it("with word wrap off, always follows the code, even past the visible edge", () => {
    expect(placeNote({ right: 1500, top: 0, bottom: 16 }, 1000, false)).toEqual({
      left: 1500 + NOTE_GAP,
      top: 0,
      height: 16,
      maxWidth: null,
    });
    expect(placeNote({ right: 200, top: 0, bottom: 16 }, 1000, false).maxWidth).toBeNull();
  });

  it("with word wrap on, cuts a long note short but never below the minimum", () => {
    expect(placeNote({ right: 800, top: 0, bottom: 16 }, 1000, true).maxWidth).toBe(1000 - 12 - 800 - NOTE_GAP);
    expect(placeNote({ right: 990, top: 0, bottom: 16 }, 1000, true).maxWidth).toBe(MIN_NOTE_WIDTH);
  });

  it("never gets a negative height", () => {
    expect(placeNote({ right: 0, top: 20, bottom: 10 }, 1000, true).height).toBe(0);
  });
});
