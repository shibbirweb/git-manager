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
  import { presetVar, type CellWidth, type ViewHeight, type ViewWidth } from "../logic/presets";
  import { gapValue, type Gap } from "../logic/scale";

  interface Props {
    direction?: "row" | "column";
    gap?: Gap;
    padding?: Gap;
    paddingX?: Gap | null;
    paddingY?: Gap | null;
    /** Space at the left only, overriding the others there: an indent, such as a repository's commit box. */
    paddingLeft?: Gap | null;
    align?: "start" | "center" | "end" | "stretch" | "baseline";
    justify?: "start" | "center" | "end" | "between";
    wrap?: boolean;
    grow?: boolean;
    /** true: may give way when the row is narrow; first: gives way before its siblings, down to its smallest
        width (a Text with giveWay shortens to nothing, the buttons stay whole). */
    shrink?: boolean | "first";
    width?: CellWidth | "auto";
    scroll?: "none" | "y" | "x" | "both";
    maxHeight?: Exclude<ViewHeight, "fill"> | "none";
    /** At most this wide, such as a page of settings that would read badly across a wide window. */
    maxWidth?: ViewWidth | "none";
    sticky?: boolean;
    /** A strong line on its top or bottom edge, such as the commit box docked under a list. */
    line?: "none" | "top" | "bottom";
    surface?: "none" | "editor" | "panel" | "alt";
    height?: "auto" | "window";
    element?: "div" | "span" | "section" | "header" | "footer" | "main" | "aside" | "nav" | "ul" | "li" | "form";
    role?: "group" | "region" | "tabpanel" | "alert" | "status" | "presentation" | null;
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
    paddingLeft = null,
    align = "stretch",
    justify = "start",
    wrap = false,
    grow = false,
    shrink = false,
    width = "auto",
    scroll = "none",
    maxHeight = "none",
    maxWidth = "none",
    sticky = false,
    line = "none",
    surface = "none",
    height = "auto",
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
  class:line-top={line === "top"}
  class:line-bottom={line === "bottom"}
  class:hidden={hidden()}
  class:grow
  class:surface-editor={surface === "editor"}
  class:surface-panel={surface === "panel"}
  class:surface-alt={surface === "alt"}
  class:window={height === "window"}
  {role}
  aria-label={label}
  aria-busy={busy || undefined}
  use:bar.observe={responsive}
  style:flex-direction={direction}
  style:gap={gapValue(gap)}
  style:padding="{gapValue(paddingY ?? padding)}
  {gapValue(paddingX ?? padding)}"
  style:padding-left={paddingLeft === null ? null : gapValue(paddingLeft)}
  style:align-items={FLEX[align] ?? align}
  style:justify-content={FLEX[justify] ?? justify}
  style:flex-wrap={wrap ? "wrap" : "nowrap"}
  class:shrink-first={shrink === "first"}
  style:flex={grow ? "1 1 0" : shrink === "first" ? "0 1000 auto" : shrink ? "0 1 auto" : "0 0 auto"}
  style:width={width === "auto" ? null : presetVar("cellWidth", width)}
  style:overflow-x={scroll === "x" || scroll === "both" ? "auto" : null}
  style:overflow-y={scroll === "y" || scroll === "both" ? "auto" : null}
  style:max-height={maxHeight === "none" ? null : presetVar("viewHeight", maxHeight)}
  style:max-width={maxWidth === "none" ? null : presetVar("viewWidth", maxWidth)}
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

  /* A whole window's screen, such as the standalone merge tool or the welcome screen. */
  .window {
    height: 100vh;
  }

  .surface-editor {
    background: var(--editor-bg);
  }

  .surface-panel {
    background: var(--panel);
  }

  .surface-alt {
    background: var(--panel-alt);
  }

  /* A growing Stack shares its parent's space, so it may also shrink below its content (a tab's body). */
  .grow {
    min-height: 0;
  }

  /* Gives way first, down to its smallest width: a Text with giveWay shortens to nothing, its buttons stay whole. */
  .shrink-first {
    min-width: auto;
  }

  /* A scrolling region may be smaller than its content, so it can shrink inside its parent. */
  .scroll {
    min-height: 0;
  }

  .line-top {
    border-top: 1px solid var(--border-strong);
  }

  .line-bottom {
    border-bottom: 1px solid var(--border-strong);
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
