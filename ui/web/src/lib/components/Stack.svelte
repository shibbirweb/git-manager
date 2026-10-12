<!-- Lays out its children in a row or column with a gap from the spacing tokens. Use it instead of writing CSS for
     a layout; it takes no class or style. -->
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
    element = "div",
    label,
    children,
  }: Props = $props();

  const FLEX: Record<string, string> = { start: "flex-start", end: "flex-end", between: "space-between" };
</script>

<svelte:element
  this={element}
  class="stack"
  aria-label={label}
  style:flex-direction={direction}
  style:gap={gapValue(gap)}
  style:padding="{gapValue(paddingY ?? padding)} {gapValue(paddingX ?? padding)}"
  style:align-items={FLEX[align] ?? align}
  style:justify-content={FLEX[justify] ?? justify}
  style:flex-wrap={wrap ? "wrap" : "nowrap"}
  style:flex={grow ? "1 1 0" : "0 0 auto"}
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
</style>
