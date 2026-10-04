// The Performance tools' measurements in the page: DOM sizes, long tasks, frame timing and the
// scroll_view walk. Nothing runs until an agent calls a tool; the long task observer starts on
// the first get_ui_performance call and reports what it saw since the previous one.

import { mermaidLoaded } from "$lib/markdown/mermaid";
import { repoStore } from "$lib/stores/repo.svelte";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import { FRAME_MS, frameStats, type FrameStats, largest, nextScroll, type ScrollWalk } from "./perfModel";
import type { ScrollTarget } from "./toolDefs";

/** The main areas of the window, counted on their own. */
const AREAS: Record<string, string> = {
  header: ".workspace header.header",
  sidebar: ".workspace aside.sidebar",
  editorArea: ".workspace .editor-area",
  bottomPanel: '.workspace section.panel[aria-label="Bottom panel"]',
  filesPanel: ".workspace aside.explorer",
};

function elementCount(root: Element | Document): number {
  return root.getElementsByTagName("*").length;
}

export function domCounts(): Record<string, number> {
  const counts: Record<string, number> = { page: elementCount(document) };
  for (const [area, selector] of Object.entries(AREAS)) {
    const element = document.querySelector(selector);
    counts[area] = element ? elementCount(element) + 1 : 0;
  }
  return counts;
}

interface LongTasks {
  supported: boolean;
  count: number;
  totalMs: number;
  maxMs: number;
  /** Milliseconds the numbers cover; 0 on the first call, which starts watching. */
  sinceMs: number;
}

class LongTaskWatcher {
  private observer: PerformanceObserver | null = null;
  private durations: number[] = [];
  private since = 0;

  get supported(): boolean {
    return typeof PerformanceObserver !== "undefined" && (PerformanceObserver.supportedEntryTypes ?? []).includes("longtask");
  }

  /** What was seen since the last call; the first call starts watching. */
  take(): LongTasks {
    const now = performance.now();
    if (!this.supported) {
      return { supported: false, count: 0, totalMs: 0, maxMs: 0, sinceMs: 0 };
    }
    if (!this.observer) {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.durations.push(entry.duration);
        }
      });
      this.observer.observe({ type: "longtask", buffered: true });
      this.since = now;
    }
    const durations = this.durations;
    this.durations = [];
    const sinceMs = Math.round(now - this.since);
    this.since = now;
    return {
      supported: true,
      count: durations.length,
      totalMs: Math.round(durations.reduce((sum, duration) => sum + duration, 0)),
      maxMs: Math.round(Math.max(0, ...durations)),
      sinceMs,
    };
  }
}

const longTasks = new LongTaskWatcher();

/** Gaps between animation frames for `durationMs`; a hidden window draws none, so a timer ends it too. */
export function sampleFrames(durationMs: number): Promise<number[]> {
  return new Promise((resolve) => {
    const intervals: number[] = [];
    if (durationMs <= 0) {
      resolve(intervals);
      return;
    }
    let last: number | null = null;
    let done = false;
    const start = performance.now();
    const finish = () => {
      if (!done) {
        done = true;
        resolve(intervals);
      }
    };
    const frame = (time: number) => {
      if (done) {
        return;
      }
      if (last !== null) {
        intervals.push(time - last);
      }
      last = time;
      if (time - start >= durationMs) {
        finish();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    setTimeout(finish, durationMs + 250);
  });
}

export async function uiPerformance(sampleMs: number): Promise<Record<string, unknown>> {
  const dom = domCounts();
  const tasks = longTasks.take();
  const frames = sampleMs > 0 ? frameStats(await sampleFrames(sampleMs)) : null;
  return {
    dom,
    tabs: repoStore.tabs.length,
    codeMirrorViews: document.querySelectorAll(".cm-editor").length,
    terminals: terminalStore.terminals.filter((terminal) => terminal.location !== "run").length,
    runSessions: terminalStore.runSessions.length,
    markdownDiagrams: document.querySelectorAll(".md-mermaid svg").length,
    // The hidden frame that holds the mermaid library; false once no document with diagrams is open.
    mermaidLoaded: mermaidLoaded(),
    markdownDiagramErrors: [...document.querySelectorAll(".md-mermaid-error")].slice(0, 3).map((element) => element.textContent ?? ""),
    longTasks: tasks,
    frames: frames ? { sampleMs, ...frames } : null,
    windowVisible: document.visibilityState === "visible",
  };
}

/** Where each target's scrollable areas are. */
const SCROLL_SELECTORS: Record<Exclude<ScrollTarget, "auto">, string> = {
  editor: ".file-host:not(.hidden) .cm-scroller",
  "markdown-preview": ".markdown-preview",
  "rich-markdown": ".rich-markdown",
  log: ".log-view .scroller",
  diff: ".diff-view .cm-scroller",
  files: "aside.explorer .list",
};

function canScroll(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement) || element.scrollHeight - element.clientHeight <= 1) {
    return false;
  }
  const overflow = getComputedStyle(element).overflowY;
  return overflow === "auto" || overflow === "scroll";
}

function visibleArea(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
  return width * height;
}

/** The target's largest visible scrollable area; "auto" looks at every element of the page. */
export function findScroller(target: ScrollTarget): HTMLElement | null {
  const selector = target === "auto" ? "body *" : SCROLL_SELECTORS[target];
  const candidates = [...document.querySelectorAll(selector)]
    .filter(canScroll)
    .map((element) => ({ element, area: visibleArea(element) }));
  return largest(candidates)?.element ?? null;
}

function describe(element: HTMLElement): string {
  const classes = [...element.classList].slice(0, 3).join(".");
  return classes ? `${element.tagName.toLowerCase()}.${classes}` : element.tagName.toLowerCase();
}

/** The longest a scroll walk may take; the server gives up on an answer after 30 s. */
export const MAX_SCROLL_MS = 25_000;

export interface ScrollResult {
  element: string;
  scrollHeight: number;
  clientHeight: number;
  speed: number;
  roundsAsked: number;
  roundsDone: number;
  durationMs: number;
  /** The walk hit MAX_SCROLL_MS, or the window stopped drawing. */
  cutShort: boolean;
  frames: FrameStats;
}

/** Scrolls one frame at a time, down and back up, then restores where it was. */
export function scrollWalk(element: HTMLElement, speed: number, rounds: number): Promise<ScrollResult> {
  return new Promise((resolve) => {
    const original = element.scrollTop;
    const maxScroll = element.scrollHeight - element.clientHeight;
    const intervals: number[] = [];
    let walk: ScrollWalk = { position: 0, direction: 1, rounds: 0 };
    let last: number | null = null;
    let done = false;
    const start = performance.now();
    element.scrollTop = 0;
    const finish = (cutShort: boolean) => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(watchdog);
      element.scrollTop = original;
      resolve({
        element: describe(element),
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        speed,
        roundsAsked: rounds,
        roundsDone: walk.rounds,
        durationMs: Math.round(performance.now() - start),
        cutShort,
        frames: frameStats(intervals, FRAME_MS),
      });
    };
    const watchdog = setTimeout(() => finish(true), MAX_SCROLL_MS);
    const frame = (time: number) => {
      if (done) {
        return;
      }
      if (last !== null) {
        intervals.push(time - last);
      }
      last = time;
      walk = nextScroll(walk, speed, maxScroll);
      element.scrollTop = walk.position;
      if (walk.rounds >= rounds) {
        finish(false);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
