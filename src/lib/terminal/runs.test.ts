import { describe, expect, it } from "vitest";
import { runAfterClose, runFinishedMessage, runHeader } from "./runs";

describe("run messages", () => {
  it("prints the command above and the exit code below, like JetBrains", () => {
    const header = runHeader({ runId: "x", program: "pnpm", args: ["run", "dev"], cwd: "/app", nodeBinDir: null, description: "pnpm run dev" });
    expect(header).toBe("\x1b[2mpnpm run dev\x1b[0m\r\n\r\n");
    expect(runFinishedMessage(0)).toContain("Process finished with exit code 0");
    expect(runFinishedMessage(1)).toContain("Process finished with exit code 1");
    expect(runFinishedMessage(null)).toContain("Process stopped");
  });
});

describe("runAfterClose", () => {
  it("keeps the shown session, or shows a neighbor of the closed one", () => {
    expect(runAfterClose([1, 2, 3], 2, 1)).toBe(1);
    expect(runAfterClose([1, 2, 3], 2, 2)).toBe(3);
    expect(runAfterClose([1, 2, 3], 3, 3)).toBe(2);
    expect(runAfterClose([4], 4, 4)).toBeNull();
  });
});
