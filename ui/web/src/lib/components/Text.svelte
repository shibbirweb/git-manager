<!-- Text in a named text style (body, label, hint, caption, sectionLabel, title, heading, code...) from the design
     tokens. `tone`, `size` and `weight` override the style's when given. Screens never need a class or color for
     words. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { useNarrow } from "../logic/barSize.svelte";
  import type { NarrowStep } from "../logic/breakpoints";
  import { fontSize, fontWeight, textStyleVar, toneColor, type TextSize, type Tone, type Weight } from "../logic/scale";
  import { textStyles, type TextStyleName } from "../styles/tokens";

  interface Props {
    variant?: TextStyleName;
    tone?: Tone;
    size?: TextSize;
    weight?: Weight;
    mono?: boolean;
    truncate?: boolean;
    /** With truncate: in a tight row it shortens first, down to nothing, so the row's smallest width leaves it out. */
    giveWay?: boolean;
    selectable?: boolean;
    tabular?: boolean;
    wrap?: "normal" | "anywhere" | "pre";
    strike?: boolean;
    element?: "span" | "p" | "div" | "h1" | "h2" | "h3" | "h4" | "label" | "code";
    /** In a responsive Toolbar or Stack this narrow or narrower, the words hide; screen readers still read them. */
    hideAt?: NarrowStep | null;
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
    giveWay = false,
    selectable = false,
    tabular = false,
    wrap = "normal",
    strike = false,
    element = "span",
    hideAt = null,
    title,
    children,
  }: Props = $props();

  const style = $derived(textStyles[variant]);
  const shownTone = $derived<Tone>(tone ?? (style.tone as Tone | null) ?? "default");
  const narrow = useNarrow(() => hideAt);
</script>

{#snippet words()}
  <svelte:element
    this={element}
    class="text"
    class:truncate
    class:selectable
    class:tabular
    class:anywhere={wrap === "anywhere"}
    class:pre={wrap === "pre"}
    class:strike
    class:hidden={narrow()}
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
{/snippet}

{#if giveWay}
  <span class="give-way">{@render words()}</span>
{:else}
  {@render words()}
{/if}

<style>
  .text {
    margin: 0;
  }

  /* Shortens before its neighbours, down to nothing: a grid track whose smallest width is 0, not the longest word. */
  .give-way {
    flex: 0 1000 auto;
    display: inline-grid;
    grid-template-columns: minmax(0, max-content);
    min-width: 0;
  }

  .truncate {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Digits of one width, so times, sizes and counts line up and do not jump while they change. */
  .tabular {
    font-variant-numeric: tabular-nums;
  }

  /* Long paths and hashes break anywhere instead of pushing the layout wider. */
  .anywhere {
    overflow-wrap: anywhere;
  }

  /* Output and messages keep their own line breaks and spaces, and still wrap. */
  .pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  /* A deleted file's name. */
  .strike {
    text-decoration: line-through;
    text-decoration-color: var(--text-faint);
  }

  .selectable {
    user-select: text;
    -webkit-user-select: text;
  }

  /* Out of sight in a narrow bar, still read by screen readers. */
  .hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
