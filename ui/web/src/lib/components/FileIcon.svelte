<!-- A file's type icon. The app works out which icon a file gets (Settings > Appearance > File icons) and passes
     it as `view`: an image from the Material set or a class of the Minimal set. Without one it shows the plain
     file icon, or nothing when `plain` is false. -->
<script lang="ts">
  import { iconPx, type IconSize } from "../logic/presets";
  import Icon from "./Icon.svelte";

  export type FileIconView = { kind: "image"; src: string } | { kind: "class"; className: string } | null;

  interface Props {
    view: FileIconView;
    size?: IconSize;
    plain?: boolean;
  }

  let { view, size = "normal", plain = true }: Props = $props();
</script>

{#if view?.kind === "image"}
  <img class="image" src={view.src} alt="" width={iconPx(size)} height={iconPx(size)} draggable="false" />
{:else if view}
  <span
    class="file-type-icon {view.className}"
    style:width="{iconPx(size)}px"
    style:height="{iconPx(size)}px"
    aria-hidden="true"
  ></span>
{:else if plain}
  <Icon name="file" {size} />
{/if}

<style>
  .image {
    flex: none;
    display: block;
    user-select: none;
  }

  .file-type-icon {
    flex: none;
    display: block;
  }
</style>
