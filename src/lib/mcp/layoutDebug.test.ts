// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { elementPath, inspectLayout, ScrollTrace, trimStack } from "./layoutDebug";

afterEach(() => {
  document.body.replaceChildren();
});

function element(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

describe("elementPath", () => {
  it("names tags, classes and labels, without Svelte's scoping classes", () => {
    const host = element('<section class="panel svelte-abc12" aria-label="Changes"><p class="row">x</p></section>');
    const row = host.querySelector("p") as HTMLElement;
    expect(elementPath(row)).toBe('body > div > section.panel[aria-label="Changes"] > p.row');
  });

  it("stops at an id", () => {
    const host = element('<main id="app"><span class="a"></span></main>');
    expect(elementPath(host.querySelector("span") as HTMLElement)).toBe("main#app > span.a");
  });
});

describe("trimStack", () => {
  it("drops the dev server address, query strings and the tracer's own frames", () => {
    const stack = [
      "record@http://127.0.0.1:1420/src/lib/mcp/layoutDebug.ts?t=1:10:5",
      "scrollIntoView@http://127.0.0.1:1420/node_modules/.vite/deps/prosemirror-view.js?v=ab12:4021:9",
      "focus@http://127.0.0.1:1420/src/lib/markdown/richEditor.ts?t=99:130:20",
    ].join("\n");
    expect(trimStack(stack, "http://127.0.0.1:1420")).toEqual([
      "scrollIntoView@/node_modules/.vite/deps/prosemirror-view.js:4021:9",
      "focus@/src/lib/markdown/richEditor.ts:130:20",
    ]);
  });
});

describe("ScrollTrace", () => {
  it("records scroll calls with their target and restores the browser's functions", () => {
    const original = Element.prototype.scrollIntoView;
    const host = element('<div class="pane"></div>');
    const pane = host.querySelector(".pane") as HTMLElement;
    const trace = new ScrollTrace();
    trace.start();
    expect(trace.running).toBe(true);
    pane.scrollIntoView({ block: "start" });
    pane.scrollTop = 40;
    const result = trace.stop();
    expect(trace.running).toBe(false);
    expect(Element.prototype.scrollIntoView).toBe(original);
    const calls = result.events.filter((event) => event.kind !== "scroll");
    expect(calls.map((event) => event.kind)).toEqual(["scrollIntoView", "scrollTop"]);
    expect(calls[0].target).toBe("body > div > div.pane");
    expect(calls[0].detail).toBe('[{"block":"start"}]');
    expect(calls[1].detail).toBe("40");
  });

  it("keeps the events of a trace that stopped on its own until they are asked for", () => {
    const trace = new ScrollTrace();
    trace.start();
    document.body.focus();
    const first = trace.stop();
    expect(trace.stop().events).toEqual(first.events);
  });
});

describe("inspectLayout", () => {
  it("reports the window, the page's scroll and the focused element", () => {
    const host = element('<input class="field">');
    (host.querySelector("input") as HTMLInputElement).focus();
    const report = inspectLayout() as { window: { width: number }; focused: string | null; scrolledCount: number };
    expect(report.window.width).toBe(window.innerWidth);
    expect(report.focused).toBe("body > div > input.field");
    expect(report.scrolledCount).toBe(0);
  });
});
