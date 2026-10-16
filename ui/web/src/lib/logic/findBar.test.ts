import { describe, expect, it } from "vitest";
import { findCounter, findKey, type FindKey } from "./findBar";

const key = (init: Partial<FindKey>): FindKey => ({ key: "", shiftKey: false, isComposing: false, ...init });

describe("findCounter", () => {
  it("is empty without a query", () => {
    expect(findCounter("", 0, 0)).toBe("");
  });

  it("counts matches or says none", () => {
    expect(findCounter("total", 2, 5)).toBe("2 of 5");
    expect(findCounter("total", 0, 0)).toBe("No results");
  });
});

describe("findKey", () => {
  it("steps with Enter and closes with Esc", () => {
    expect(findKey(key({ key: "Enter" }))).toBe("next");
    expect(findKey(key({ key: "Enter", shiftKey: true }))).toBe("previous");
    expect(findKey(key({ key: "Escape" }))).toBe("close");
  });

  it("leaves other keys and composition alone", () => {
    expect(findKey(key({ key: "a" }))).toBeNull();
    expect(findKey(key({ key: "Enter", isComposing: true }))).toBeNull();
  });
});
