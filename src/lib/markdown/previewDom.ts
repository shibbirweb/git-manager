// The DOM side of the Markdown preview, kept out of the Svelte component so it
// can be measured on its own. The renderer hands over one HTML segment per
// top-level block; each lives in its own `display: contents` wrapper, and a
// render sanitizes and replaces only the segments whose HTML changed. Others
// keep their nodes (with loaded images and drawn diagrams) and only get their
// `data-line` numbers moved when lines were added or removed above them.

import type * as Engine from "./engine";
import type { CodeHighlighter } from "./highlight";
import { classifyImage, classifyLink, ID_PREFIX, type LinkContext, type LinkTarget } from "./links";
import { cachedMermaid, type MermaidResult, renderMermaid } from "./mermaid";
import { NearScreen, releaseDiagram, restoreDiagramHeight } from "./nearScreen";
import { buildAnchors, type LineAnchor, lineForOffset, offsetForLine } from "./scrollSync";

type EngineModule = typeof Engine;

export interface PreviewCallbacks {
  /** Where links and images are resolved. */
  linkContext: () => LinkContext;
  /** The URL of a local image (the `gmpreview` scheme, so its bytes stay out of JavaScript). */
  loadImage: (filePath: string) => Promise<string>;
  isDark: () => boolean;
}

interface ShownSegment {
  /** The segment's HTML without line numbers: equal means unchanged. */
  signature: string;
  line: number;
  wrapper: HTMLElement;
}

const LINE_ATTRIBUTES = / data-(?:task-)?line="\d+"/g;

/** Moves every line number inside a kept segment by `delta`. */
function shiftLines(wrapper: HTMLElement, delta: number): void {
  for (const element of wrapper.querySelectorAll("[data-line], [data-task-line]")) {
    for (const name of ["data-line", "data-task-line"]) {
      const value = element.getAttribute(name);
      if (value !== null) {
        element.setAttribute(name, String(Number(value) + delta));
      }
    }
  }
}

function placeholder(text: string, title: string | null): HTMLElement {
  const element = document.createElement("span");
  element.className = "md-image-placeholder";
  element.textContent = text;
  if (title) {
    element.title = title;
  }
  return element;
}

export class MarkdownPreviewDom {
  private renderer: ReturnType<EngineModule["createRenderer"]>;
  private shown: ShownSegment[] = [];
  private mermaidSources = new WeakMap<Element, string>();
  private images = new Map<string, Promise<string>>();
  private anchorCache: LineAnchor[] | null = null;
  private lastLineCount = 1;
  /** Diagrams are drawn and local images loaded only near the visible part of the preview. */
  private readonly nearScreen: NearScreen;

  constructor(
    private readonly engine: EngineModule,
    private readonly body: HTMLElement,
    private readonly highlighter: CodeHighlighter,
    private readonly callbacks: PreviewCallbacks,
  ) {
    this.renderer = engine.createRenderer({ highlight: (code, language) => highlighter.highlight(code, language) });
    // The preview's scroller is the body's parent.
    this.nearScreen = new NearScreen(body.parentElement);
  }

  /** Stops watching for diagrams and images to draw; the preview is going away. */
  destroy(): void {
    this.nearScreen.disconnect();
  }

  /** Renders `source`, touching only the segments that changed. */
  render(source: string): void {
    this.lastLineCount = Math.max(1, source.split("\n").length);
    const { segments, hasMermaid, hasRawHtml } = this.renderer.render(source);
    this.highlighter.sweep();
    const signatures = segments.map((segment) => segment.html.replace(LINE_ATTRIBUTES, ""));
    const old = this.shown;

    let prefix = 0;
    while (prefix < old.length && prefix < segments.length && old[prefix].signature === signatures[prefix]) {
      prefix++;
    }
    let suffix = 0;
    while (
      suffix < old.length - prefix &&
      suffix < segments.length - prefix &&
      old[old.length - 1 - suffix].signature === signatures[segments.length - 1 - suffix]
    ) {
      suffix++;
    }

    const kept = old.slice(old.length - suffix);
    const moveLines = (segment: ShownSegment, line: number) => {
      if (segment.line !== line) {
        shiftLines(segment.wrapper, line - segment.line);
        segment.line = line;
      }
    };
    old.slice(0, prefix).forEach((segment, index) => moveLines(segment, segments[index].line));
    kept.forEach((segment, index) => moveLines(segment, segments[segments.length - suffix + index].line));
    const before = kept[0]?.wrapper ?? null;
    for (const segment of old.slice(prefix, old.length - suffix)) {
      this.nearScreen.unwatchWithin(segment.wrapper);
      segment.wrapper.remove();
    }
    const changed = segments.slice(prefix, segments.length - suffix);
    const wrappers = this.wrapSegments(changed.map((segment) => segment.html), hasRawHtml);
    const inserted: ShownSegment[] = wrappers.map((wrapper, index) => {
      this.body.insertBefore(wrapper, before);
      return { signature: signatures[prefix + index], line: changed[index].line, wrapper };
    });
    for (const segment of inserted) {
      this.decorate(segment.wrapper, hasMermaid);
    }
    this.shown = [...old.slice(0, prefix), ...inserted, ...kept];
    if (inserted.length > 0 || old.length !== segments.length) {
      this.anchorCache = null;
      this.forgetUnusedImages();
    }
  }

  /**
   * Sanitized wrappers for segments. Many segments without raw HTML (opening a
   * file) go through DOMPurify in one call: markdown-it's own output is always
   * well-formed, so the wrappers come back intact. Raw HTML may not be, so each
   * of those segments is sanitized on its own and cannot swallow its neighbours.
   */
  private wrapSegments(htmls: string[], hasRawHtml: boolean): HTMLElement[] {
    if (!hasRawHtml && htmls.length > 8) {
      const fragment = this.engine.sanitizeMarkdownHtml(htmls.map((html) => `<div class="md-block">${html}</div>`).join(""));
      const wrappers = [...fragment.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
      if (wrappers.length === htmls.length && wrappers.every((wrapper) => wrapper.className === "md-block")) {
        return wrappers;
      }
    }
    return htmls.map((html) => {
      const wrapper = document.createElement("div");
      wrapper.className = "md-block";
      wrapper.append(this.engine.sanitizeMarkdownHtml(html));
      return wrapper;
    });
  }

  /** Links get their target as a tooltip; images and diagrams are filled in. */
  private decorate(root: Element, hasMermaid: boolean): void {
    for (const link of root.querySelectorAll("a[href]")) {
      if (!link.hasAttribute("title")) {
        link.setAttribute("title", link.getAttribute("href") ?? "");
      }
    }
    for (const image of root.querySelectorAll("img[data-gm-src]")) {
      this.showImage(image as HTMLImageElement);
    }
    if (hasMermaid) {
      for (const diagram of root.querySelectorAll<HTMLElement>(".md-mermaid")) {
        const source = diagram.querySelector(".md-mermaid-source")?.textContent ?? "";
        this.mermaidSources.set(diagram, source);
        // Drawn when scrolled near, freed again when far away.
        this.nearScreen.watch(
          diagram,
          () => {
            diagram.dataset.near = "true";
            this.drawDiagram(diagram, this.mermaidSources.get(diagram) ?? source);
          },
          () => {
            delete diagram.dataset.near;
            releaseDiagram(diagram);
          },
        );
      }
    }
  }

  private showImage(image: HTMLImageElement): void {
    const raw = image.getAttribute("data-gm-src") ?? "";
    const alt = image.getAttribute("alt") ?? "";
    const target = classifyImage(raw, this.callbacks.linkContext());
    if (target.kind === "data") {
      image.src = target.url;
      return;
    }
    if (target.kind === "remote") {
      image.replaceWith(placeholder(`${alt || "Image"}: Remote image not loaded`, target.url));
      return;
    }
    if (target.kind === "blocked") {
      image.replaceWith(placeholder(`${alt || "Image"}: ${target.reason}`, raw));
      return;
    }
    image.dataset.gmFile = target.filePath;
    // Loaded once it is scrolled near, so images far down are never read.
    this.nearScreen.watch(image, () => {
      this.nearScreen.unwatch(image);
      this.loadLocalImage(image, target.filePath, alt, raw);
    });
  }

  private loadLocalImage(image: HTMLImageElement, filePath: string, alt: string, raw: string): void {
    let pending = this.images.get(filePath);
    if (!pending) {
      pending = this.callbacks.loadImage(filePath);
      this.images.set(filePath, pending);
      // A failed load is tried again on the next render that needs it.
      pending.catch(() => this.images.delete(filePath));
    }
    pending
      .then((url) => {
        if (image.isConnected) {
          image.src = url;
        }
      })
      .catch((error: unknown) => {
        if (image.isConnected) {
          const reason = error && typeof error === "object" && "message" in error ? String(error.message) : "Image not found";
          image.replaceWith(placeholder(`${alt || "Image"}: ${reason}`, raw));
        }
      });
  }

  /** Forgets images no block shows any more; one shown again is read anew (it may have changed). */
  private forgetUnusedImages(): void {
    if (this.images.size === 0) {
      return;
    }
    const shown = new Set([...this.body.querySelectorAll("img[data-gm-file]")].map((image) => (image as HTMLElement).dataset.gmFile));
    for (const filePath of this.images.keys()) {
      if (!shown.has(filePath)) {
        this.images.delete(filePath);
      }
    }
  }

  private applyDiagram(diagram: HTMLElement, result: MermaidResult): void {
    restoreDiagramHeight(diagram);
    if ("svg" in result) {
      diagram.replaceChildren(this.engine.sanitizeSvg(result.svg));
      diagram.classList.remove("error");
    } else {
      const message = document.createElement("pre");
      message.className = "md-mermaid-error";
      message.textContent = `Mermaid: ${result.error}`;
      diagram.replaceChildren(message);
      diagram.classList.add("error");
    }
    this.anchorCache = null;
  }

  private drawDiagram(diagram: HTMLElement, source: string): void {
    const dark = this.callbacks.isDark();
    const cached = cachedMermaid(source, dark);
    if (cached) {
      this.applyDiagram(diagram, cached);
      return;
    }
    diagram.classList.add("loading");
    void renderMermaid(source, dark).then((result) => {
      diagram.classList.remove("loading");
      // Scrolled far away while it was drawn: it stays freed until it comes near again.
      if (diagram.isConnected && diagram.dataset.near === "true" && this.mermaidSources.get(diagram) === source) {
        this.applyDiagram(diagram, result);
      }
    });
  }

  /** Draws the shown diagrams again, after the theme changed; freed ones get the new theme when drawn. */
  redrawDiagrams(): void {
    for (const diagram of this.body.querySelectorAll<HTMLElement>(".md-mermaid")) {
      const source = this.mermaidSources.get(diagram);
      if (source !== undefined && diagram.dataset.released !== "true" && diagram.childElementCount > 0) {
        this.drawDiagram(diagram, source);
      }
    }
  }

  /** Block positions changed (resize, an image loaded); anchors are measured again when needed. */
  invalidateLayout(): void {
    this.anchorCache = null;
  }

  private anchors(scroller: HTMLElement): LineAnchor[] {
    if (!this.anchorCache) {
      const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
      const blocks = [...this.body.querySelectorAll("[data-line]")].map((element) => ({
        line: Number(element.getAttribute("data-line")),
        top: element.getBoundingClientRect().top - base,
      }));
      this.anchorCache = buildAnchors(blocks);
    }
    return this.anchorCache;
  }

  /** Scroll offset in `scroller` that shows a (fractional) source line at the top. */
  offsetForLine(scroller: HTMLElement, line: number): number {
    return offsetForLine(this.anchors(scroller), line, this.lastLineCount, scroller.scrollHeight);
  }

  /** The (fractional) source line at the top of `scroller`. */
  lineAtOffset(scroller: HTMLElement, offset: number): number {
    return lineForOffset(this.anchors(scroller), offset, this.lastLineCount, scroller.scrollHeight);
  }

  /** What a click on a link in the preview should do. */
  linkTarget(link: Element): LinkTarget {
    return classifyLink(link.getAttribute("href") ?? "", this.callbacks.linkContext());
  }

  /** The element an "#anchor" link points at: a heading id, an id or name from raw HTML. */
  anchorElement(anchorId: string): Element | null {
    const id = anchorId.startsWith(ID_PREFIX) ? anchorId : `${ID_PREFIX}${anchorId}`;
    const lower = `${ID_PREFIX}${anchorId.toLowerCase()}`;
    for (const candidate of [id, lower]) {
      const escaped = CSS.escape(candidate);
      const found = this.body.querySelector(`#${escaped}, [name="${escaped}"]`);
      if (found) {
        return found;
      }
    }
    return null;
  }
}
