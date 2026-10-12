<!-- A rounded word that tells a state: unsaved, modified, merging, read-only or "write" on a tool. Tones tint the
     background with the color; `strong` makes the word bold (a repository's ongoing operation). -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "selected";
    strong?: boolean;
    variant?: "fill" | "outline" | "border";
    title?: string;
    children: Snippet;
  }

  let { tone = "neutral", strong = false, variant = "fill", title, children }: Props = $props();
</script>

<span class="pill {tone} {variant}" class:strong {title}>{@render children()}</span>

<style>
  .pill {
    flex: none;
    padding: 0 var(--pill-padding-x);
    border-radius: var(--pill-radius);
    font-size: var(--font-size-xsmall);
    line-height: var(--pill-line-height);
    white-space: nowrap;
    background: var(--hover);
    color: var(--text-dim);
  }

  .strong {
    font-weight: var(--font-weight-semibold);
  }

  .accent {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
  }

  .success {
    background: color-mix(in srgb, var(--success) 15%, transparent);
    color: var(--success);
  }

  .warning {
    background: color-mix(in srgb, var(--warning) 18%, transparent);
    color: var(--warning);
  }

  .danger {
    background: color-mix(in srgb, var(--danger) 15%, transparent);
    color: var(--danger);
  }

  .selected {
    background: var(--selected);
    color: var(--text);
  }

  /* A taller mark with only a colored border, such as a shortcut that conflicts with another. */
  .border {
    border: 1px solid currentColor;
    background: transparent;
  }

  .border,
  .selected {
    line-height: var(--pill-tall-line-height);
  }

  /* A small bordered flag, such as Settings' "+60 MB" memory cost. */
  .outline {
    display: inline-block;
    border: 1px solid transparent;
    border-radius: var(--pill-outline-radius);
    font-size: var(--font-size-mini);
    font-weight: var(--font-weight-medium);
  }

  .outline.warning {
    border-color: color-mix(in srgb, var(--warning) 45%, transparent);
    background: color-mix(in srgb, var(--warning) 12%, transparent);
  }

  .outline.neutral {
    border-color: var(--border-strong);
    background: transparent;
    color: var(--text-dim);
  }
</style>
