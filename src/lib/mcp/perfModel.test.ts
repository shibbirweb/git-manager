import { describe, expect, it } from "vitest";
import { FRAME_MS, frameStats, largest, nextScroll, scrollFrameCount, type ScrollWalk } from "./perfModel";

describe("frameStats", () => {
  it("is empty without frames", () => {
    expect(frameStats([])).toEqual({ frames: 0, avgFrameMs: 0, p95FrameMs: 0, maxFrameMs: 0, droppedFrames: 0, fps: 0 });
  });

  it("counts no drops at a steady 60 Hz", () => {
    const stats = frameStats(Array.from({ length: 60 }, () => FRAME_MS));
    expect(stats.droppedFrames).toBe(0);
    expect(stats.fps).toBe(60);
    expect(stats.avgFrameMs).toBe(16.7);
  });

  it("counts the frames missed in long gaps", () => {
    const stats = frameStats([FRAME_MS, FRAME_MS * 3, FRAME_MS, 100]);
    // A three-frame gap misses two frames; 100 ms misses five.
    expect(stats.droppedFrames).toBe(7);
    expect(stats.maxFrameMs).toBe(100);
    expect(stats.p95FrameMs).toBe(100);
  });
});

describe("nextScroll", () => {
  it("walks down, back up and counts the round", () => {
    let walk: ScrollWalk = { position: 0, direction: 1, rounds: 0 };
    const positions: number[] = [];
    while (walk.rounds < 1) {
      walk = nextScroll(walk, 40, 100);
      positions.push(walk.position);
    }
    expect(positions).toEqual([40, 80, 100, 60, 20, 0]);
    expect(walk.direction).toBe(1);
    expect(scrollFrameCount(100, 40, 1)).toBe(positions.length);
  });

  it("finishes a round at once when nothing scrolls", () => {
    const down = nextScroll({ position: 0, direction: 1, rounds: 0 }, 50, 0);
    expect(down.direction).toBe(-1);
    expect(nextScroll(down, 50, 0).rounds).toBe(1);
  });
});

describe("largest", () => {
  it("picks the biggest visible candidate", () => {
    expect(largest([{ area: 0 }, { area: 10, id: "a" }, { area: 30, id: "b" }])).toEqual({ area: 30, id: "b" });
    expect(largest([{ area: 0 }])).toBeNull();
    expect(largest([])).toBeNull();
  });
});
