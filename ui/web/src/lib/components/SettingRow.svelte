<!-- A Settings row: the title and hint on the left, the control on the right (or under them when stacked).
     `titleMatches` marks the words a search found in the title. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { inlineCodeParts } from "../logic/inlineCode";
  import HighlightText from "./HighlightText.svelte";

  interface Props {
    title: string;
    titleMatches?: [number, number][];
    hint?: string;
    stacked?: boolean;
    nested?: boolean;
    /** Plain: no line between rows and a regular label, like the welcome screen's Customize page. */
    plain?: boolean;
    /** The whole row is its switch's label: a click on the words flips it. */
    toggle?: boolean;
    /** Something small after the title, such as a memory cost flag. */
    mark?: Snippet;
    hintContent?: Snippet;
    children: Snippet;
  }

  let {
    title,
    titleMatches = [],
    hint = "",
    stacked = false,
    nested = false,
    plain = false,
    toggle = false,
    mark,
    hintContent,
    children,
  }: Props = $props();
</script>

<svelte:element this={toggle ? "label" : "div"} class="row" class:stacked class:nested class:plain class:toggle>
  <div class="label">
    <span class="title"
      >{#if titleMatches.length > 0}<HighlightText
          text={title}
          ranges={titleMatches}
          variant="search"
        />{:else}{title}{/if}{#if mark}{" "}{@render mark()}{/if}</span
    >
    {#if hintContent}
      <span class="hint">{@render hintContent()}</span>
    {:else if hint}
      <span class="hint"
        >{#each inlineCodeParts(hint) as part, index (index)}{#if part.code}<code>{part.text}</code
            >{:else}{part.text}{/if}{/each}</span
      >
    {/if}
  </div>
  {@render children()}
</svelte:element>

<style>
  /* `backtick` words of a hint, such as a git option. */
  .hint code {
    font-family: var(--font-mono);
    font-size: var(--font-size-xsmall);
  }

  .toggle {
    cursor: pointer;
  }

  /* A setting that belongs to the one above it. */
  .nested {
    padding-left: var(--setting-row-nested-indent);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--setting-row-gap);
    padding: var(--setting-row-padding-y) 0;
    border-bottom: 1px solid var(--border);
  }

  .stacked {
    flex-direction: column;
    align-items: stretch;
    gap: var(--setting-row-stacked-gap);
  }

  .plain {
    min-height: var(--setting-row-plain-min-height);
    padding: 0;
    border-bottom: none;
  }

  .plain .title {
    font-weight: var(--font-weight-regular);
  }

  .label {
    display: flex;
    flex-direction: column;
    gap: var(--setting-row-label-gap);
    min-width: 0;
  }

  .title {
    font-weight: var(--font-weight-medium);
  }

  .hint {
    font-size: var(--font-size-small);
    color: var(--text-dim);
    line-height: 1.45;
  }
</style>
