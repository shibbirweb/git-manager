// DOMPurify for the Markdown preview. Markdown may carry raw HTML, so every
// render passes through here before it touches the page: no scripts, event
// handlers, frames, forms, styles or javascript: URLs. Images lose `src` (the
// preview loads local ones itself and never fetches remote ones), and ids get
// GitHub's "user-content-" prefix so they cannot clash with the app's own.
// Separate DOMPurify instances keep these hooks away from mermaid's copy.

import DOMPurify from "dompurify";
import { ID_PREFIX } from "./links";

const purify = DOMPurify(window);
const svgPurify = DOMPurify(window);

const FORBID_TAGS = [
  "style",
  "link",
  "meta",
  "base",
  "form",
  "button",
  "textarea",
  "select",
  "option",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "portal",
  "video",
  "audio",
  "source",
  "track",
  "picture",
  "dialog",
];

const FORBID_ATTR = ["style", "srcset", "target", "action", "formaction", "ping", "autofocus", "popover", "contenteditable"];

purify.addHook("uponSanitizeAttribute", (_node, data) => {
  if ((data.attrName === "id" || data.attrName === "name") && data.attrValue && !data.attrValue.startsWith(ID_PREFIX)) {
    data.attrValue = `${ID_PREFIX}${data.attrValue}`;
  }
});

purify.addHook("afterSanitizeAttributes", (node) => {
  if (node.nodeName === "IMG") {
    const element = node as Element;
    const src = element.getAttribute("src");
    if (src !== null) {
      element.removeAttribute("src");
      if (!element.hasAttribute("data-gm-src")) {
        element.setAttribute("data-gm-src", src);
      }
    }
  }
});

/** Sanitized Markdown HTML as nodes ready to insert. */
export function sanitizeMarkdownHtml(html: string): DocumentFragment {
  const fragment = purify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
  // Only task list checkboxes are useful; other inputs would accept typing.
  for (const input of fragment.querySelectorAll("input")) {
    if (input.type !== "checkbox") {
      input.remove();
    }
  }
  return fragment;
}

/** A mermaid diagram as SVG nodes; mermaid already runs with securityLevel "strict". */
export function sanitizeSvg(svg: string): DocumentFragment {
  return svgPurify.sanitize(svg, {
    RETURN_DOM_FRAGMENT: true,
    USE_PROFILES: { svg: true, svgFilters: true, html: true },
    // Some diagram types put HTML labels in foreignObject; the diagram's own <style> is scoped to its id.
    ADD_TAGS: ["foreignObject"],
    FORBID_TAGS: [...FORBID_TAGS.filter((tag) => tag !== "style"), "a", "input"],
  });
}
