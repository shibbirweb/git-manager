<!-- A Markdown file edited like a document (Typora-style): TipTap renders it and edits go into the source text block by
     block (`onedit`), so the file is saved, diffed and undone as text. TipTap loads the first time it shows. A file
     whose Markdown the editor cannot keep exactly turns read-only with a notice. Clicking a link places the caret;
     Cmd+click (Ctrl+click) sends it to `onlink`. -->
<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { classifyLink, type LinkContext, type LinkTarget } from "../markdown/links";
  import type { RichAction, RichMarkdownEditor } from "../markdown/richEditor";
  import type { SourceEdit } from "../markdown/richSync";
  import RichEditorHost from "./RichEditorHost.svelte";

  interface Props {
    label: string;
    /** Bumped on every change of the source text. */
    docVersion: number;
    getSource: () => string;
    /** Scroll position to start at, kept from the last time it showed. */
    initialScroll: number;
    linkContext: () => LinkContext;
    /** The URL of a local image. */
    loadImage: (filePath: string) => Promise<string>;
    isDark: () => boolean;
    /** An edit made here, to apply to the source text. */
    onedit: (edit: SourceEdit) => void;
    onlink: (target: LinkTarget) => void;
    /** Leaving (it closes), with the scroll position. */
    onleave?: (scrollTop: number) => void;
    onkeydown?: (event: KeyboardEvent) => void;
  }

  let {
    label,
    docVersion,
    getSource,
    initialScroll,
    linkContext,
    loadImage,
    isDark,
    onedit,
    onlink,
    onleave,
    onkeydown,
  }: Props = $props();

  let scroller = $state<HTMLDivElement | null>(null);
  let loadError = $state<string | null>(null);
  let readOnlyReason = $state<string | null>(null);
  let ready = $state(false);
  let editor: RichMarkdownEditor | null = null;
  let destroyed = false;

  /** Loads TipTap into the host's body the first time this shows. */
  function mount(body: HTMLDivElement): void {
    void import("../markdown/richEditor")
      .then(async ({ RichMarkdownEditor }) => {
        if (destroyed) {
          return;
        }
        const created = await RichMarkdownEditor.create(body, {
          source: getSource(),
          onEdit: (edit) => onedit(edit),
          onReadOnly: (reason) => {
            readOnlyReason = reason;
            // A read-only page cannot take the keyboard; the page itself takes it, so keys never reach a hidden
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
        loadError = error instanceof Error ? error.message : String(error);
      });
  }

  onDestroy(() => {
    destroyed = true;
    onleave?.(scroller?.scrollTop ?? 0);
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

  /** A toolbar format, such as bold or a heading. */
  export function format(action: RichAction): void {
    editor?.run(action);
  }

  /** Links the selection to `href`, or removes its link. */
  export function toggleLink(href: string): void {
    editor?.toggleLink(href);
  }

  export function focus(): void {
    editor?.focus();
  }

  /** Writes a pending edit into the text at once, such as before saving or switching views. */
  export function flush(): void {
    editor?.flush();
  }

  function click(event: MouseEvent): void {
    const anchor = event.target instanceof Element ? event.target.closest("a") : null;
    if (!anchor) {
      return;
    }
    // Clicking a link places the caret, as in any editor; Cmd+click (Ctrl+click) follows it.
    event.preventDefault();
    if (!(event.metaKey || event.ctrlKey)) {
      return;
    }
    const destination = classifyLink(anchor.getAttribute("href") ?? "", linkContext());
    if (destination.kind !== "anchor") {
      onlink(destination);
    }
  }
</script>

<RichEditorHost
  {label}
  status={loadError ? `The editor failed to load: ${loadError}` : ready ? "" : "Loading editor..."}
  notice={readOnlyReason ?? ""}
  bind:page={scroller}
  onready={mount}
  onclick={click}
  {onkeydown}
/>
