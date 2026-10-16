// Memory is a feature: an image or PDF element that goes away gives back what WebKit holds for it at once. A PDF
// frame is blanked first, so its document is dropped before the element goes; an image loses its source.

/** A Svelte action for an img or iframe that releases its file when the element is removed. */
export function releaseMedia(node: HTMLImageElement | HTMLIFrameElement): { destroy: () => void } {
  return {
    destroy() {
      if (node.tagName.toLowerCase() === "iframe") {
        (node as HTMLIFrameElement).src = "about:blank";
      } else {
        node.removeAttribute("src");
      }
    },
  };
}
