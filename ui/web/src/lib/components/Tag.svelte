<!-- A small label beside a name, like "primary" or "folder" in the AI panel. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    tone?: "neutral" | "accent" | "danger" | "success" | "warning";
    title?: string;
    children: Snippet;
  }

  let { tone = "neutral", title, children }: Props = $props();
</script>

<span class="tag {tone}" {title}>{@render children()}</span>

<style>
  .tag {
    flex: none;
    display: inline-block;
    height: var(--tag-height);
    padding: 0 var(--tag-padding-x);
    border-radius: var(--tag-radius);
    font-size: var(--font-size-tiny);
    line-height: var(--tag-height);
    color: var(--text-dim);
    background: var(--hover);
  }

  .accent {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .danger {
    color: var(--danger);
    background: color-mix(in srgb, var(--danger) 14%, transparent);
  }

  .success {
    color: var(--success);
    background: color-mix(in srgb, var(--success) 14%, transparent);
  }

  .warning {
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 14%, transparent);
  }
</style>
