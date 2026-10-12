<!-- The centered message of an empty panel or tab, with an optional icon, hint and action. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "../icons";
  import Icon from "./Icon.svelte";

  interface Props {
    title: string;
    hint?: string;
    icon?: IconName | null;
    variant?: "area" | "panel" | "notice" | "pane";
    iconStyle?: "plain" | "circle" | "large-circle";
    iconTone?: "inherit" | "faint" | "accent" | "success";
    strong?: boolean;
    titleSize?: "normal" | "large";
    titleTone?: "default" | "danger";
    overlay?: boolean;
    action?: Snippet;
  }

  let {
    title,
    hint = "",
    icon = null,
    variant = "area",
    iconStyle = "plain",
    iconTone = "inherit",
    strong = false,
    titleSize = "normal",
    titleTone = "default",
    overlay = false,
    action,
  }: Props = $props();
</script>

<div class="empty {variant}" class:overlay>
  {#if icon && iconStyle !== "plain"}
    <span class="circle {iconTone}" class:large={iconStyle === "large-circle"}>
      <Icon name={icon} size={iconStyle === "large-circle" ? "emphasis" : variant === "pane" ? "xxlarge" : "xlarge"} />
    </span>
  {:else if icon}
    <span class="plain {iconTone}">
      <Icon
        name={icon}
        size={variant === "area" ? "xlarge" : "giant"}
        stroke={variant === "area" ? "normal" : "thin"}
      />
    </span>
  {/if}
  <div class="title {titleSize} {titleTone}" class:strong>{title}</div>
  {#if hint}
    <div class="hint">{hint}</div>
  {/if}
  {@render action?.()}
</div>

<style>
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--empty-state-gap);
    padding: var(--empty-state-padding);
    text-align: center;
  }

  .hint {
    color: var(--text-dim);
  }

  .plain {
    display: flex;
  }

  .plain.faint {
    color: var(--text-faint);
  }

  /* A round tinted badge, such as the Changes panel's "all committed" check. */
  .circle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--empty-state-circle-size);
    height: var(--empty-state-circle-size);
    border-radius: 50%;
  }

  .circle.success {
    background: color-mix(in srgb, var(--success) 14%, transparent);
    color: var(--success);
  }

  .circle.accent,
  .circle.inherit,
  .circle.faint {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
  }

  /* A finished task's big check, such as every conflict resolved. */
  .circle.large {
    width: var(--empty-state-large-circle-size);
    height: var(--empty-state-large-circle-size);
  }

  .circle.large.success {
    background: color-mix(in srgb, var(--success) 18%, transparent);
  }

  .plain.accent {
    color: var(--accent);
  }

  .plain.success {
    color: var(--success);
  }

  .title.strong {
    font-weight: var(--font-weight-semibold);
  }

  .title.large {
    font-size: var(--font-size-title);
    font-weight: var(--font-weight-semibold);
  }

  .title.danger {
    color: var(--danger);
  }

  /* A whole side panel with nothing to show, centered, such as No git repository. */
  .pane {
    gap: var(--empty-state-pane-gap);
    padding: var(--empty-state-pane-padding-y) var(--empty-state-pane-padding-x);
  }

  /* Over a view that is still there, such as the log while it reloads. */
  .overlay {
    position: absolute;
    inset: 0;
  }

  /* In a side panel: smaller, dim words under a strong title, at the panel's top rather than centered. */
  .panel,
  .notice {
    flex: none;
    justify-content: flex-start;
    gap: var(--empty-state-panel-gap);
    padding: var(--empty-state-panel-padding-y) var(--empty-state-panel-padding-x);
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }

  .panel .title,
  .notice .title {
    color: var(--text);
    font-weight: var(--font-weight-bold);
  }

  .notice {
    border: 1px dashed var(--border-strong);
    border-radius: var(--empty-state-notice-radius);
  }
</style>
