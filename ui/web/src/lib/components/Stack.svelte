<!-- Lays out its children in a row or column with a gap from the spacing tokens. Use it instead of writing CSS for
     a layout; it takes no class or style. `scroll` makes it a region that scrolls by itself, such as a dialog body. -->
<script lang="ts">
  import type { Snippet } from "svelte";
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
    scroll?: "none" | "y" | "x" | "both";
    element?: "div" | "section" | "header" | "footer" | "main" | "aside" | "nav" | "ul" | "li" | "form";
    label?: string;
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
    scroll = "none",
    element = "div",
    label,
    children,
  }: Props = $props();

  const FLEX: Record<string, string> = { start: "flex-start", end: "flex-end", between: "space-between" };
</script>

<svelte:element
  this={element}
  class="stack"
  class:scroll={scroll !== "none"}
  aria-label={label}
  style:flex-direction={direction}
  style:gap={gapValue(gap)}
  style:padding="{gapValue(paddingY ?? padding)} {gapValue(paddingX ?? padding)}"
  style:align-items={FLEX[align] ?? align}
  style:justify-content={FLEX[justify] ?? justify}
  style:flex-wrap={wrap ? "wrap" : "nowrap"}
  style:flex={grow ? "1 1 0" : "0 0 auto"}
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

  /* A scrolling region may be smaller than its content, so it can shrink inside its parent. */
  .scroll {
    min-height: 0;
  }
</style>
