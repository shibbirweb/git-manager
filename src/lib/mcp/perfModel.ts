// Pure parts of the Performance tools: frame timing summaries and the scroll walk of
// scroll_view (top to bottom and back, a number of rounds).

/** One frame at 60 Hz. */
export const FRAME_MS = 1000 / 60;

export interface FrameStats {
  frames: number;
  avgFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  /** Frames that should have been drawn in the gaps longer than one and a half frames. */
  droppedFrames: number;
  /** Frames per second over the sample. */
  fps: number;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Summarizes the gaps between animation frames. */
export function frameStats(intervals: number[], frameMs = FRAME_MS): FrameStats {
  if (intervals.length === 0) {
    return { frames: 0, avgFrameMs: 0, p95FrameMs: 0, maxFrameMs: 0, droppedFrames: 0, fps: 0 };
  }
  const sorted = [...intervals].sort((a, b) => a - b);
  const total = intervals.reduce((sum, interval) => sum + interval, 0);
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
  let dropped = 0;
  for (const interval of intervals) {
    if (interval > frameMs * 1.5) {
      dropped += Math.round(interval / frameMs) - 1;
    }
  }
  return {
    frames: intervals.length,
    avgFrameMs: round(total / intervals.length),
    p95FrameMs: round(p95),
    maxFrameMs: round(sorted[sorted.length - 1]),
    droppedFrames: dropped,
    fps: total > 0 ? round((intervals.length * 1000) / total) : 0,
  };
}

export interface ScrollWalk {
  position: number;
  /** 1 going down, -1 going back up. */
  direction: 1 | -1;
  /** Completed top-to-bottom-and-back passes. */
  rounds: number;
}

/** The next frame's scroll position: down by `speed` to `maxScroll`, then back up to 0. */
export function nextScroll(walk: ScrollWalk, speed: number, maxScroll: number): ScrollWalk {
  if (walk.direction === 1) {
    const position = Math.min(maxScroll, walk.position + speed);
    return { position, direction: position >= maxScroll ? -1 : 1, rounds: walk.rounds };
  }
  const position = Math.max(0, walk.position - speed);
  return position <= 0 ? { position: 0, direction: 1, rounds: walk.rounds + 1 } : { position, direction: -1, rounds: walk.rounds };
}

/** Frames a walk of `rounds` passes takes at `speed` pixels per frame. */
export function scrollFrameCount(maxScroll: number, speed: number, rounds: number): number {
  return Math.ceil(maxScroll / speed) * 2 * rounds;
}

export interface ScrollCandidate {
  area: number;
}

/** The largest candidate by visible area, or null. */
export function largest<T extends ScrollCandidate>(candidates: T[]): T | null {
  let best: T | null = null;
  for (const candidate of candidates) {
    if (candidate.area > 0 && (!best || candidate.area > best.area)) {
      best = candidate;
    }
  }
  return best;
}
