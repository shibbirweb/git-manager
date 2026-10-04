<!-- A file's type icon (Settings > Appearance > File icons); with No Icons, the plain file icon or nothing. -->
<script lang="ts">
  import Icon from "$lib/ui/Icon.svelte";
  import { fileIcons } from "./fileIcons.svelte";

  interface Props {
    /** The file name or a repo-relative path; only the last part is used. */
    fileName: string;
    size?: number;
    /** Show the plain file icon while icons are off (the Files panel); false shows nothing. */
    plain?: boolean;
  }

  let { fileName, size = 14, plain = true }: Props = $props();

  const view = $derived(fileIcons.resolve?.(fileName.slice(fileName.lastIndexOf("/") + 1)) ?? null);
</script>

{#if view?.kind === "image"}
  <img class="file-type-image" src={view.src} alt="" width={size} height={size} draggable="false" decoding="async" />
{:else if view}
  <span class="file-type-icon {view.className}" style:width="{size}px" style:height="{size}px" aria-hidden="true"></span>
{:else if plain}
  <Icon name="file" {size} />
{/if}

<style>
  .file-type-image {
    flex: none;
    display: block;
    user-select: none;
  }
</style>
