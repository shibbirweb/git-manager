<!--
  The app's side of the library's Markdown preview: links open in the browser or as a file tab, Cmd+S saves, code
  blocks follow the Syntax highlighting setting, and images and links resolve inside the workspace.
-->
<script lang="ts">
  import PreviewPage from "@git-manager/ui/components/MarkdownPreview.svelte";
  import type { LinkTarget } from "@git-manager/ui/markdown/links";
  import { LanguageSupport } from "@codemirror/language";
  import type { EditorView } from "@codemirror/view";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { errorMessage } from "$lib/api";
  import { usesDefaultKeys } from "$lib/commands/commandRuntime";
  import { languageFor } from "$lib/editor/setup";
  import { documentLinkContext, isDarkPage, workspaceImageUrl } from "$lib/markdown/markdownContext";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
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

  let page = $state<ReturnType<typeof PreviewPage> | null>(null);

  async function loadParser(extension: string) {
    const support = await languageFor(`file.${extension}`);
    return support instanceof LanguageSupport ? support.language.parser : null;
  }

  function openLink(target: LinkTarget): void {
    if (target.kind === "external") {
      void openUrl(target.url).catch((error: unknown) => toast.error("Could not open the link", errorMessage(error)));
    } else if (target.kind === "file") {
      void repoStore.openFile(target.filePath, { pin: true });
    } else {
      toast.info("Link not opened", "Only web, mail and workspace file links open from the preview.");
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

  /** Shows a 0-based source line at the top of the preview. */
  export function scrollToLine(lineIndex: number): void {
    page?.scrollToLine(lineIndex);
  }

  /** The (fractional) source line at the top of the preview. */
  export function topLine(): number {
    return page?.topLine() ?? 0;
  }
</script>

<PreviewPage
  bind:this={page}
  label="Markdown preview"
  {docVersion}
  {getSource}
  {view}
  {visible}
  {syncScroll}
  {initialLine}
  highlighting={settings.syntaxHighlighting}
  {loadParser}
  linkContext={() => documentLinkContext(filePath)}
  loadImage={workspaceImageUrl}
  isDark={isDarkPage}
  onlink={openLink}
  ontoggletask={onToggleTask}
  onleave={onLeave}
  onkeydown={onKeydown}
/>
