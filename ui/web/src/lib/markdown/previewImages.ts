// The Markdown preview's images: a local image is read once it is scrolled near and kept while a block shows it;
// remote and blocked ones show a short note instead.

import { classifyImage } from "./links";
import type { NearScreen } from "./nearScreen";
import type { PreviewCallbacks } from "./previewDom";

function placeholder(text: string, title: string | null): HTMLElement {
  const element = document.createElement("span");
  element.className = "md-image-placeholder";
  element.textContent = text;
  if (title) {
    element.title = title;
  }
  return element;
}

export class PreviewImages {
  /** Local images being read or read, by file path. */
  private loads = new Map<string, Promise<string>>();

  constructor(
    private readonly nearScreen: NearScreen,
    private readonly callbacks: Pick<PreviewCallbacks, "linkContext" | "loadImage">,
  ) {}

  /** Fills in one rendered <img>: data URLs at once, local files once scrolled near, others as a note. */
  show(image: HTMLImageElement): void {
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
      this.load(image, target.filePath, alt, raw);
    });
  }

  private load(image: HTMLImageElement, filePath: string, alt: string, raw: string): void {
    let pending = this.loads.get(filePath);
    if (!pending) {
      pending = this.callbacks.loadImage(filePath);
      this.loads.set(filePath, pending);
      // A failed load is tried again on the next render that needs it.
      pending.catch(() => this.loads.delete(filePath));
    }
    pending
      .then((url) => {
        if (image.isConnected) {
          image.src = url;
        }
      })
      .catch((error: unknown) => {
        if (image.isConnected) {
          const reason =
            error && typeof error === "object" && "message" in error ? String(error.message) : "Image not found";
          image.replaceWith(placeholder(`${alt || "Image"}: ${reason}`, raw));
        }
      });
  }

  /** Forgets images no block shows any more; one shown again is read anew (it may have changed). */
  forgetUnused(body: Element): void {
    if (this.loads.size === 0) {
      return;
    }
    const shown = new Set(
      [...body.querySelectorAll("img[data-gm-file]")].map((image) => (image as HTMLElement).dataset.gmFile),
    );
    for (const filePath of this.loads.keys()) {
      if (!shown.has(filePath)) {
        this.loads.delete(filePath);
      }
    }
  }
}
