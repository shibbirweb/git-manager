<!--
  An image or PDF from the work tree, loaded lazily by FileView, on the UI library's MediaView. The image or PDF
  loads from the gmpreview scheme, so its bytes never enter JavaScript; unmounting (tab hidden or closed) removes
  the element and MediaView frees the picture or document. PDFs use WebKit's own viewer.
-->
<script lang="ts">
  import Button from "@nibtree/ui/components/Button.svelte";
  import MediaView from "@nibtree/ui/components/MediaView.svelte";
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import { onDestroy, untrack } from "svelte";
  import { errorMessage } from "$lib/api";
  import { toast } from "$lib/ui/toast.svelte";
  import { platformName } from "$lib/update/releases";
  import { formatSize } from "../git/lfs/lfsModel";
  import { type PreviewInfo, tooLargeText } from "./mediaPreview";
  import { openPreview } from "./previewScheme";
  import { revealLabel } from "./reveal";

  interface Props {
    /** Absolute path, inside a workspace folder. */
    filePath: string;
    preview: PreviewInfo;
    /** Bumped by FileView when the file may have changed on disk. */
    reloadToken: number;
  }

  let { filePath, preview, reloadToken }: Props = $props();

  const REVEAL_LABEL = revealLabel(platformName(navigator.userAgent));
  const name = $derived(filePath.slice(filePath.lastIndexOf("/") + 1));

  let url = $state<string | null>(null);
  let error = $state<string | null>(null);
  let size = $state(0);
  /** null fits the image to the view. */
  let zoom = $state<number | null>(null);
  let request = 0;

  async function load(version: number): Promise<void> {
    const current = ++request;
    try {
      const opened = await openPreview({ kind: "worktree", filePath }, version);
      if (current !== request) {
        return;
      }
      size = opened.stat.size;
      if (!opened.stat.exists) {
        url = null;
        error = "The file is not there any more.";
      } else if (opened.stat.limit !== null) {
        url = null;
        error = tooLargeText(opened.stat.limit);
      } else {
        url = opened.url;
        error = null;
      }
    } catch (cause) {
      if (current === request) {
        url = null;
        error = errorMessage(cause);
      }
    }
  }

  $effect(() => {
    const version = reloadToken;
    void filePath;
    untrack(() => void load(version));
  });

  onDestroy(() => {
    request++;
  });

  async function reveal(): Promise<void> {
    try {
      await revealItemInDir(filePath);
    } catch (cause) {
      toast.error(`${REVEAL_LABEL} failed`, errorMessage(cause));
    }
  }
</script>

<MediaView
  kind={preview.kind}
  src={url ?? ""}
  {name}
  info={size > 0 ? formatSize(size) : ""}
  message={error ?? (url ? "" : "Loading...")}
  bind:zoom
>
  {#snippet actions()}
    <Button size="small" onclick={() => void reveal()}>{REVEAL_LABEL}</Button>
  {/snippet}
</MediaView>
