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
        editor.focus();
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
    // The task box is drawn before the item's text; a click there ticks it.
    const task = target.closest("li[data-item-type='task']");
    if (task && event.target === task && event.clientX < task.getBoundingClientRect().left + 22) {
      event.preventDefault();
      editor?.toggleTask(task);
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
<div class="rich-markdown" bind:this={scroller} onclick={onClick} onkeydown={onKeydown}>
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
  .md-rich :global(li:not([data-spread="true"]) > p),
  .md-rich :global(:is(th, td) > p) {
    margin: 0;
  }

  .md-rich :global(li[data-item-type="task"]) {
    position: relative;
    list-style: none;
  }

  .md-rich :global(ul:has(> li[data-item-type="task"])) {
    padding-left: 1.4em;
  }

  /* The task box, drawn in front of the item; a click on it ticks the item. */
  .md-rich :global(li[data-item-type="task"]::before) {
    content: "";
    position: absolute;
    left: -1.35em;
    top: 0.35em;
    width: 0.9em;
    height: 0.9em;
    border: 1px solid var(--border-strong);
    border-radius: 3px;
    background: var(--editor-bg);
    cursor: pointer;
  }

  .md-rich :global(li[data-item-type="task"][data-checked="true"]::before) {
    border-color: var(--accent);
    background: var(--accent)
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.5l2.5 2.5L12 5.5' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E")
      center / 100% no-repeat;
  }

  .md-rich :global(li[data-item-type="task"][data-checked="true"] > p) {
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
