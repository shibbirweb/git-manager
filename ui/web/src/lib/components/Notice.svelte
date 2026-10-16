<!-- A tinted banner with an icon and a message, like the merge tool's "File changed on disk". An optional action
     (a button) sits on the right. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    tone?: "danger" | "warning" | "info" | "success";
    variant?: "card" | "banner";
    icon?: IconName | null;
    action?: Snippet;
    children: Snippet;
  }

  let { tone = "info", variant = "card", icon = null, action, children }: Props = $props();

  const DEFAULT_ICONS: Record<string, IconName> = {
    danger: "alert",
    warning: "alert",
    info: "lightbulb",
    success: "check",
  };
</script>

<div class="notice {tone} {variant}" role={tone === "danger" ? "alert" : "status"}>
  <Icon name={icon ?? DEFAULT_ICONS[tone]} size={variant === "banner" ? "regular" : "large"} />
  <span class="message">{@render children()}</span>
  {@render action?.()}
</div>

<style>
  .notice {
    --tone: var(--accent);
    align-self: stretch;
    display: flex;
    align-items: center;
    gap: var(--notice-gap);
    padding: var(--notice-padding-y) var(--notice-padding-x);
    border-radius: var(--notice-radius);
    background: color-mix(in srgb, var(--tone) 10%, var(--panel));
  }

  .notice > :global(svg) {
    flex: none;
    color: var(--tone);
  }

  .danger {
    --tone: var(--danger);
  }

  .warning {
    --tone: var(--warning);
  }

  .success {
    --tone: var(--success);
  }

  .message {
    flex: 1;
    min-width: 0;
  }

  /* A full-width bar at the top of a view, like the merge and bisect banners. */
  .banner {
    gap: var(--banner-gap);
    padding: var(--banner-padding-y) var(--banner-padding-x);
    border-radius: 0;
    border-bottom: 1px solid var(--border-strong);
    background: color-mix(in srgb, var(--tone) 12%, var(--panel));
    color: var(--tone);
  }

  .banner.danger {
    background: color-mix(in srgb, var(--tone) 10%, var(--panel));
  }

  .banner .message {
    color: var(--text);
  }
</style>
