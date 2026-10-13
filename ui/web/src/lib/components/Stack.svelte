<!-- Lays out its children in a row or column with a gap from the spacing tokens. Use it instead of writing CSS for
     a layout; it takes no class or style. `scroll` makes it a region that scrolls by itself, such as a dialog body;
     `width` gives a column of a row a set width, such as a commit's hash, so the rows line up. `sticky` keeps a bar
     at the top of the region scrolling under it (Keyboard Shortcuts' search). `responsive` measures its width so
     what is inside can step aside with `hideAt` (a Stack, Text or Badge), like a responsive Toolbar; it is read
     once, when the Stack is made. -->
<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import { BarSize, provideBarSize, useNarrow } from "../logic/barSize.svelte";
  import type { NarrowStep } from "../logic/breakpoints";
  import { presetVar, type CellWidth } from "../logic/presets";
  import { gapValue, type Gap } from "../logic/scale";

  interface Props {
    direction?: "row" | "column";
    gap?: Gap;
    padding?: Gap;
    paddingX?: Gap | null;
    paddingY?: Gap | null;
    align?: "start" | "center" | "end" | "stretch" | "baseline";
    justify?: "start" | "center" | "end" | "between";
    wrap?: boolean;
    grow?: boolean;
    width?: CellWidth | "auto";
    scroll?: "none" | "y" | "x" | "both";
    sticky?: boolean;
    element?: "div" | "section" | "header" | "footer" | "main" | "aside" | "nav" | "ul" | "li" | "form";
    role?: "group" | "region" | "tabpanel" | "presentation" | null;
    label?: string;
    busy?: boolean;
    responsive?: boolean;
    hideAt?: NarrowStep | null;
    children: Snippet;
  }

  let {
    direction = "column",
    gap = "md",
    padding = "none",
    paddingX = null,
    paddingY = null,
    align = "stretch",
    justify = "start",
    wrap = false,
    grow = false,
    width = "auto",
    scroll = "none",
    sticky = false,
    element = "div",
    role = null,
    label,
    busy = false,
    responsive = false,
    hideAt = null,
    children,
  }: Props = $props();

  // The parent's width first, then this Stack's own for what is inside.
  const hidden = useNarrow(() => hideAt);
  const bar = new BarSize();
  if (untrack(() => responsive)) {
    provideBarSize(bar);
  }

  const FLEX: Record<string, string> = { start: "flex-start", end: "flex-end", between: "space-between" };
</script>

<svelte:element
  this={element}
  class="stack"
  class:scroll={scroll !== "none"}
  class:sticky
  class:hidden={hidden()}
  {role}
  aria-label={label}
  aria-busy={busy || undefined}
  use:bar.observe={responsive}
  style:flex-direction={direction}
  style:gap={gapValue(gap)}
  style:padding="{gapValue(paddingY ?? padding)} {gapValue(paddingX ?? padding)}"
  style:align-items={FLEX[align] ?? align}
  style:justify-content={FLEX[justify] ?? justify}
  style:flex-wrap={wrap ? "wrap" : "nowrap"}
  style:flex={grow ? "1 1 0" : "0 0 auto"}
  style:width={width === "auto" ? null : presetVar("cellWidth", width)}
  style:overflow-x={scroll === "x" || scroll === "both" ? "auto" : null}
  style:overflow-y={scroll === "y" || scroll === "both" ? "auto" : null}
>
  {@render children()}
</svelte:element>

<style>
  .stack {
    display: flex;
    min-width: 0;
    margin: 0;
    list-style: none;
  }

  .hidden {
    display: none;
  }

  /* A scrolling region may be smaller than its content, so it can shrink inside its parent. */
  .scroll {
    min-height: 0;
  }

  /* On the panel color with a line under it, so the rows scrolling beneath do not show through. */
  .sticky {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
  }
</style>
