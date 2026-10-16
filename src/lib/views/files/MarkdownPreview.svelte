<!--
  Live preview of a Markdown file beside (or instead of) its editor. markdown-it and DOMPurify load the
  first time a preview shows, mermaid only for documents with diagrams. Renders wait for a pause in
  typing and happen only while the tab is on screen.
-->
<script lang="ts">
  import RichEditorHost from "@git-manager/ui/components/RichEditorHost.svelte";
  import { LanguageSupport } from "@codemirror/language";
  import type { EditorView } from "@codemirror/view";
  import { usesDefaultKeys } from "$lib/commands/commandRuntime";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { onMount, untrack } from "svelte";
  import { errorMessage } from "$lib/api";
  import { languageFor } from "$lib/editor/setup";
  import { CodeHighlighter, fenceLanguages } from "$lib/markdown/highlight";
  import { documentLinkContext, isDarkPage, workspaceImageUrl } from "$lib/markdown/markdownContext";
  import type { MarkdownPreviewDom } from "$lib/markdown/previewDom";
  import { PreviewScrollSync } from "$lib/markdown/previewScrollSync";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { watchTheme } from "$lib/themes/watch";
  import { toast } from "$lib/ui/toast.svelte";

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

  let {
    filePath,
    docVersion,
    getSource,
    view,
    visible,
    syncScroll,
    initialLine,
    onLeave,
    onToggleTask,
    onSave,
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

  async function loadParser(extension: string) {
    const support = await languageFor(`file.${extension}`);
    return support instanceof LanguageSupport ? support.language.parser : null;
  }

  onMount(() => {
    const codeHighlighter = new CodeHighlighter(loadParser, () => schedule(0));
    codeHighlighter.setEnabled(settings.syntaxHighlighting);
    highlighter = codeHighlighter;
    void import("$lib/markdown/engine")
      .then(async (engine) => {
        const { MarkdownPreviewDom } = await import("$lib/markdown/previewDom");
        if (destroyed || !body) {
          return;
        }
        // Grammars for the code blocks load first, so the first render is already highlighted.
        await codeHighlighter.preload(fenceLanguages(getSource()));
        if (destroyed) {
          return;
        }
        preview = new MarkdownPreviewDom(engine, body, codeHighlighter, {
          linkContext: () => documentLinkContext(filePath),
          loadImage: workspaceImageUrl,
          isDark: isDarkPage,
        });
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
      sync.dispose();
      stopTheme();
      resize.disconnect();
      preview?.destroy();
      preview = null;
      highlighter = null;
    };
  });

  // Code blocks follow the Syntax highlighting setting; a hidden preview renders when shown again.
  $effect(() => {
    const enabled = settings.syntaxHighlighting;
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
      loadError = errorMessage(error);
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

  // Edits, and the tab coming back on screen, render again after a pause.
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
      void openUrl(destination.url).catch((error: unknown) =>
        toast.error("Could not open the link", errorMessage(error)),
      );
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
    const saveKey =
      (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s";
    if (saveKey && usesDefaultKeys("file.save")) {
      event.preventDefault();
      onSave();
    }
  }
</script>

<RichEditorHost
  variant="preview"
  label="Markdown preview"
  status={loadError ? `Preview failed: ${loadError}` : ready ? "" : "Loading preview..."}
  bind:page={scroller}
  onready={(element) => (body = element)}
  onscroll={() => syncScroll && sync.previewScrolled()}
  onclick={onClick}
  onauxclick={onAuxClick}
  onkeydown={onKeydown}
/>
