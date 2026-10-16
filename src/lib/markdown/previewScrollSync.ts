// The Markdown preview and its source editor scroll together (split mode): whichever side the user scrolls leads
// for a moment, so the other side's own scroll event never echoes back.
import type { EditorView } from "@codemirror/view";
import { editorTopLine, isScrolledToEnd, scrollEditorToLine } from "./editorScroll";
import type { MarkdownPreviewDom } from "./previewDom";

export interface ScrollSyncParts {
  view: () => EditorView | null;
  scroller: () => HTMLElement | null;
  preview: () => MarkdownPreviewDom | null;
}

export class PreviewScrollSync {
  private driver: "editor" | "preview" | null = null;
  private driverTimer: ReturnType<typeof setTimeout> | undefined;
  private frame = 0;

  constructor(private readonly parts: ScrollSyncParts) {}

  private lead(side: "editor" | "preview"): boolean {
    if (this.driver && this.driver !== side) {
      return false;
    }
    this.driver = side;
    clearTimeout(this.driverTimer);
    this.driverTimer = setTimeout(() => {
      this.driver = null;
    }, 150);
    return true;
  }

  /** The user is scrolling the preview right now. */
  get previewLeads(): boolean {
    return this.driver === "preview";
  }

  /** Puts the preview at the editor's top line (or its end). */
  followEditor(): void {
    const view = this.parts.view();
    const scroller = this.parts.scroller();
    const preview = this.parts.preview();
    if (!view || !scroller || !preview) {
      return;
    }
    this.lead("editor");
    scroller.scrollTop = isScrolledToEnd(view.scrollDOM)
      ? scroller.scrollHeight
      : preview.offsetForLine(scroller, editorTopLine(view));
  }

  private fromPreview(): void {
    const view = this.parts.view();
    const scroller = this.parts.scroller();
    const preview = this.parts.preview();
    if (!view || !scroller || !preview) {
      return;
    }
    if (isScrolledToEnd(scroller)) {
      view.scrollDOM.scrollTop = view.scrollDOM.scrollHeight;
    } else {
      scrollEditorToLine(view, preview.lineAtOffset(scroller, scroller.scrollTop));
    }
  }

  /** The source editor scrolled. */
  readonly editorScrolled = (): void => {
    if (!this.lead("editor")) {
      return;
    }
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.followEditor());
  };

  /** The preview scrolled. */
  previewScrolled(): void {
    if (!this.lead("preview")) {
      return;
    }
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.fromPreview());
  }

  /** Shows a 0-based source line at the top of the preview. */
  scrollToLine(lineIndex: number): void {
    const scroller = this.parts.scroller();
    const preview = this.parts.preview();
    if (scroller && preview) {
      this.lead("editor");
      scroller.scrollTop = preview.offsetForLine(scroller, lineIndex);
    }
  }

  /** The (fractional) source line at the top of the preview. */
  topLine(): number {
    const scroller = this.parts.scroller();
    const preview = this.parts.preview();
    return scroller && preview ? preview.lineAtOffset(scroller, scroller.scrollTop) : 0;
  }

  dispose(): void {
    clearTimeout(this.driverTimer);
    cancelAnimationFrame(this.frame);
  }
}
