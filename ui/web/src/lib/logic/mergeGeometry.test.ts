import { describe, expect, it } from "vitest";
import { chunkLineClasses, ribbonPath } from "./mergeGeometry";

describe("merge geometry", () => {
  it("gives chunk lines their tint and edges", () => {
    expect(chunkLineClasses("conflict", 4, 5, 4)).toBe("cm-mc-line cm-mc-conflict cm-mc-single");
    expect(chunkLineClasses("added", 2, 5, 2)).toBe("cm-mc-line cm-mc-added cm-mc-first");
    expect(chunkLineClasses("added", 2, 5, 3)).toBe("cm-mc-line cm-mc-added");
    expect(chunkLineClasses("added", 2, 5, 4)).toBe("cm-mc-line cm-mc-added cm-mc-last");
  });

  it("draws a ribbon between two ranges", () => {
    expect(ribbonPath(10, 30, 20, 20, 52)).toBe("M0 10C26 10 26 20 52 20L52 20C26 20 26 30 0 30Z");
  });
});
