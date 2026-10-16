import { describe, expect, it } from "vitest";
import { chunkBlocks, chunkName } from "./chunks";

describe("chunkBlocks", () => {
  it("keeps whole blocks together and starts a new chunk before the limit", () => {
    const blocks = [["a", "a"], ["b", "b", "b"], ["c"]];
    expect(chunkBlocks(blocks, 1, 5)).toEqual([[["a", "a"]], [["b", "b", "b"], ["c"]]]);
    expect(chunkBlocks(blocks, 0, 100)).toEqual([blocks]);
  });

  it("always gives at least one chunk", () => {
    expect(chunkBlocks([], 3)).toEqual([[]]);
  });

  it("names the first file plainly and numbers the rest", () => {
    expect(chunkName("GMComponents", ".swift", 0)).toBe("GMComponents.swift");
    expect(chunkName("components-", ".css", 1)).toBe("components-2.css");
  });
});
