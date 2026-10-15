<!-- A focusable listbox the app fills with its own grouped content (repository headers, folding groups, a commit
     box between them) and drives with its own keys. It keeps the focus, so selected Rows inside show the strong
     color, points screen readers at the active row by id, and scrolls. Use List when the rows are one flat set
     of items; use this when they are not. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { gapValue, type Gap } from "../logic/scale";

  interface Props {
    label: string;
    /** A list of rows, or a tree whose rows fold (the AI panel's projects). */
    role?: "listbox" | "tree";
    /** Tells screen readers it is loading. */
    busy?: boolean;
    /** The id of the row screen readers should read as the current one. */
    activeId?: string;
    paddingY?: Gap;
    onkeydown?: (event: KeyboardEvent) => void;
    children: Snippet;
  }

  let { label, role = "listbox", busy = false, activeId, paddingY = "none", onkeydown, children }: Props = $props();

  let element = $state<HTMLDivElement | null>(null);

  /** Moves the keyboard focus onto the list, such as after a click on one of its rows. */
  export function focus(): void {
    element?.focus();
  }

  /** Scrolls the active row into view, after the keys moved it. */
  export function reveal(): void {
    if (activeId) {
      document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex: the role is listbox or tree, both interactive. -->
<div
  class="region"
  {role}
  aria-busy={busy || undefined}
  tabindex="0"
  aria-label={label}
  aria-activedescendant={activeId}
  style:padding-block={gapValue(paddingY)}
  bind:this={element}
  {onkeydown}
>
  {@render children()}
</div>

<style>
  .region {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    outline: none;
  }
</style>
