<!-- The live preview of a Markdown file beside (or instead of) its source editor. markdown-it and DOMPurify load the
     first time it shows, mermaid only for documents with diagrams. Renders wait for a pause in typing and happen only
     while `visible`. Links inside the page scroll to their heading; any other link goes to `onlink`, and a task box
     asks `ontoggletask` to edit its source line. With `syncScroll`, the preview and the `view` scroll together. -->
<script lang="ts">
  import type { EditorView } from "@codemirror/view";
  import { onMount, untrack } from "svelte";
  import { watchTheme } from "../logic/themeWatch";
  import { CodeHighlighter, fenceLanguages, type Parser } from "../markdown/highlight";
  import type { LinkContext, LinkTarget } from "../markdown/links";
  import type { MarkdownPreviewDom } from "../markdown/previewDom";
  import { PreviewScrollSync } from "../markdown/previewScrollSync";
  import RichEditorHost from "./RichEditorHost.svelte";

  interface Props {
    label: string;
    /** Bumped on every edit; the text itself is read only when a render runs. */
    docVersion: number;
    getSource: () => string;
    /** The source editor, once created. */
    view: EditorView | null;
    visible: boolean;
    syncScroll: boolean;
    /** First source line to show (0-based), when the preview opens. */
    initialLine: number;
    highlighting: boolean;
    /** The grammar for a code block's file extension. */
    loadParser: (extension: string) => Promise<Parser | null>;
    linkContext: () => LinkContext;
    /** The URL of a local image. */
    loadImage: (filePath: string) => Promise<string>;
    isDark: () => boolean;
    onlink: (target: LinkTarget) => void;
    ontoggletask: (lineIndex: number) => void;
    /** Leaving (the preview closes), with the source line at the top. */
    onleave?: (topLine: number) => void;
    onkeydown?: (event: KeyboardEvent) => void;
  }

  let {
    label,
    docVersion,
    getSource,
    view,
    visible,
    syncScroll,
    initialLine,
    highlighting,
    loadParser,
    linkContext,
    loadImage,
    isDark,
    onlink,
    ontoggletask,
    onleave,
    onkeydown,
  }: Props = $props();

  const MIN_DELAY_MS = 150;
  const MAX_DELAY_MS = 1000;

  let scroller = $state<HTMLDivElement | null>(null);
  /** The page's document element, from RichEditorHost (before onMount runs). */
  let body: HTMLDivElement | null = null;
  let loadError = $state<string | null>(null);
  let ready = $state(false);

  let preview: MarkdownPreviewDom | null = null;
  let highlighter: CodeHighlighter | null = null;
  let renderTimer: ReturnType<typeof setTimeout> | undefined;
  let renderedVersion = -1;
  let lastRenderMs = 0;
  let firstRender = true;
  let destroyed = false;

  function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  onMount(() => {
    const codeHighlighter = new CodeHighlighter(loadParser, () => schedule(0));
    codeHighlighter.setEnabled(highlighting);
    highlighter = codeHighlighter;
    void import("../markdown/engine")
      .then(async (engine) => {
        const { MarkdownPreviewDom } = await import("../markdown/previewDom");
        if (destroyed || !body) {
          return;
        }
        // Grammars for the code blocks load first, so the first render is already highlighted.
        await codeHighlighter.preload(fenceLanguages(getSource()));
        if (destroyed) {
          return;
        }
        preview = new MarkdownPreviewDom(engine, body, codeHighlighter, { linkContext, loadImage, isDark });
        ready = true;
        schedule(0);
      })
      .catch((error: unknown) => {
        loadError = messageOf(error);
      });

    // Diagrams follow the light or dark mode and the color theme.
    const stopTheme = watchTheme(() => preview?.redrawDiagrams());
    const resize = new ResizeObserver(() => preview?.invalidateLayout());
    if (body) {
      resize.observe(body);
    }
    return () => {
      destroyed = true;
      if (!syncScroll && ready) {
        onleave?.(topLine());
      }
      clearTimeout(renderTimer);
      sync.dispose();
      stopTheme();
      resize.disconnect();
      preview?.destroy();
      preview = null;
      highlighter = null;
    };
  });

  // Code blocks follow `highlighting`; a hidden preview renders when shown again.
  $effect(() => {
    const enabled = highlighting;
    untrack(() => {
      if (highlighter?.setEnabled(enabled)) {
        renderedVersion = -1;
        if (visible && ready) {
          schedule(0);
        }
      }
    });
  });

  /** Renders after `delay`, or after a longer pause when the last render was slow. */
  function schedule(delay: number): void {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderNow, delay);
  }

  function renderNow(): void {
    if (!preview || !visible || destroyed) {
      return;
    }
    const version = docVersion;
    const start = performance.now();
    try {
      preview.render(getSource());
    } catch (error) {
      loadError = messageOf(error);
      return;
    }
    lastRenderMs = performance.now() - start;
    renderedVersion = version;
    if (firstRender) {
      firstRender = false;
      if (syncScroll) {
        sync.followEditor();
      } else {
        scrollToLine(initialLine);
      }
    } else if (syncScroll && !sync.previewLeads) {
      // The edited part stays in view as blocks above it change height.
      sync.followEditor();
    }
  }

  // Edits, and the preview coming back on screen, render again after a pause.
  $effect(() => {
    const version = docVersion;
    if (visible && ready && version !== renderedVersion) {
      untrack(() => schedule(firstRender ? 0 : Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, lastRenderMs * 2))));
    }
  });

  const sync = new PreviewScrollSync({ view: () => view, scroller: () => scroller, preview: () => preview });

  $effect(() => {
    const element = ready && syncScroll ? (view?.scrollDOM ?? null) : null;
    if (!element) {
      return;
    }
    element.addEventListener("scroll", sync.editorScrolled, { passive: true });
    return () => element.removeEventListener("scroll", sync.editorScrolled);
  });

  /** Shows a 0-based source line at the top of the preview. */
  export function scrollToLine(lineIndex: number): void {
    sync.scrollToLine(lineIndex);
  }

  /** The (fractional) source line at the top of the preview. */
  export function topLine(): number {
    return sync.topLine();
  }

  function scrollToElement(element: Element): void {
    if (!scroller) {
      return;
    }
    const top = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
  }

  function click(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !preview) {
      return;
    }
    const checkbox = target.closest("input[type='checkbox']");
    if (checkbox) {
      // The source decides: a task box edits its line, any other checkbox stays as written.
      event.preventDefault();
      const line = checkbox.getAttribute("data-task-line");
      if (line !== null) {
        ontoggletask(Number(line));
      }
      return;
    }
    const link = target.closest("a");
    if (!link) {
      return;
    }
    // The webview itself never navigates.
    event.preventDefault();
    const destination = preview.linkTarget(link);
    if (destination.kind === "anchor") {
      const element = preview.anchorElement(destination.id);
      if (element) {
        scrollToElement(element);
      }
    } else {
      onlink(destination);
    }
  }

  function auxClick(event: MouseEvent): void {
    if (event.target instanceof Element && event.target.closest("a")) {
      event.preventDefault();
    }
  }
</script>

<RichEditorHost
  variant="preview"
  {label}
  status={loadError ? `Preview failed: ${loadError}` : ready ? "" : "Loading preview..."}
  bind:page={scroller}
  onready={(element) => (body = element)}
  onscroll={() => syncScroll && sync.previewScrolled()}
  onclick={click}
  onauxclick={auxClick}
  {onkeydown}
/>
