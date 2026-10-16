// Layout debugging for bugs a screenshot shows but cannot explain, such as the whole UI sliding up under the
// title bar. inspect_layout reports the window, the page's own scroll, every scrolled container, every element
// that reaches past the window and the focused element. trace_scrolls records every scroll between start and
// stop, and every scrollIntoView, scrollTo, scrollBy, scrollTop and focus call with the code that made it.

const PATH_DEPTH = 6;
const MAX_LISTED = 40;
const MAX_EVENTS = 300;
const STACK_LINES = 8;
/** A trace left running restores the browser's functions by itself after this long. */
export const TRACE_AUTO_STOP_MS = 60_000;

export interface ScrollState {
  top: number;
  left: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
}

export function scrollState(element: Element): ScrollState {
  return {
    top: Math.round(element.scrollTop),
    left: Math.round(element.scrollLeft),
    scrollHeight: element.scrollHeight,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
  };
}

function elementName(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (element.id) {
    return `${tag}#${element.id}`;
  }
  // Svelte's scoping classes say nothing about the element.
  const classes =
    typeof element.className === "string"
      ? element.className
          .split(/\s+/)
          .filter((name) => name !== "" && !name.startsWith("svelte-"))
          .slice(0, 3)
      : [];
  const label = element.getAttribute("aria-label");
  return `${tag}${classes.map((name) => `.${name}`).join("")}${label ? `[aria-label="${label.slice(0, 40)}"]` : ""}`;
}

/** A short readable path to the element: up to six levels, stopping at an id. */
export function elementPath(element: Element): string {
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== document.documentElement && parts.length < PATH_DEPTH) {
    parts.unshift(elementName(node));
    if (node.id) {
      break;
    }
    node = node.parentElement;
  }
  return parts.length > 0 ? parts.join(" > ") : element.tagName.toLowerCase();
}

function rounded(rect: DOMRect): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

/** inspect_layout: what scrolled and what reaches past the window, the usual causes of a UI that moved. */
export function inspectLayout(): Record<string, unknown> {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scrolled: Record<string, unknown>[] = [];
  const pastWindow: Record<string, unknown>[] = [];
  let scrolledCount = 0;
  let pastWindowCount = 0;
  for (const element of document.querySelectorAll("body *")) {
    if (element.scrollTop !== 0 || element.scrollLeft !== 0) {
      scrolledCount++;
      if (scrolled.length < MAX_LISTED) {
        scrolled.push({ path: elementPath(element), ...scrollState(element) });
      }
    }
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || (rect.bottom <= height + 1 && rect.right <= width + 1)) {
      continue;
    }
    // Only where it starts: the first element past the edge whose parent still fits.
    const parent = element.parentElement?.getBoundingClientRect() ?? null;
    if (parent && parent.bottom <= height + 1 && parent.right <= width + 1) {
      pastWindowCount++;
      if (pastWindow.length < MAX_LISTED) {
        pastWindow.push({
          path: elementPath(element),
          rect: rounded(rect),
          position: getComputedStyle(element).position,
        });
      }
    }
  }
  const focused = document.activeElement;
  return {
    window: {
      width,
      height,
      scrollX: Math.round(window.scrollX),
      scrollY: Math.round(window.scrollY),
      devicePixelRatio: window.devicePixelRatio,
    },
    html: scrollState(document.documentElement),
    body: scrollState(document.body),
    focused: focused && focused !== document.body ? elementPath(focused) : null,
    scrolledCount,
    scrolled,
    pastWindowCount,
    pastWindow,
  };
}

/** The app's own lines of a stack, without the dev server's address and cache-busting queries. */
export function trimStack(stack: string, origin: string): string[] {
  return stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.includes("layoutDebug"))
    .map((line) =>
      line
        .split(origin)
        .join("")
        .replace(/\?[^:\s)]*(?=:\d)/g, ""),
    )
    .slice(0, STACK_LINES);
}

export interface TraceEvent {
  /** Milliseconds since the trace started. */
  at: number;
  kind: "scroll" | "scrollIntoView" | "scrollTo" | "scrollBy" | "scrollTop" | "focus";
  target: string;
  /** The scroll position after a scroll event, or the call's arguments. */
  detail: string;
  /** Who called; empty for scroll events, which arrive after the fact. */
  stack: string[];
}

type Patch = () => void;

function patchMethod<T extends object>(owner: T, name: string, wrap: (original: Function) => Function): Patch {
  const record = owner as Record<string, unknown>;
  const original = record[name];
  if (typeof original !== "function") {
    return () => undefined;
  }
  record[name] = wrap(original);
  return () => {
    record[name] = original;
  };
}

function targetOf(value: unknown): string {
  if (value instanceof Element) {
    return elementPath(value);
  }
  return value === window || value === document ? "window" : "unknown";
}

/** trace_scrolls: wraps the browser's scrolling and focus functions while a trace runs. */
export class ScrollTrace {
  #events: TraceEvent[] = [];
  #dropped = 0;
  #started = 0;
  #stopped: number | null = null;
  #restore: Patch[] = [];
  #timer: ReturnType<typeof setTimeout> | undefined;

  get running(): boolean {
    return this.#restore.length > 0;
  }

  start(): void {
    this.#unpatch();
    this.#events = [];
    this.#dropped = 0;
    this.#started = performance.now();
    this.#stopped = null;
    const record = (kind: TraceEvent["kind"], target: unknown, detail: string, withStack: boolean) => {
      if (this.#events.length >= MAX_EVENTS) {
        this.#dropped++;
        return;
      }
      this.#events.push({
        at: Math.round(performance.now() - this.#started),
        kind,
        target: targetOf(target),
        detail,
        stack: withStack ? trimStack(new Error().stack ?? "", location.origin) : [],
      });
    };
    const describe = (args: unknown[]) => JSON.stringify(args) ?? "";
    for (const kind of ["scrollIntoView", "scrollTo", "scrollBy"] as const) {
      this.#restore.push(
        patchMethod(
          Element.prototype,
          kind,
          (original) =>
            function (this: Element, ...args: unknown[]) {
              record(kind, this, describe(args), true);
              return original.apply(this, args);
            },
        ),
      );
    }
    for (const kind of ["scrollTo", "scrollBy"] as const) {
      this.#restore.push(
        patchMethod(
          window,
          kind,
          (original) =>
            function (this: Window, ...args: unknown[]) {
              record(kind, window, describe(args), true);
              return original.apply(this, args);
            },
        ),
      );
    }
    this.#restore.push(
      patchMethod(
        HTMLElement.prototype,
        "focus",
        (original) =>
          function (this: HTMLElement, ...args: unknown[]) {
            record("focus", this, describe(args), true);
            return original.apply(this, args);
          },
      ),
    );
    const scrollTop = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
    if (scrollTop?.set && scrollTop.configurable) {
      const setter = scrollTop.set;
      Object.defineProperty(Element.prototype, "scrollTop", {
        ...scrollTop,
        set(this: Element, value: number) {
          record("scrollTop", this, String(value), true);
          setter.call(this, value);
        },
      });
      this.#restore.push(() => Object.defineProperty(Element.prototype, "scrollTop", scrollTop));
    }
    const onScroll = (event: Event) => {
      const target = event.target === document ? document.documentElement : event.target;
      const position =
        target instanceof Element ? `top=${Math.round(target.scrollTop)} left=${Math.round(target.scrollLeft)}` : "";
      record("scroll", event.target, position, false);
    };
    document.addEventListener("scroll", onScroll, { capture: true });
    this.#restore.push(() => document.removeEventListener("scroll", onScroll, { capture: true }));
    this.#timer = setTimeout(() => this.#unpatch(), TRACE_AUTO_STOP_MS);
  }

  /** Ends the trace (if it still runs) and hands over what it saw. */
  stop(): { durationMs: number; events: TraceEvent[]; dropped: number } {
    this.#unpatch();
    const end = this.#stopped ?? performance.now();
    return { durationMs: Math.round(end - this.#started), events: this.#events, dropped: this.#dropped };
  }

  #unpatch(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    if (this.#restore.length > 0) {
      this.#stopped = performance.now();
    }
    for (const restore of this.#restore.reverse()) {
      restore();
    }
    this.#restore = [];
  }
}

export const scrollTrace = new ScrollTrace();
