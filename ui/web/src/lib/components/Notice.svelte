<!-- A tinted banner with an icon and a message, like the merge tool's "File changed on disk". An optional action
     (a button) sits on the right. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    tone?: "danger" | "warning" | "info" | "success";
    icon?: IconName | null;
    action?: Snippet;
    children: Snippet;
  }

  let { tone = "info", icon = null, action, children }: Props = $props();

  const DEFAULT_ICONS: Record<string, IconName> = {
    danger: "alert",
    warning: "alert",
    info: "lightbulb",
    success: "check",
  };
</script>

<div class="notice {tone}" role={tone === "danger" ? "alert" : "status"}>
  <Icon name={icon ?? DEFAULT_ICONS[tone]} size={16} />
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
  }
</style>
