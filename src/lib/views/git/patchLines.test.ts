import { describe, expect, it } from "vitest";
import { patchLines } from "./patchLines";

describe("patchLines", () => {
  it("tells headers, hunks and changes apart", () => {
    const patch = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -2,2 +2,2 @@",
      " keep",
      "-old",
      "+new",
      "--- not a header inside a hunk",
      "",
    ].join("\n");
    expect(patchLines(patch).map((line) => line.kind)).toEqual(["file", "file", "file", "hunk", "context", "deleted", "added", "deleted"]);
  });

  it("is empty for an empty patch", () => {
    expect(patchLines("")).toEqual([]);
  });
});
