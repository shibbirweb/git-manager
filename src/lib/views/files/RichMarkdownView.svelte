<!--
  Preview mode of a Markdown file, editable like a document (Typora-style): the rich text editor in
  richEditor.ts. Edits go into the source text block by block, so the file is saved, diffed and
  undone in the text editor as usual. Milkdown loads the first time this shows.
-->
<script lang="ts">
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { onMount, untrack } from "svelte";
  import { errorMessage } from "$lib/api";
  import { classifyLink, type LinkContext } from "$lib/markdown/links";
  import type { RichAction, RichMarkdownEditor } from "$lib/markdown/richEditor";
  import type { SourceEdit } from "$lib/markdown/richSync";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { folderFor, locateAbsolute } from "$lib/stores/workspacePaths";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { markdownImageUrl } from "$lib/views/files/previewScheme";
  import "$lib/markdown/body.css";

  interface Props {
    /** Absolute path of the Markdown file. */
    filePath: string;
    /** Bumped on every change of the source text. */
    docVersion: number;
    getSource: () => string;
    /** Scroll position to start at, kept from the last time the tab was shown. */
    initialScroll: number;
    /** Leaving (the tab was hidden or the mode changed), with the scroll position. */
    onLeave: (scrollTop: number) => void;
    /** An edit made here, applied to the source text. */
    onEdit: (edit: SourceEdit) => void;
    onSave: () => void;
  }

  let { filePath, docVersion, getSource, initialScroll, onLeave, onEdit, onSave }: Props = $props();

  let scroller = $state<HTMLDivElement | null>(null);

  let body = $state<HTMLDivElement | null>(null);
  let loadError = $state<string | null>(null);
  let readOnlyReason = $state<string | null>(null);
  let ready = $state(false);
  let editor: RichMarkdownEditor | null = null;
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
    if (!folderFor(repoStore.workspace?.folders ?? [], imagePath)) {
      throw new Error("Image outside the workspace");
    }
    return markdownImageUrl(imagePath);
  }

  onMount(() => {
    void import("$lib/markdown/richEditor")
      .then(async ({ RichMarkdownEditor }) => {
        if (destroyed || !body) {
          return;
        }
        const created = await RichMarkdownEditor.create(body, {
          source: getSource(),
          onEdit: (edit) => onEdit(edit),
          onReadOnly: (reason) => {
            readOnlyReason = reason;
            // A read-only page cannot take the keyboard; the page itself takes it, so keys never reach the hidden
            // text editor (and Cmd+S still works here).
            queueMicrotask(() => scroller?.focus());
          },
          linkContext,
          loadImage,
          isDark,
        });
        if (destroyed) {
          created.destroy();
          return;
        }
        editor = created;
        ready = true;
        if (scroller && initialScroll > 0) {
          scroller.scrollTop = initialScroll;
        }
        if (readOnlyReason) {
          scroller?.focus();
        } else {
          editor.focus();
        }
      })
      .catch((error: unknown) => {
        loadError = errorMessage(error);
      });
    return () => {
      destroyed = true;
      onLeave(scroller?.scrollTop ?? 0);
      // An edit still waiting for the pause in typing goes into the text first.
      editor?.flush();
      editor?.destroy();
      editor = null;
    };
  });

  // Changes to the text made elsewhere (Revert, a reload, the text editor) show here.
  $effect(() => {
    void docVersion;
    if (ready) {
      untrack(() => editor?.setSource(getSource()));
    }
  });

  /** A toolbar button: runs in the rich editor. */
  export function format(action: RichAction): void {
    editor?.run(action);
  }

  export async function link(): Promise<void> {
    const result = await dialogs.prompt({
      title: "Link",
      label: "Address",
      placeholder: "https://",
      confirmLabel: "Add Link",
    });
    if (result?.value.trim()) {
      editor?.toggleLink(result.value.trim());
    } else {
      editor?.focus();
    }
  }

  /** Writes a pending edit into the text at once, e.g. before switching views. */
  export function flush(): void {
    editor?.flush();
  }

  function onClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const anchor = target.closest("a");
    if (!anchor) {
      return;
    }
    // Clicking a link places the caret, as in any editor; Cmd+click (Ctrl+click) follows it.
    event.preventDefault();
    if (!(event.metaKey || event.ctrlKey)) {
      return;
    }
    const destination = classifyLink(anchor.getAttribute("href") ?? "", linkContext());
    if (destination.kind === "external") {
      void openUrl(destination.url).catch((error: unknown) => toast.error("Could not open the link", errorMessage(error)));
    } else if (destination.kind === "file") {
      void repoStore.openFile(destination.filePath, { pin: true });
    } else if (destination.kind === "blocked") {
      toast.info("Link not opened", "Only web, mail and workspace file links open from here.");
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      editor?.flush();
      onSave();
    } else if (mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      void link();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="rich-markdown" tabindex="-1" bind:this={scroller} onclick={onClick} onkeydown={onKeydown}>
  {#if loadError}
    <p class="status">The editor failed to load: {loadError}</p>
  {:else if !ready}
    <p class="status">Loading editor...</p>
  {/if}
  {#if readOnlyReason}
    <p class="notice">{readOnlyReason}</p>
  {/if}
  <div class="md-body md-rich selectable" bind:this={body}></div>
</div>

<style>
  .rich-markdown {
    height: 100%;
    min-width: 0;
    overflow: auto;
    background: var(--editor-bg);
    color: var(--text);
    outline: none;
  }

  .status {
    margin: 16px 24px;
    color: var(--text-dim);
  }

  .notice {
    max-width: 920px;
    margin: 12px auto 0;
    padding: 8px 12px;
    border: 1px solid color-mix(in srgb, var(--warning) 45%, transparent);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--warning) 10%, transparent);
    color: var(--text);
    font-size: 12px;
  }

  /* ProseMirror needs these to keep spaces and wrap like the text. */
  .md-rich :global(.ProseMirror) {
    min-height: 60vh;
    outline: none;
    white-space: pre-wrap;
    word-wrap: break-word;
    caret-color: var(--text);
  }

  .md-rich :global(.ProseMirror > :first-child) {
    margin-top: 0;
  }

  /* Like the preview (body.css): blocks far off screen are not drawn while scrolling. */
  .md-rich :global(.ProseMirror > *) {
    content-visibility: auto;
    contain-intrinsic-size: auto 120px;
  }

  /* ProseMirror wraps list items and table cells in paragraphs; space them like the preview. */
  .md-rich :global(li > p),
  .md-rich :global(ul[data-type="taskList"] > li > div > p),
  .md-rich :global(:is(th, td) > p) {
    margin: 0;
  }

  /* Task items: the box before the text is its own checkbox, which ticks the item. TipTap's node view leaves
     data-type off the li, so items are found through their taskList. */
  .md-rich :global(ul[data-type="taskList"]) {
    padding-left: 1.4em;
    list-style: none;
  }

  .md-rich :global(ul[data-type="taskList"] > li) {
    position: relative;
  }

  /* The same native box as the preview's, centered on the item's first line. */
  .md-rich :global(ul[data-type="taskList"] > li > label) {
    position: absolute;
    left: -1.4em;
    display: flex;
    align-items: center;
    height: 1.6em;
    user-select: none;
  }

  .md-rich :global(ul[data-type="taskList"] > li > label > input) {
    margin: 0;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .md-rich :global(ul[data-type="taskList"] > li[data-checked="true"] > div) {
    color: var(--text-dim);
    text-decoration: line-through;
  }

  .md-rich :global(.md-rich-code) {
    margin: 0 0 16px;
  }

  .md-rich :global(.md-rich-code > pre) {
    margin-bottom: 0;
  }

  .md-rich :global(.md-rich-code > pre[data-language]:not([data-language=""])::after) {
    content: attr(data-language);
    float: right;
    margin-top: -4px;
    color: var(--text-faint);
    font-family: var(--font-ui);
    font-size: 11px;
  }

  .md-rich :global(.md-rich-code > .md-mermaid) {
    margin: 8px 0 0;
    user-select: none;
  }

  .md-rich :global(img.md-image-blocked) {
    display: inline-block;
    min-width: 48px;
    min-height: 24px;
    border: 1px dashed var(--border-strong);
    border-radius: 4px;
  }

  .md-rich :global(.ProseMirror-selectednode) {
    outline: 2px solid var(--accent);
  }
</style>
