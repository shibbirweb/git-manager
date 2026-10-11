<!-- Text in a named text style (body, label, hint, caption, sectionLabel, title, heading, code...) from the design
     tokens. `tone`, `size` and `weight` override the style's when given. Screens never need a class or color for
     words. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { fontSize, fontWeight, textStyleVar, toneColor, type TextSize, type Tone, type Weight } from "../logic/scale";
  import { textStyles, type TextStyleName } from "../styles/tokens";

  interface Props {
    variant?: TextStyleName;
    tone?: Tone;
    size?: TextSize;
    weight?: Weight;
    mono?: boolean;
    truncate?: boolean;
    selectable?: boolean;
    element?: "span" | "p" | "div" | "h1" | "h2" | "h3" | "label" | "code";
    title?: string;
    children: Snippet;
  }

  let {
    variant = "body",
    tone,
    size,
    weight,
    mono = false,
    truncate = false,
    selectable = false,
    element = "span",
    title,
    children,
  }: Props = $props();

  const style = $derived(textStyles[variant]);
  const shownTone = $derived<Tone>(tone ?? (style.tone as Tone | null) ?? "default");
</script>

<svelte:element
  this={element}
  class="text"
  class:truncate
  class:selectable
  {title}
  style:color={toneColor(shownTone)}
  style:font-family={mono ? "var(--font-family-mono)" : textStyleVar(variant, "family")}
  style:font-size={size ? fontSize(size) : textStyleVar(variant, "size")}
  style:font-weight={weight ? fontWeight(weight) : textStyleVar(variant, "weight")}
  style:line-height={textStyleVar(variant, "line-height")}
  style:letter-spacing={textStyleVar(variant, "letter-spacing")}
  style:text-transform={textStyleVar(variant, "transform")}
>
  {@render children()}
</svelte:element>

<style>
  .text {
    margin: 0;
  }

  .truncate {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selectable {
    user-select: text;
    -webkit-user-select: text;
  }
</style>
