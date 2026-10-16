<!--
  Preview mode of a Markdown file, editable like a document (Typora-style): the rich text editor in
  richEditor.ts. Edits go into the source text block by block, so the file is saved, diffed and
  undone in the text editor as usual. Milkdown loads the first time this shows.
-->
<script lang="ts">
  import RichEditorHost from "@git-manager/ui/components/RichEditorHost.svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { onDestroy, untrack } from "svelte";
  import { errorMessage } from "$lib/api";
  import { classifyLink } from "$lib/markdown/links";
  import { documentLinkContext, isDarkPage, workspaceImageUrl } from "$lib/markdown/markdownContext";
  import type { RichAction, RichMarkdownEditor } from "$lib/markdown/richEditor";
  import type { SourceEdit } from "$lib/markdown/richSync";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { toast } from "$lib/ui/toast.svelte";

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
  let loadError = $state<string | null>(null);
  let readOnlyReason = $state<string | null>(null);
  let ready = $state(false);
  let editor: RichMarkdownEditor | null = null;
  let destroyed = false;

  /** Loads TipTap into the host's body the first time this shows. */
  function mount(body: HTMLDivElement): void {
    void import("$lib/markdown/richEditor")
      .then(async ({ RichMarkdownEditor }) => {
        if (destroyed) {
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
          linkContext: () => documentLinkContext(filePath),
          loadImage: workspaceImageUrl,
          isDark: isDarkPage,
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
  }

  onDestroy(() => {
    destroyed = true;
    onLeave(scroller?.scrollTop ?? 0);
    // An edit still waiting for the pause in typing goes into the text first.
    editor?.flush();
    editor?.destroy();
    editor = null;
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
    const destination = classifyLink(anchor.getAttribute("href") ?? "", documentLinkContext(filePath));
    if (destination.kind === "external") {
      void openUrl(destination.url).catch((error: unknown) =>
        toast.error("Could not open the link", errorMessage(error)),
      );
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

<RichEditorHost
  label="Markdown document"
  status={loadError ? `The editor failed to load: ${loadError}` : ready ? "" : "Loading editor..."}
  notice={readOnlyReason ?? ""}
  bind:page={scroller}
  onready={mount}
  onclick={onClick}
  onkeydown={onKeydown}
/>
