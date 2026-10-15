import { describe, expect, it } from "vitest";
import { statusLabel, statusLetter } from "./fileStatus";

describe("file status", () => {
  it("gives each kind its letter and label", () => {
    expect(statusLetter("added")).toBe("A");
    expect(statusLetter("copied")).toBe("C");
    expect(statusLetter("conflicted")).toBe("C");
    expect(statusLetter(null)).toBe("!");
    expect(statusLabel("renamed")).toBe("Renamed");
    expect(statusLabel(null)).toBe("Conflicted");
  });
});
