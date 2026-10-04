import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "./fuzzy";

function score(query: string, target: string): number {
  return fuzzyMatch(query, target)?.score ?? -Infinity;
}

describe("fuzzyMatch", () => {
  it("matches letters in order, ignoring case", () => {
    expect(fuzzyMatch("gp", "Git: Push")?.indices).toEqual([0, 5]);
    expect(fuzzyMatch("PUSH", "Git: Push")?.indices).toEqual([5, 6, 7, 8]);
    expect(fuzzyMatch("hp", "Git: Push")).toBeNull();
    expect(fuzzyMatch("pushx", "Git: Push")).toBeNull();
  });

  it("matches an empty query with nothing highlighted", () => {
    expect(fuzzyMatch("", "Anything")).toEqual({ score: 0, indices: [] });
    expect(fuzzyMatch("   ", "Anything")).toEqual({ score: 0, indices: [] });
  });

  it("matches each word on its own, in any order", () => {
    expect(fuzzyMatch("push git", "Git: Push")?.indices).toEqual([0, 1, 2, 5, 6, 7, 8]);
    expect(fuzzyMatch("git nope", "Git: Push")).toBeNull();
  });

  it("prefers word starts and runs of letters", () => {
    expect(score("sc", "Git: Stash Changes")).toBeGreaterThan(score("sc", "Git: Discard"));
    expect(score("push", "Git: Push")).toBeGreaterThan(score("push", "Git: Patch: Unshelve the shelf"));
    expect(score("tog", "View: Toggle Case")).toBeGreaterThan(score("tog", "View: Photography"));
    // camelCase humps count as word starts.
    expect(fuzzyMatch("fb", "fooBar")?.indices).toEqual([0, 3]);
  });

  it("prefers a prefix over the same letters later on", () => {
    expect(score("fetch", "Git: Fetch")).toBeGreaterThan(score("fetch", "Git: LFS > Fetch LFS Objects"));
    expect(score("save", "File: Save")).toBeGreaterThan(score("save", "File: Save Workspace As"));
  });

  it("highlights the best alignment, not the first", () => {
    // "ab" should take the word start "A" and its neighbor "b", not the earlier lone "a".
    expect(fuzzyMatch("ab", "xa Ab")?.indices).toEqual([3, 4]);
  });

  it("counts code points, so emoji-free and non-ASCII names line up", () => {
    expect(fuzzyMatch("ü", "Grüße")?.indices).toEqual([2]);
  });

  it("stays fast on long targets", () => {
    const target = "a".repeat(10_000);
    const started = performance.now();
    expect(fuzzyMatch("aaaa", target)).not.toBeNull();
    expect(performance.now() - started).toBeLessThan(200);
  });
});
