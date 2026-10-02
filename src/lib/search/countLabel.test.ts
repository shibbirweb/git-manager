import { describe, expect, it } from "vitest";
import { countLabel } from "./countLabel";

describe("countLabel", () => {
  it("uses the singular for one and the right plural otherwise", () => {
    expect(countLabel(1, "class")).toBe("1 class");
    expect(countLabel(2, "class")).toBe("2 classes");
    expect(countLabel(0, "class")).toBe("0 classes");
    expect(countLabel(1, "match")).toBe("1 match");
    expect(countLabel(3, "match")).toBe("3 matches");
    expect(countLabel(1, "file")).toBe("1 file");
    expect(countLabel(5, "file")).toBe("5 files");
    expect(countLabel(1, "symbol")).toBe("1 symbol");
    expect(countLabel(7, "symbol")).toBe("7 symbols");
  });
});
