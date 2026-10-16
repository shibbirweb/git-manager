// The rich editor's own drawing of images and code blocks (ProseMirror node views): local images load once
// scrolled near, and a mermaid block shows its diagram under the code.

import type { Node as ProseNode } from "@tiptap/pm/model";
import type { NodeView } from "@tiptap/pm/view";
import { classifyImage, type LinkContext } from "./links";
import { renderMermaid } from "./mermaid";
import { type NearScreen, releaseDiagram, restoreDiagramHeight } from "./nearScreen";
import { sanitizeSvg } from "./sanitize";

/** What the node views need from their editor. */
export interface NodeViewContext {
  /** Holds the editor's diagrams in mermaid.ts, released when the editor closes. */
  owner: object;
  /** Null once the editor is destroyed. */
  nearScreen: () => NearScreen | null;
  linkContext: () => LinkContext;
  loadImage: (filePath: string) => Promise<string>;
  isDark: () => boolean;
}

const MERMAID_DELAY_MS = 400;

export function imageView(node: ProseNode, context: NodeViewContext): NodeView {
  const dom = document.createElement("img");
  let shown = "";
  const show = (current: ProseNode) => {
    const src = String(current.attrs.src ?? "");
    dom.alt = String(current.attrs.alt ?? "");
    dom.title = String(current.attrs.title ?? "");
    if (src === shown) {
      return;
    }
    shown = src;
    dom.removeAttribute("src");
    dom.classList.remove("md-image-blocked");
    const target = classifyImage(src, context.linkContext());
    if (target.kind === "data") {
      dom.src = target.url;
    } else if (target.kind === "local") {
      const load = () => {
        void context
          .loadImage(target.filePath)
          .then((url) => {
            if (shown === src) {
              dom.src = url;
            }
          })
          .catch((error: unknown) => {
            dom.classList.add("md-image-blocked");
            dom.title = error instanceof Error ? error.message : String(error);
          });
      };
      // Loaded once scrolled near, like the preview's images.
      const nearScreen = context.nearScreen();
      if (nearScreen) {
        nearScreen.unwatch(dom);
        nearScreen.watch(dom, () => {
          nearScreen.unwatch(dom);
          load();
        });
      } else {
        load();
      }
    } else {
      dom.classList.add("md-image-blocked");
      dom.title = target.kind === "remote" ? "Remote images are not loaded" : target.reason;
    }
  };
  show(node);
  return {
    dom,
    update: (updated) => {
      if (updated.type !== node.type) {
        return false;
      }
      show(updated);
      return true;
    },
    destroy: () => context.nearScreen()?.unwatch(dom),
  };
}

/**
 * Code blocks; a mermaid block also shows its diagram under the code. The diagram is drawn
 * only while it is near the screen and freed when scrolled far away (see nearScreen.ts).
 */
export function codeView(node: ProseNode, context: NodeViewContext): NodeView {
  const dom = document.createElement("div");
  dom.className = "md-rich-code";
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  pre.appendChild(code);
  dom.appendChild(pre);
  const diagram = document.createElement("div");
  diagram.className = "md-mermaid";
  diagram.contentEditable = "false";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest = "";
  let drawn: string | null = null;
  let near = false;
  let watching = false;

  const render = (delay: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const text = latest;
      drawn = text;
      void renderMermaid(context.owner, text, context.isDark()).then((result) => {
        if (drawn !== text || !near) {
          return;
        }
        restoreDiagramHeight(diagram);
        if ("svg" in result) {
          // Sanitized like the preview's diagrams: a document's diagram is untrusted input.
          diagram.replaceChildren(sanitizeSvg(result.svg));
          diagram.classList.remove("md-mermaid-error");
        } else {
          diagram.textContent = result.error;
          diagram.classList.add("md-mermaid-error");
        }
      });
    }, delay);
  };

  const update = (current: ProseNode) => {
    const language = String(current.attrs.language ?? "");
    code.className = language ? `language-${language}` : "";
    pre.dataset.language = language;
    if (language !== "mermaid") {
      if (watching) {
        context.nearScreen()?.unwatch(diagram);
        watching = false;
      }
      clearTimeout(timer);
      diagram.remove();
      drawn = null;
      return;
    }
    latest = current.textContent;
    if (!diagram.isConnected) {
      dom.appendChild(diagram);
    }
    if (!watching) {
      watching = true;
      context.nearScreen()?.watch(
        diagram,
        () => {
          near = true;
          if (drawn !== latest || diagram.childElementCount === 0) {
            render(0);
          }
        },
        () => {
          near = false;
          clearTimeout(timer);
          drawn = null;
          releaseDiagram(diagram);
        },
      );
    } else if (near && latest !== drawn) {
      // Typing in the diagram's code draws it again after a pause.
      render(MERMAID_DELAY_MS);
    }
  };
  update(node);
  return {
    dom,
    contentDOM: code,
    update: (updated) => {
      if (updated.type !== node.type) {
        return false;
      }
      update(updated);
      return true;
    },
    // The diagram is drawn by us, not typed in.
    ignoreMutation: (mutation) => !code.contains(mutation.target),
    destroy: () => {
      clearTimeout(timer);
      context.nearScreen()?.unwatch(diagram);
    },
  };
}
