// UI events for the debug memory log: which tab and view are on screen, and when scrolling
// starts and stops in which area, so each memory change in the log has its cause next to it.

/** Named scroll areas, most specific first; the first ancestor that matches names the area. */
const AREAS: [selector: string, name: string][] = [
  [".rich-markdown", "markdown rich editor"],
  [".markdown-preview", "markdown preview"],
  [".cm-scroller", "code editor"],
  [".terminal-frame, .xterm-viewport", "terminal"],
  [".log-view, [aria-label='Commit history']", "log"],
  [".tree", "sidebar tree"],
  [".files-panel, .explorer", "files panel"],
];

/** The area a scroll happened in, for the log. */
export function scrollAreaName(target: EventTarget | null): string {
  const element = target instanceof Element ? target : null;
  if (!element) {
    return "page";
  }
  for (const [selector, name] of AREAS) {
    if (element.closest(selector)) {
      return name;
    }
  }
  return element.className && typeof element.className === "string" ? `element .${element.className.split(/\s+/)[0]}` : "page";
}

/** What is on screen, as one log label; equal labels mean nothing changed. */
export function viewLabel(state: {
  shownView: string;
  tabPath: string | null;
  markdownMode: string | null;
  leftPanel: string | null;
  bottomPanel: string | null;
}): string {
  const tab = state.tabPath ? state.tabPath.slice(state.tabPath.lastIndexOf("/") + 1) : "none";
  const parts = [`view ${state.shownView}`, `tab ${tab}`];
  if (state.markdownMode) {
    parts.push(`markdown ${state.markdownMode}`);
  }
  parts.push(`sidebar ${state.leftPanel ?? "hidden"}`, `panel ${state.bottomPanel ?? "closed"}`);
  return parts.join(", ");
}

/** How long without a scroll event before a burst counts as stopped. */
export const SCROLL_STOP_MS = 400;

/** Reports scroll start and stop per area until the returned function is called. */
export function watchScrolling(log: (label: string) => void): () => void {
  let area: string | null = null;
  let events = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onScroll = (event: Event) => {
    const name = scrollAreaName(event.target);
    if (area !== name) {
      if (area !== null) {
        log(`scroll stop in ${area} (${events} events)`);
      }
      area = name;
      events = 0;
      log(`scroll start in ${name}`);
    }
    events++;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (area !== null) {
        log(`scroll stop in ${area} (${events} events)`);
      }
      area = null;
      events = 0;
    }, SCROLL_STOP_MS);
  };
  // Capture: scroll events do not bubble, and every scroller in the window should be seen.
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  return () => {
    clearTimeout(timer);
    window.removeEventListener("scroll", onScroll, { capture: true });
  };
}
