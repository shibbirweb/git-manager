import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cachedMermaid,
  type DiagramBackend,
  mermaidLoaded,
  RELEASE_DELAY_MS,
  releaseMermaid,
  renderMermaid,
  setDiagramBackendForTests,
} from "./mermaid";

interface FakeBackend extends DiagramBackend {
  rendered: string[];
  disposed: boolean;
}

let backends: FakeBackend[] = [];

function fakeBackend(): FakeBackend {
  const backend: FakeBackend = {
    rendered: [],
    disposed: false,
    render: async (_diagramId, source) => {
      backend.rendered.push(source);
      return { svg: `<svg>${source}</svg>` };
    },
    dispose: () => {
      backend.disposed = true;
    },
  };
  backends.push(backend);
  return backend;
}

describe("mermaid diagrams in a frame that goes with the last document", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The built-in themes: no color theme attribute, so no CSS is read.
    vi.stubGlobal("document", { documentElement: { getAttribute: () => null } });
    backends = [];
    setDiagramBackendForTests(fakeBackend);
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("loads nothing until a diagram is drawn, then draws each source once", async () => {
    const preview = {};
    expect(mermaidLoaded()).toBe(false);
    expect(await renderMermaid(preview, "graph TD; A-->B", false)).toEqual({ svg: "<svg>graph TD; A-->B</svg>" });
    expect(await renderMermaid(preview, "graph TD; A-->B", false)).toEqual({ svg: "<svg>graph TD; A-->B</svg>" });
    expect(mermaidLoaded()).toBe(true);
    expect(backends).toHaveLength(1);
    expect(backends[0].rendered).toEqual(["graph TD; A-->B"]);
    releaseMermaid(preview);
  });

  it("removes the frame and the drawn diagrams after the last document closes", async () => {
    const first = {};
    const second = {};
    await renderMermaid(first, "graph LR; X-->Y", false);
    await renderMermaid(second, "graph LR; X-->Y", false);
    releaseMermaid(first);
    vi.advanceTimersByTime(RELEASE_DELAY_MS);
    expect(backends[0].disposed).toBe(false);
    releaseMermaid(second);
    vi.advanceTimersByTime(RELEASE_DELAY_MS - 1);
    expect(mermaidLoaded()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(backends[0].disposed).toBe(true);
    expect(mermaidLoaded()).toBe(false);
    expect(cachedMermaid("graph LR; X-->Y", false)).toBeNull();
    // The next diagram loads a new frame.
    const third = {};
    await renderMermaid(third, "graph LR; X-->Y", false);
    expect(backends).toHaveLength(2);
    releaseMermaid(third);
  });

  it("keeps the frame when a diagram is drawn again before the delay ends", async () => {
    const preview = {};
    await renderMermaid(preview, "graph TD; P-->Q", false);
    releaseMermaid(preview);
    vi.advanceTimersByTime(RELEASE_DELAY_MS / 2);
    const moved = {};
    await renderMermaid(moved, "graph TD; P-->Q", false);
    vi.advanceTimersByTime(RELEASE_DELAY_MS);
    expect(backends[0].disposed).toBe(false);
    releaseMermaid(moved);
  });

  it("ignores releasing a user that drew nothing", () => {
    releaseMermaid({});
    vi.advanceTimersByTime(RELEASE_DELAY_MS);
    expect(backends).toHaveLength(0);
  });
});

describe("diagrams waiting when the frame goes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("document", { documentElement: { getAttribute: () => null } });
    backends = [];
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not bring the frame back for a diagram that waited in the queue", async () => {
    let finish: (value: { svg: string }) => void = () => undefined;
    setDiagramBackendForTests(() => {
      const backend = fakeBackend();
      backend.render = (_diagramId, source) => {
        backend.rendered.push(source);
        return new Promise((resolve) => {
          finish = resolve;
        });
      };
      return backend;
    });
    const preview = {};
    const slow = renderMermaid(preview, "graph TD; slow", false);
    const queued = renderMermaid(preview, "graph TD; queued", false);
    await Promise.resolve();
    releaseMermaid(preview);
    vi.advanceTimersByTime(RELEASE_DELAY_MS);
    expect(mermaidLoaded()).toBe(false);
    finish({ svg: "<svg/>" });
    await slow;
    expect(await queued).toEqual({ error: "Diagram closed" });
    expect(mermaidLoaded()).toBe(false);
    expect(backends).toHaveLength(1);
    expect(cachedMermaid("graph TD; slow", false)).toBeNull();
  });
});
