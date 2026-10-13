<!-- A small heading over a group of rows, with an optional count and buttons at its end. `bar` is a full-height
     bar with a line under it (the Changes tab's lists), `list` heads a list inside a tab (compare tabs), `caption`
     is a quiet line over files (commit details), `caps` is small capitals (AI panel folders), `day` groups by date
     (Local History) and `divided` is a normal-weight title with a line under it (MCP tool groups). `heading` makes
     the title a heading of that level for screen readers, like Settings' group titles. `titleMatches` marks the
     words a search found in the title. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import HighlightText from "./HighlightText.svelte";

  interface Props {
    title: string;
    titleMatches?: [number, number][];
    variant?: "bar" | "list" | "caption" | "caps" | "day" | "divided" | "group" | "band" | "picker";
    count?: number | null;
    heading?: 2 | 3 | 4 | null;
    actions?: Snippet;
  }

  let { title, titleMatches = [], variant = "list", count = null, heading = null, actions }: Props = $props();

  const inlineCount = $derived(variant !== "bar" && variant !== "divided");
  const headingRole = $derived(heading === null ? undefined : "heading");
</script>

{#snippet titleText()}{#if titleMatches.length > 0}<HighlightText text={title} ranges={titleMatches} variant="search"
  />{:else}{title}{/if}{/snippet}

<div class="section-title {variant}">
  <!-- A bar spaces its count like its buttons; the others follow the title after a space, as in running text. -->
  {#if inlineCount}
    <span class="title" role={headingRole} aria-level={heading ?? undefined}
      >{@render titleText()}{#if count !== null}{" "}<span class="count">{count}</span>{/if}</span
    >
  {:else}
    <span class="title" role={headingRole} aria-level={heading ?? undefined}>{@render titleText()}</span>
    {#if count !== null}<span class="count">{count}</span>{/if}
  {/if}
  {#if actions}<span class="actions">{@render actions()}</span>{/if}
</div>

<style>
  .section-title {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--section-title-gap);
    min-width: 0;
    color: var(--text-dim);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-semibold);
  }

  .title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    flex: none;
    font-weight: var(--font-weight-regular);
  }

  .actions {
    flex: none;
    display: flex;
    gap: 1px;
    margin-left: auto;
  }

  .bar {
    height: var(--section-title-bar-height);
    padding: 0 var(--section-title-bar-padding-right) 0 var(--section-title-bar-padding-left);
    border-bottom: 1px solid var(--border-strong);
  }

  .list,
  .caption,
  .caps,
  .day,
  .group,
  .band,
  .picker {
    column-gap: normal;
  }

  .list {
    padding: var(--section-title-list-padding-top) var(--section-title-list-padding-x)
      var(--section-title-list-padding-bottom);
  }

  .caption {
    padding: var(--section-title-caption-padding-top) var(--section-title-caption-padding-x)
      var(--section-title-caption-padding-bottom);
    font-size: var(--font-size-compact);
    font-weight: var(--font-weight-regular);
  }

  .caps {
    padding: var(--section-title-caps-padding-top) var(--section-title-caps-padding-x)
      var(--section-title-caps-padding-bottom);
    font-size: var(--font-size-xsmall);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .day {
    padding: var(--section-title-day-padding-top) var(--section-title-day-padding-x)
      var(--section-title-day-padding-bottom);
    font-size: var(--font-size-xsmall);
  }

  /* A group of settings: small capitals with room above, less for the first. */
  .group {
    margin-top: var(--section-title-group-top);
    padding-bottom: var(--section-title-group-bottom);
    font-size: var(--font-size-xsmall);
    letter-spacing: var(--letter-spacing-caps);
    text-transform: uppercase;
  }

  .group:first-child {
    margin-top: var(--section-title-group-first-top);
  }

  /* A tinted band across a list, such as Interactive Rebase's "Commits to rebase". */
  .band {
    padding: var(--section-title-band-padding-top) var(--section-title-band-padding-x)
      var(--section-title-band-padding-bottom);
    border-bottom: 1px solid var(--border);
    background: var(--panel-alt);
    font-size: var(--font-size-compact);
  }

  /* A group in a picker popup, like the branches popup's Local and Remote. */
  .picker {
    padding: var(--section-title-picker-padding-top) var(--section-title-picker-padding-x)
      var(--section-title-picker-padding-bottom);
    color: var(--text-faint);
    font-size: var(--font-size-compact);
    text-transform: uppercase;
  }

  .divided {
    gap: var(--section-title-divided-gap);
    padding: var(--section-title-divided-padding-y) 0;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    font-size: inherit;
    font-weight: var(--font-weight-regular);
  }
</style>
