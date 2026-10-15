<!-- A box whose element the app fills itself, for content it manages outside Svelte's markup: a terminal that moves
     between the panel and an editor tab, or one parked out of sight. `onready` gets the element once it is in the
     page and may return a cleanup. `fill` lets it grow in a flex parent or cover a positioned one; `surface`
     paints the editor background; `clip` hides what overflows. Children render inside, before anything the app
     moves in. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label?: string;
    fill?: "none" | "grow" | "cover";
    surface?: "none" | "editor";
    hidden?: boolean;
    clip?: boolean;
    stretch?: boolean;
    onready?: (element: HTMLDivElement) => void | (() => void);
    children?: Snippet;
  }

  let {
    label,
    fill = "none",
    surface = "none",
    hidden = false,
    clip = false,
    stretch = false,
    onready,
    children,
  }: Props = $props();

  let element = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (element && onready) {
      return onready(element) ?? undefined;
    }
  });
</script>

<div
  bind:this={element}
  class="host fill-{fill} surface-{surface}"
  class:hidden
  class:clip
  class:stretch
  role={label ? "group" : undefined}
  aria-label={label}
>
  {@render children?.()}
</div>

<style>
  .host {
    position: relative;
    min-width: 0;
  }

  .fill-grow {
    flex: 1 1 0;
    min-height: 0;
  }

  .fill-cover {
    position: absolute;
    inset: 0;
  }

  .surface-editor {
    background: var(--editor-bg);
  }

  .clip {
    overflow: hidden;
  }

  /* What the app mounts fills the box, such as a CodeMirror editor. */
  .stretch {
    display: flex;
    flex-direction: column;
  }

  .stretch > :global(*) {
    flex: 1 1 0;
    min-height: 0;
  }

  .hidden {
    display: none;
  }
</style>
