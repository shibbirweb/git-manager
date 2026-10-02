<!--
  Live preview of a Markdown file beside (or instead of) its editor. markdown-it and DOMPurify load the
  first time a preview shows, mermaid only for documents with diagrams. Renders wait for a pause in
  typing and happen only while the tab is on screen.
-->
<script lang="ts">
  import { LanguageSupport } from "@codemirror/language";
  import type { EditorView } from "@codemirror/view";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { onMount, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { languageFor } from "$lib/editor/setup";
  import { editorTopLine, isScrolledToEnd, scrollEditorToLine } from "$lib/markdown/editorScroll";
  import { CodeHighlighter, fenceLanguages } from "$lib/markdown/highlight";
  import type { LinkContext } from "$lib/markdown/links";
  import type { MarkdownPreviewDom } from "$lib/markdown/previewDom";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { folderFor, locateAbsolute, relativeTo } from "$lib/stores/workspacePaths";
  import { watchTheme } from "$lib/themes/watch";
  import { toast } from "$lib/ui/toast.svelte";
  import "$lib/markdown/body.css";

  interface Props {
    /** Absolute path of the Markdown file. */
    filePath: string;
    /** Bumped on every edit; the text itself is read only when a render runs. */
    docVersion: number;
    getSource: () => string;
    /** The source editor, once created. */
    view: EditorView | null;
    /** The tab is on screen. */
    visible: boolean;
    /** Editor and preview scroll together (split mode). */
    syncScroll: boolean;
    /** First source line to show, when the preview opens. */
    initialLine: number;
    /** Leaving (the tab was hidden or the mode changed), with the source line at the top. */
    onLeave?: (topLine: number) => void;
    onToggleTask: (lineIndex: number) => void;
    onSave: () => void;
  }

  let { filePath, docVersion, getSource, view, visible, syncScroll, initialLine, onLeave, onToggleTask, onSave }: Props = $props();

  const MIN_DELAY_MS = 150;
  const MAX_DELAY_MS = 1000;

  let scroller = $state<HTMLDivElement | null>(null);
  let body = $state<HTMLDivElement | null>(null);
  let loadError = $state<string | null>(null);
  let ready = $state(false);

  let preview: MarkdownPreviewDom | null = null;
  let renderTimer: ReturnType<typeof setTimeout> | undefined;
  let renderedVersion = -1;
  let lastRenderMs = 0;
  let firstRender = true;
  let destroyed = false;

  function isDark(): boolean {
    const theme = document.documentElement.getAttribute("data-theme");
    if (theme === "dark" || theme === "light") {
      return theme === "dark";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function linkContext(): LinkContext {
    const folders = repoStore.workspace?.folders ?? [];
    const rootPath = locateAbsolute(repoStore.repos, filePath)?.repo.root ?? folderFor(folders, filePath)?.root ?? "/";
    return {
      documentPath: filePath,
      rootPath,
      isInWorkspace: (absolutePath) => folderFor(folders, absolutePath) !== null,
    };
  }

  async function loadImage(imagePath: string): Promise<string> {
    const folder = folderFor(repoStore.workspace?.folders ?? [], imagePath);
    if (!folder) {
      throw new Error("Image outside the workspace");
    }
    try {
      return await api.readImageDataUrl(folder.root, relativeTo(folder.root, imagePath));
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  }

  async function loadParser(extension: string) {
    const support = await languageFor(`file.${extension}`);
    return support instanceof LanguageSupport ? support.language.parser : null;
  }

  onMount(() => {
    const highlighter = new CodeHighlighter(loadParser, () => schedule(0));
    void import("$lib/markdown/engine")
      .then(async (engine) => {
        const { MarkdownPreviewDom } = await import("$lib/markdown/previewDom");
        if (destroyed || !body) {
          return;
        }
        // Grammars for the code blocks load first, so the first render is already highlighted.
        await highlighter.preload(fenceLanguages(getSource()));
        if (destroyed) {
          return;
        }
        preview = new MarkdownPreviewDom(engine, body, highlighter, { linkContext, loadImage, isDark });
        ready = true;
        schedule(0);
      })
      .catch((error: unknown) => {
        loadError = errorMessage(error);
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
        onLeave?.(topLine());
      }
      clearTimeout(renderTimer);
      clearTimeout(driverTimer);
      cancelAnimationFrame(syncFrame);
      stopTheme();
      resize.disconnect();
      preview?.destroy();
      preview = null;
    };
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
      loadError = errorMessage(error);
      return;
    }
    lastRenderMs = performance.now() - start;
    renderedVersion = version;
    if (firstRender) {
      firstRender = false;
      if (syncScroll) {
        syncFromEditor();
      } else {
        scrollToLine(initialLine);
      }
    } else if (syncScroll && driver !== "preview") {
      // The edited part stays in view as blocks above it change height.
      syncFromEditor();
    }
  }

  // Edits, and the tab coming back on screen, render again after a pause.
  $effect(() => {
    const version = docVersion;
    if (visible && ready && version !== renderedVersion) {
      untrack(() => schedule(firstRender ? 0 : Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, lastRenderMs * 2))));
    }
  });

  // Scroll sync: whichever side the user scrolls leads for a moment, so the
  // other side's own scroll event never echoes back.
  let driver: "editor" | "preview" | null = null;
  let driverTimer: ReturnType<typeof setTimeout> | undefined;
  let syncFrame = 0;

  function lead(side: "editor" | "preview"): boolean {
    if (driver && driver !== side) {
      return false;
    }
    driver = side;
    clearTimeout(driverTimer);
    driverTimer = setTimeout(() => {
      driver = null;
    }, 150);
    return true;
  }

  function syncFromEditor(): void {
    if (!view || !scroller || !preview) {
      return;
    }
    lead("editor");
    scroller.scrollTop = isScrolledToEnd(view.scrollDOM) ? scroller.scrollHeight : preview.offsetForLine(scroller, editorTopLine(view));
  }

  function syncFromPreview(): void {
    if (!view || !scroller || !preview) {
      return;
    }
    if (isScrolledToEnd(scroller)) {
      view.scrollDOM.scrollTop = view.scrollDOM.scrollHeight;
    } else {
      scrollEditorToLine(view, preview.lineAtOffset(scroller, scroller.scrollTop));
    }
  }

  function onEditorScroll(): void {
    if (!lead("editor")) {
      return;
    }
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(syncFromEditor);
  }

  function onPreviewScroll(): void {
    if (!syncScroll || !lead("preview")) {
      return;
    }
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(syncFromPreview);
  }

  $effect(() => {
    const element = ready && syncScroll ? (view?.scrollDOM ?? null) : null;
    if (!element) {
      return;
    }
    element.addEventListener("scroll", onEditorScroll, { passive: true });
    return () => element.removeEventListener("scroll", onEditorScroll);
  });

  /** Shows a 0-based source line at the top of the preview. */
  export function scrollToLine(lineIndex: number): void {
    if (scroller && preview) {
      lead("editor");
      scroller.scrollTop = preview.offsetForLine(scroller, lineIndex);
    }
  }

  /** The (fractional) source line at the top of the preview. */
  export function topLine(): number {
    return scroller && preview ? preview.lineAtOffset(scroller, scroller.scrollTop) : 0;
  }

  function scrollToElement(element: Element): void {
    if (!scroller) {
      return;
    }
    const top = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
  }

  function onClick(event: MouseEvent): void {
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
        onToggleTask(Number(line));
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
    if (destination.kind === "external") {
      void openUrl(destination.url).catch((error: unknown) => toast.error("Could not open the link", errorMessage(error)));
    } else if (destination.kind === "anchor") {
      const element = preview.anchorElement(destination.id);
      if (element) {
        scrollToElement(element);
      }
    } else if (destination.kind === "file") {
      void repoStore.openFile(destination.filePath, { pin: true });
    } else {
      toast.info("Link not opened", "Only web, mail and workspace file links open from the preview.");
    }
  }

  function onAuxClick(event: MouseEvent): void {
    if (event.target instanceof Element && event.target.closest("a")) {
      event.preventDefault();
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      onSave();
    }
  }
</script>

<!-- Clicks are delegated to links and task boxes inside; Tab reaches it so it can be scrolled with keys. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
  class="markdown-preview"
  bind:this={scroller}
  onscroll={onPreviewScroll}
  onclick={onClick}
  onauxclick={onAuxClick}
  onkeydown={onKeydown}
  role="document"
  aria-label="Markdown preview"
  tabindex="0"
>
  {#if loadError}
    <p class="status">Preview failed: {loadError}</p>
  {:else if !ready}
    <p class="status">Loading preview...</p>
  {/if}
  <div class="md-body selectable" bind:this={body}></div>
</div>

<style>
  .markdown-preview {
    height: 100%;
    min-width: 0;
    overflow: auto;
    outline: none;
    background: var(--editor-bg);
    color: var(--text);
    /* Raw HTML in a document can never draw outside the preview. */
    contain: layout paint;
  }

  .status {
    margin: 16px 24px;
    color: var(--text-dim);
  }
</style>
