<!-- A file's type icon (Settings > Appearance > File icons); with No Icons, the plain file icon or nothing. -->
<script lang="ts">
  import FileIcon from "@git-manager/ui/components/FileIcon.svelte";
  import type { IconSize } from "@git-manager/ui/logic/presets";
  import { fileIcons } from "./fileIcons.svelte";

  interface Props {
    /** The file name or a repo-relative path; only the last part is used. */
    fileName: string;
    size?: IconSize;
    /** Show the plain file icon while icons are off (the Files panel); false shows nothing. */
    plain?: boolean;
  }

  let { fileName, size = "normal", plain = true }: Props = $props();

  const view = $derived(fileIcons.resolve?.(fileName.slice(fileName.lastIndexOf("/") + 1)) ?? null);
</script>

<FileIcon {view} {size} {plain} />
