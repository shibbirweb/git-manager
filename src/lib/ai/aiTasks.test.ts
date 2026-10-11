import { describe, expect, it } from "vitest";
import { prepareSummary } from "./aiTasks";

describe("prepareSummary", () => {
  it("joins what the worktrees copied, linked and skipped, once each", () => {
    const report = {
      copied: [".env"],
      linked: ["node_modules"],
      skipped: [{ path: "secret*", reason: "patterns are not supported: list the path itself" }],
    };
    expect(prepareSummary([report, report])).toBe(
      "Copied .env; linked node_modules; skipped secret*: patterns are not supported: list the path itself",
    );
  });

  it("is empty when nothing was done", () => {
    expect(prepareSummary([])).toBe("");
    expect(prepareSummary([{ copied: [], linked: [], skipped: [] }])).toBe("");
  });
});
