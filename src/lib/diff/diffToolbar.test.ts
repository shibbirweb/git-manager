import { describe, expect, it } from "vitest";
import { changeCounter } from "./diffToolbar";

describe("changeCounter", () => {
  it("counts the changes until one is picked, then shows which", () => {
    expect(changeCounter(0, -1)).toBe("No changes");
    expect(changeCounter(1, -1)).toBe("1 change");
    expect(changeCounter(4, -1)).toBe("4 changes");
    expect(changeCounter(4, 1)).toBe("2 of 4");
  });

  it("shows a three-pane summary, such as its conflicts, until a change is picked", () => {
    expect(changeCounter(4, -1, "4 changes, 1 conflict")).toBe("4 changes, 1 conflict");
    expect(changeCounter(4, 0, "4 changes, 1 conflict")).toBe("1 of 4");
  });
});
