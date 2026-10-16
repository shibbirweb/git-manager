<!--
  The app's side of the library's rich Markdown editor: links open in the browser or as a file tab, Cmd+S saves,
  Cmd+K asks for a link, and images and links resolve inside the workspace.
-->
<script lang="ts">
  import MarkdownEditor from "@git-manager/ui/components/MarkdownEditor.svelte";
  import type { LinkTarget } from "@git-manager/ui/markdown/links";
  import type { RichAction } from "@git-manager/ui/markdown/richEditor";
  import type { SourceEdit } from "@git-manager/ui/markdown/richSync";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { errorMessage } from "$lib/api";
  import { documentLinkContext, isDarkPage, workspaceImageUrl } from "$lib/markdown/markdownContext";
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

  let editor = $state<ReturnType<typeof MarkdownEditor> | null>(null);

  /** A toolbar button: runs in the rich editor. */
  export function format(action: RichAction): void {
    editor?.format(action);
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

  function openLink(target: LinkTarget): void {
    if (target.kind === "external") {
      void openUrl(target.url).catch((error: unknown) => toast.error("Could not open the link", errorMessage(error)));
    } else if (target.kind === "file") {
      void repoStore.openFile(target.filePath, { pin: true });
    } else {
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

<MarkdownEditor
  bind:this={editor}
  label="Markdown document"
  {docVersion}
  {getSource}
  {initialScroll}
  linkContext={() => documentLinkContext(filePath)}
  loadImage={workspaceImageUrl}
  isDark={isDarkPage}
  onedit={onEdit}
  onlink={openLink}
  onleave={onLeave}
  onkeydown={onKeydown}
/>
