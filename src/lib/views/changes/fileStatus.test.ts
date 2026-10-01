import { describe, expect, it } from "vitest";
import { rowElementId } from "./fileStatus";

describe("rowElementId", () => {
  it("makes one valid id per repository, area and path", () => {
    const id = rowElementId({ repoRoot: "/work/my repo", path: "src/a b.ts", area: "unstaged" });
    expect(id).not.toMatch(/\s/);
    expect(id).not.toBe(rowElementId({ repoRoot: "/work/my repo", path: "src/a b.ts", area: "staged" }));
    expect(id).not.toBe(rowElementId({ repoRoot: "/work/other", path: "src/a b.ts", area: "unstaged" }));
    expect(id).toBe(rowElementId({ repoRoot: "/work/my repo", path: "src/a b.ts", area: "unstaged" }));
  });
});
