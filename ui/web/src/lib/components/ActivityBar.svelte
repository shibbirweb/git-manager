<!-- The vertical icon bar beside a side panel: one button per panel, the open one tinted with an accent line, and
     an optional count badge. Items after a `null` entry sit at the bottom; a "divider" entry draws a short line.
     An item's own `active` lets several be on at once (a panel and the terminal); `title` is its tooltip. -->
<script lang="ts">
  import type { IconName } from "../icons";
  import Badge from "./Badge.svelte";
  import Icon from "./Icon.svelte";

  interface ActivityItem {
    id: string;
    icon: IconName;
    label: string;
    badge?: number;
    /** Something new in the panel: a small accent dot, for panels without a count. */
    dot?: boolean;
    /** A glyph that looks big at the bar's size (play) is drawn a step smaller. */
    smallIcon?: boolean;
    /** Shown as on, whatever `active` says; for toggles that are on independently. */
    active?: boolean;
    /** The tooltip, such as the name with its shortcut; defaults to `label`. */
    title?: string;
    badgeTone?: "accent" | "danger" | "warning";
  }

  interface Props {
    items: (ActivityItem | null | "divider")[];
    active?: string | null;
    label: string;
    side?: "left" | "right";
    onselect?: (id: string) => void;
  }

  let { items, active = $bindable(null), label, side = "left", onselect }: Props = $props();
</script>

<nav class="activity {side}" aria-label={label}>
  {#each items as item, index (typeof item === "object" && item ? item.id : `${item}-${index}`)}
    {#if item === null}
      <div class="spacer"></div>
    {:else if item === "divider"}
      <div class="divider" role="separator"></div>
    {:else}
      {@const on = item.active ?? item.id === active}
      <button
        class="item"
        class:active={on}
        type="button"
        aria-label={item.label}
        aria-pressed={on}
        title={item.title ?? item.label}
        onclick={() => {
          active = item.id;
          onselect?.(item.id);
        }}
      >
        <Icon name={item.icon} size={item.smallIcon ? "xlarge" : "activity"} stroke="light" />
        {#if item.dot}
          <span class="dot" aria-hidden="true"></span>
        {/if}
        {#if item.badge}
          <span class="badge"><Badge count={item.badge} tone={item.badgeTone ?? "accent"} /></span>
        {/if}
      </button>
    {/if}
  {/each}
</nav>

<style>
  .activity {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--activity-bar-gap);
    width: var(--activity-bar-width);
    padding: var(--activity-bar-padding) 0;
    background: var(--panel-alt);
    border-right: 1px solid var(--border-strong);
  }

  .right {
    border-right: none;
    border-left: 1px solid var(--border-strong);
  }

  .item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--activity-bar-item);
    height: var(--activity-bar-item);
    border: none;
    border-radius: var(--activity-bar-radius);
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .item:hover {
    color: var(--text);
    background: var(--hover);
  }

  .item.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .item.active::before {
    content: "";
    position: absolute;
    top: var(--space-4);
    bottom: var(--space-4);
    left: calc(var(--space-2) * -1);
    width: var(--activity-bar-indicator);
    border-radius: var(--radius-tiny);
    background: var(--accent);
  }

  .right .item.active::before {
    left: auto;
    right: calc(var(--space-2) * -1);
  }

  .spacer {
    flex: 1;
  }

  .divider {
    flex: none;
    width: var(--activity-bar-separator-width);
    height: 1px;
    margin: var(--activity-bar-separator-space) 0;
    background: var(--border-strong);
  }

  .badge {
    position: absolute;
    right: 1px;
    bottom: var(--activity-bar-badge-bottom);
    display: flex;
  }

  .dot {
    position: absolute;
    top: var(--activity-bar-dot-inset);
    right: var(--activity-bar-dot-inset);
    width: var(--activity-bar-dot);
    height: var(--activity-bar-dot);
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 var(--activity-bar-dot-ring) var(--panel-alt);
  }
</style>
